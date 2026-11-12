import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { API_URL } from '../../../../constants/app';
import { useAppControllerContext } from '../../../../context/AppControllerContext';
import { importPastedExternalImages } from '../../../../utils/externalEditorImages';
import { formatName } from '../../../../utils/formatters';
import type { Project, ProjectNote, RoleOption } from '../../../../types/app';
import Button from '../../../ui/Button';
import { Field, MultiSelect } from '../../../ui/FormField';
import ImageViewerModal from '../../../modals/ImageViewerModal';

type Props = {
  project: Project;
  canCreateUpdateNotes: boolean;
  canDeleteNotes: boolean;
  requestedNoteId?: string;
};

type EditorMode = 'view' | 'edit' | 'create';
type NoteVisibility = 'project' | 'restricted';

const INVALID_VISIBLE_USERS_MESSAGE =
  'Один или несколько пользователей не являются участниками проекта.';
const INVALID_VISIBLE_ROLES_MESSAGE = 'Одна или несколько ролей недоступны для выбора.';
const INVALID_ACCESS_MESSAGE =
  'Для ограниченной заметки выберите хотя бы одну роль или одного участника.';
const FALLBACK_ROLE_OPTIONS: RoleOption[] = [
  { value: 'ADMIN', label: 'Администратор' },
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'WORKER', label: 'Сотрудник' },
];

function formatNoteDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}.${month}.${year} в ${hours}:${minutes}`;
}

function getNoteVisibility(note: ProjectNote): NoteVisibility {
  return note.visibility ?? 'project';
}

function getNoteErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function resolveAccessErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return null;
  const message = error.message.toLowerCase();
  if (
    message.includes('visible_user_ids') ||
    message.includes('access.user_ids') ||
    message.includes('visible users') ||
    message.includes('не являются участниками')
  ) {
    return INVALID_VISIBLE_USERS_MESSAGE;
  }
  if (message.includes('access.roles') || message.includes('некорректные роли')) {
    return INVALID_VISIBLE_ROLES_MESSAGE;
  }
  if (message.includes('для ограниченной заметки')) {
    return INVALID_ACCESS_MESSAGE;
  }

  return null;
}

function ensureUserId(values: string[], userId?: string | null) {
  if (!userId || values.includes(userId)) return values;
  return [...values, userId];
}

function sortNotes(notes: ProjectNote[]): ProjectNote[] {
  return [...notes].sort((left, right) => {
    if (left.is_pinned !== right.is_pinned) return left.is_pinned ? -1 : 1;
    const leftDate = left.created_at ?? '';
    const rightDate = right.created_at ?? '';
    return rightDate.localeCompare(leftDate);
  });
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHtmlContent(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

const NOTE_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

function resolveNoteImageUrl(url?: string | null) {
  const value = String(url ?? '').trim();
  if (!value) return '';
  if (/^(blob:|data:|https?:\/\/)/i.test(value)) return value;

  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

function normalizeNoteImages(content: string) {
  if (typeof DOMParser === 'undefined') {
    return content.replace(
      /(<img\b[^>]*\bsrc=["'])(\/project-note-images\/[^"']+)(["'][^>]*>)/gi,
      (_match, before: string, src: string, after: string) =>
        `${before}${resolveNoteImageUrl(src)}${after}`,
    );
  }

  const doc = new DOMParser().parseFromString(content, 'text/html');
  doc.querySelectorAll('img').forEach((image) => {
    const resolvedSrc = resolveNoteImageUrl(image.getAttribute('src'));
    if (resolvedSrc) image.setAttribute('src', resolvedSrc);
  });

  return doc.body.innerHTML;
}

function getImageFiles(files: FileList | File[]) {
  return Array.from(files).filter((file) => file.type.startsWith('image/'));
}

function sanitizeNoteContent(content: string) {
  return DOMPurify.sanitize(content, {
    ADD_ATTR: ['target', 'rel'],
  });
}

function noteToEditableHtml(content: string) {
  const value = content ?? '';
  if (!value.trim()) return '';
  if (isHtmlContent(value)) return sanitizeNoteContent(value);

  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function isNoteContentEmpty(content: string) {
  const value = (content ?? '').trim();
  if (!value) return true;

  if (typeof DOMParser === 'undefined') {
    return value.replace(/<[^>]*>/g, '').trim() === '';
  }

  const doc = new DOMParser().parseFromString(value, 'text/html');
  return (doc.body.textContent ?? '').trim() === '';
}

export default function ProjectNotesTab({
  project,
  canCreateUpdateNotes,
  canDeleteNotes,
  requestedNoteId = '',
}: Props) {
  const { user } = useAppControllerContext();
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('view');
  const [openMenuNoteId, setOpenMenuNoteId] = useState<string | null>(null);
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [contentDraft, setContentDraft] = useState('');
  const [editorInitialHtml, setEditorInitialHtml] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [accessNote, setAccessNote] = useState<ProjectNote | null>(null);
  const [accessVisibility, setAccessVisibility] = useState<NoteVisibility>('project');
  const [accessRoleValues, setAccessRoleValues] = useState<string[]>([]);
  const [accessVisibleUserIds, setAccessVisibleUserIds] = useState<string[]>([]);
  const [accessVisibleUserIdsError, setAccessVisibleUserIdsError] = useState<
    string | null
  >(null);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>(FALLBACK_ROLE_OPTIONS);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedNoteImage, setSelectedNoteImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const noteImageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadNoteIdRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Image.configure({ allowBase64: false }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class:
          'min-h-[260px] w-full px-3 py-2 text-[14px] leading-relaxed text-[#1f3565] outline-none',
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (!files?.length || !getImageFiles(files).length) return false;

        event.preventDefault();
        void insertNoteImages(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length || !getImageFiles(files).length) return false;

        event.preventDefault();
        void insertNoteImages(files);
        return true;
      },
      handleClick: (_view, _position, event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement)) return false;

        event.preventDefault();
        setSelectedNoteImage({
          src: target.currentSrc || target.src,
          alt: target.alt || 'Изображение заметки',
        });
        return true;
      },
    },
    onUpdate: ({ editor: activeEditor, transaction }) => {
      importPastedExternalImages(activeEditor, transaction, importNoteImage);
      setContentDraft(sanitizeNoteContent(activeEditor.getHTML()));
    },
  });

  async function importNoteImage(url: string) {
    const noteId = uploadNoteIdRef.current;
    if (!noteId) {
      throw new Error(
        'Картинки с других сайтов копируются только в созданную заметку. Сохраните заметку и вставьте текст ещё раз.',
      );
    }

    const response = await api.workspace.projectNotes.importImage(noteId, url);
    return resolveNoteImageUrl(response.url);
  }

  const uploadNoteImages = async (files: FileList | File[]) => {
    const imageFiles = getImageFiles(files);
    if (!imageFiles.length) return [];
    if (isUploadingImage) return [];

    const noteId = uploadNoteIdRef.current;
    if (!noteId) {
      toast.info(
        'Картинки можно добавлять только в созданную заметку. Сначала сохраните заметку.',
      );
      return [];
    }

    const oversized = imageFiles.find((file) => file.size > NOTE_IMAGE_MAX_BYTES);
    if (oversized) {
      toast.error(`Файл «${oversized.name}» больше 20 МБ.`);
      return [];
    }

    try {
      setIsUploadingImage(true);
      const uploadedImages = [];

      for (const file of imageFiles) {
        const { url } = await api.workspace.projectNotes.uploadImage(noteId, file);
        uploadedImages.push({
          src: resolveNoteImageUrl(url),
          alt: file.name.replace(/\.[^.]+$/, ''),
        });
      }

      return uploadedImages;
    } catch (error) {
      toast.error(getNoteErrorMessage(error, 'Не удалось загрузить изображение.'));
      return [];
    } finally {
      setIsUploadingImage(false);
      if (noteImageInputRef.current) {
        noteImageInputRef.current.value = '';
      }
    }
  };

  const insertNoteImages = async (files: FileList | File[]) => {
    if (!editor) return;

    const uploadedImages = await uploadNoteImages(files);
    for (const image of uploadedImages) {
      editor.chain().focus().setImage(image).run();
    }
  };

  const handleNoteImageInputChange = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const imageFiles = getImageFiles(fileList);
    if (!imageFiles.length) {
      toast.error('Можно загрузить только изображение.');
      return;
    }

    await insertNoteImages(imageFiles);
  };

  const handleInsertNoteImageClick = () => {
    if (!canCreateUpdateNotes || isUploadingImage) return;

    if (!uploadNoteIdRef.current) {
      toast.info(
        'Картинки можно добавлять только в созданную заметку. Сначала сохраните заметку.',
      );
      return;
    }

    noteImageInputRef.current?.click();
  };

  const addNoteLink = () => {
    if (!editor || !canCreateUpdateNotes) return;

    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Введите URL ссылки', previousUrl ?? '');
    if (url === null) return;

    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    let ignore = false;

    const loadNotes = async () => {
      setIsLoading(true);

      try {
        const data = await api.workspace.projectNotes.getForProject(project.id);
        if (ignore) return;
        const sorted = sortNotes(data);
        setNotes(sorted);
        setSelectedNoteId((current) => {
          if (requestedNoteId && sorted.some((note) => note.id === requestedNoteId)) {
            return requestedNoteId;
          }
          return current ?? sorted[0]?.id ?? null;
        });
      } catch (error) {
        if (!ignore) {
          toast.error(getNoteErrorMessage(error, 'Не удалось загрузить заметки.'));
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    void loadNotes();

    return () => {
      ignore = true;
    };
  }, [project.id, requestedNoteId]);

  useEffect(() => {
    if (!openMenuNoteId) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuNoteId(null);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuNoteId]);

  const sortedNotes = useMemo(() => sortNotes(notes), [notes]);
  const visibleUserOptions = useMemo(
    () =>
      project.members.map((member) => ({
        value: member.user.id,
        label: `${formatName(member.user)}${member.user.email ? `, ${member.user.email}` : ''}`,
      })),
    [project.members],
  );
  const roleOptionItems = useMemo(
    () =>
      (roleOptions.length ? roleOptions : FALLBACK_ROLE_OPTIONS).map((role) => ({
        value: role.value,
        label: role.label,
      })),
    [roleOptions],
  );
  const selectedNote = useMemo(
    () => sortedNotes.find((note) => note.id === selectedNoteId) ?? null,
    [sortedNotes, selectedNoteId],
  );

  const isEditing = mode === 'edit' || mode === 'create';

  useEffect(() => {
    if (!editor) return;
    if (!isEditing) return;

    const target = editorInitialHtml || '';
    if (sanitizeNoteContent(editor.getHTML()) === sanitizeNoteContent(target)) return;

    editor.commands.setContent(target, { emitUpdate: false });
  }, [editor, editorInitialHtml, isEditing]);

  const beginEditingNote = (note: ProjectNote) => {
    if (!canCreateUpdateNotes) return;

    uploadNoteIdRef.current = note.id;
    setSelectedNoteId(note.id);
    setMode('edit');
    setTitleDraft(note.title ?? '');
    const html = normalizeNoteImages(noteToEditableHtml(note.content));
    setContentDraft(html);
    setEditorInitialHtml(html);
  };

  const startCreate = () => {
    if (!canCreateUpdateNotes) return;

    uploadNoteIdRef.current = null;
    setSelectedNoteId(null);
    setMode('create');
    setTitleDraft('');
    setContentDraft('');
    setEditorInitialHtml('');
  };

  const startEdit = () => {
    if (!selectedNote) return;
    beginEditingNote(selectedNote);
  };

  const cancelEditing = () => {
    uploadNoteIdRef.current = null;
    setMode('view');
    setTitleDraft('');
    setContentDraft('');
    setEditorInitialHtml('');
    if (!selectedNoteId && sortedNotes.length > 0) {
      setSelectedNoteId(sortedNotes[0].id);
    }
  };

  const handleSelectNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setMode('view');
  };

  const copyNoteLink = async (note: ProjectNote) => {
    const url = new URL(window.location.href);
    url.searchParams.set('project_id', project.id);
    url.searchParams.set('note_id', note.id);
    url.searchParams.delete('task_id');

    const link = url.toString();

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const copied = document.execCommand('copy');
        textarea.remove();

        if (!copied) throw new Error('Copy command failed');
      }

      toast.success('Ссылка на заметку скопирована.');
    } catch {
      toast.error('Не удалось скопировать ссылку.');
    }
  };

  const openAccessDialog = (note: ProjectNote) => {
    setAccessNote(note);
    const nextVisibility = getNoteVisibility(note);
    setAccessVisibility(nextVisibility);
    setAccessRoleValues(
      nextVisibility === 'restricted'
        ? (note.access?.roles?.map((role) => role.value) ?? [])
        : [],
    );
    setAccessVisibleUserIds(
      nextVisibility === 'restricted'
        ? ensureUserId(
            note.access?.users?.map((visibleUser) => visibleUser.id) ??
              note.visible_users?.map((visibleUser) => visibleUser.id) ??
              [],
            user?.id,
          )
        : [],
    );
    setAccessVisibleUserIdsError(null);
  };

  const saveDraft = async () => {
    if (!canCreateUpdateNotes) return;

    if (isNoteContentEmpty(contentDraft)) {
      toast.error('Содержимое заметки не может быть пустым.');
      return;
    }

    const payload = {
      title: titleDraft,
      content: sanitizeNoteContent(contentDraft),
      visibility:
        mode === 'edit' && selectedNote ? getNoteVisibility(selectedNote) : 'project',
    };

    setIsSaving(true);

    try {
      if (mode === 'create') {
        const created = await api.workspace.projectNotes.createForProject(
          project.id,
          payload,
        );
        setNotes((current) => sortNotes([created, ...current]));
        setSelectedNoteId(created.id);
        toast.success('Заметка создана.');
      } else if (mode === 'edit' && selectedNote) {
        const updated = await api.workspace.projectNotes.update(selectedNote.id, payload);
        setNotes((current) =>
          sortNotes(
            current.map((note) =>
              note.id === updated.id ? { ...updated, is_pinned: note.is_pinned } : note,
            ),
          ),
        );
        setSelectedNoteId(updated.id);
        toast.success('Заметка обновлена.');
      }

      setMode('view');
      setTitleDraft('');
      setContentDraft('');
      setEditorInitialHtml('');
    } catch (error) {
      toast.error(getNoteErrorMessage(error, 'Не удалось сохранить заметку.'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveAccess = async () => {
    if (!accessNote || !canCreateUpdateNotes) return;

    const payload = {
      title: accessNote.title ?? '',
      content: accessNote.content,
      visibility: accessVisibility,
      access:
        accessVisibility === 'restricted'
          ? {
              roles: accessRoleValues,
              user_ids: ensureUserId(accessVisibleUserIds, user?.id),
            }
          : { roles: [], user_ids: [] },
    };

    setIsSavingAccess(true);
    setAccessVisibleUserIdsError(null);

    try {
      const updated = await api.workspace.projectNotes.update(accessNote.id, payload);
      setNotes((current) =>
        sortNotes(
          current.map((note) =>
            note.id === updated.id ? { ...updated, is_pinned: note.is_pinned } : note,
          ),
        ),
      );
      setSelectedNoteId(updated.id);
      setAccessNote(null);
      toast.success('Доступ к заметке обновлён.');
    } catch (error) {
      const accessError = resolveAccessErrorMessage(error);
      if (accessError) setAccessVisibleUserIdsError(accessError);

      toast.error(getNoteErrorMessage(error, 'Не удалось сохранить доступы.'));
    } finally {
      setIsSavingAccess(false);
    }
  };

  const deleteNote = async (note: ProjectNote) => {
    if (!canDeleteNotes) return;

    const confirmed = window.confirm(
      `Удалить заметку «${note.title?.trim() || 'Без названия'}»?`,
    );
    if (!confirmed) return;

    setBusyNoteId(note.id);

    try {
      await api.workspace.projectNotes.delete(note.id);
      setNotes((current) => {
        const remaining = sortNotes(current.filter((item) => item.id !== note.id));
        if (selectedNoteId === note.id) {
          setSelectedNoteId(remaining[0]?.id ?? null);
          setMode('view');
        }
        return remaining;
      });
      toast.success('Заметка удалена.');
    } catch (error) {
      toast.error(getNoteErrorMessage(error, 'Не удалось удалить заметку.'));
    } finally {
      setBusyNoteId(null);
      setOpenMenuNoteId(null);
    }
  };

  const togglePin = async (note: ProjectNote) => {
    setBusyNoteId(note.id);

    try {
      if (note.is_pinned) {
        await api.workspace.projectNotes.unpin(note.id);
        setNotes((current) =>
          sortNotes(
            current.map((item) =>
              item.id === note.id ? { ...item, is_pinned: false } : item,
            ),
          ),
        );
      } else {
        const updated = await api.workspace.projectNotes.pin(note.id);
        setNotes((current) =>
          sortNotes(
            current.map((item) =>
              item.id === note.id ? { ...item, ...updated, is_pinned: true } : item,
            ),
          ),
        );
      }
    } catch (error) {
      toast.error(getNoteErrorMessage(error, 'Не удалось изменить закрепление.'));
    } finally {
      setBusyNoteId(null);
      setOpenMenuNoteId(null);
    }
  };

  const selectedNoteHtml = useMemo(
    () =>
      selectedNote
        ? sanitizeNoteContent(
            normalizeNoteImages(noteToEditableHtml(selectedNote.content)),
          )
        : '',
    [selectedNote],
  );
  const selectedNoteAccessLabels = useMemo(() => {
    if (!selectedNote) return [];

    const labels = new Map<string, string>();
    if (selectedNote.author?.id) {
      labels.set(selectedNote.author.id, formatName(selectedNote.author));
    }

    for (const role of selectedNote.access?.roles ?? []) {
      labels.set(`role:${role.value}`, role.label || role.value);
    }

    for (const user of selectedNote.access?.users ?? selectedNote.visible_users ?? []) {
      labels.set(user.id, formatName(user));
    }

    return Array.from(labels.values()).filter((label) => label !== '—');
  }, [selectedNote]);

  useEffect(() => {
    let ignore = false;

    const loadRoleOptions = async () => {
      try {
        const response = await api.getRoleOptions();
        if (ignore) return;
        setRoleOptions(response.length ? response : FALLBACK_ROLE_OPTIONS);
      } catch {
        if (!ignore) setRoleOptions(FALLBACK_ROLE_OPTIONS);
      }
    };

    void loadRoleOptions();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <section className='grid gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h3 className='text-[22px] leading-none font-semibold text-[#10275a]'>
            Заметки
          </h3>
        </div>

        <div className='grid gap-3 lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]'>
          {/* List */}
          <div className='flex flex-col gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3'>
            {canCreateUpdateNotes ? (
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={startCreate}
                disabled={isSaving}
                className='w-full justify-center rounded-xl border-dashed border-[#c9d8f8] bg-white text-[13px] font-semibold text-[#2d6ff7] hover:bg-[#edf3ff]'
              >
                + Новая заметка
              </Button>
            ) : null}

            <p className='text-[13px] font-semibold text-[#7e8fb4]'>
              Список заметок ({sortedNotes.length}):
            </p>

            <div className='flex flex-1 flex-col gap-1.5'>
              {isLoading ? (
                <div className='grid place-items-center py-8'>
                  <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
                </div>
              ) : sortedNotes.length === 0 ? (
                <p className='py-6 text-center text-[13px] text-[#9aa8c7]'>
                  Заметок пока нет.
                </p>
              ) : (
                sortedNotes.map((note) => {
                  const isSelected = note.id === selectedNoteId && mode !== 'create';
                  const isMenuOpen = openMenuNoteId === note.id;
                  const isBusy = busyNoteId === note.id;

                  return (
                    <div
                      key={note.id}
                      className={`relative flex items-start gap-2 rounded-xl border px-3 py-2 transition-colors ${
                        isSelected
                          ? 'border-[#c9d8f8] bg-[#edf3ff]'
                          : 'border-transparent bg-white hover:border-[#e3e9f3] hover:bg-[#f3f7ff]'
                      }`}
                    >
                      <button
                        type='button'
                        onClick={() => handleSelectNote(note.id)}
                        className='flex min-w-0 flex-1 flex-col gap-0.5 text-left'
                      >
                        <span className='truncate text-[14px] font-semibold text-[#1f3565]'>
                          {note.title?.trim() || 'Без названия'}
                        </span>
                        <span className='text-[11px] text-[#7e8fb4]'>
                          {formatNoteDateTime(note.created_at)}
                        </span>
                        {getNoteVisibility(note) === 'restricted' ? (
                          <span className='mt-1 w-fit rounded-md bg-[#fff4d6] px-2 py-0.5 text-[11px] font-semibold text-[#9a6a00]'>
                            Ограниченный доступ
                          </span>
                        ) : null}
                      </button>

                      <div className='flex shrink-0 items-center gap-1'>
                        {note.is_pinned ? (
                          <button
                            type='button'
                            onClick={() => void togglePin(note)}
                            disabled={isBusy}
                            className='grid size-6 place-items-center rounded-md text-[#2d6ff7] transition-colors hover:bg-[#dbe6ff] disabled:opacity-50'
                            title='Открепить'
                            aria-label='Открепить заметку'
                          >
                            <PinIcon filled />
                          </button>
                        ) : null}

                        <div className='relative'>
                          <button
                            type='button'
                            onClick={() => setOpenMenuNoteId(isMenuOpen ? null : note.id)}
                            disabled={isBusy}
                            className='grid size-6 place-items-center rounded-md text-[#7e8fb4] transition-colors hover:bg-[#edf3ff] hover:text-[#1f3565] disabled:opacity-50'
                            title='Действия'
                            aria-label='Меню действий заметки'
                          >
                            <span className='text-[16px] leading-none'>⋮</span>
                          </button>

                          {isMenuOpen ? (
                            <div
                              ref={menuRef}
                              className='absolute right-0 top-7 z-10 min-w-45 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white py-1 shadow-lg shadow-slate-900/10'
                            >
                              <MenuItem
                                icon={<PinIcon filled={note.is_pinned} />}
                                onClick={() => {
                                  setOpenMenuNoteId(null);
                                  void togglePin(note);
                                }}
                              >
                                {note.is_pinned ? 'Открепить' : 'Закрепить'}
                              </MenuItem>
                              {canCreateUpdateNotes ? (
                                <>
                                  <MenuItem
                                    icon={<EditIcon />}
                                    onClick={() => {
                                      setOpenMenuNoteId(null);
                                      beginEditingNote(note);
                                    }}
                                  >
                                    Редактировать
                                  </MenuItem>
                                  <MenuItem
                                    icon={<AccessIcon />}
                                    onClick={() => {
                                      setOpenMenuNoteId(null);
                                      openAccessDialog(note);
                                    }}
                                  >
                                    Изменить доступ
                                  </MenuItem>
                                </>
                              ) : null}
                              {canDeleteNotes ? (
                                <MenuItem
                                  danger
                                  icon={<TrashIcon />}
                                  onClick={() => {
                                    setOpenMenuNoteId(null);
                                    void deleteNote(note);
                                  }}
                                >
                                  Удалить
                                </MenuItem>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Details */}
          <div className='flex min-h-90 flex-col rounded-xl border border-[#e3e9f3] bg-white'>
            {isEditing ? (
              <div className='flex flex-1 flex-col gap-3 p-4'>
                <input
                  type='text'
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  placeholder='Название заметки'
                  className='h-10 w-full rounded-xl border border-[#c9d8f8] bg-white px-3 text-[16px] font-semibold text-[#10275a] placeholder:text-[#9aa8c7] focus:border-[#2d6ff7] focus:outline-none focus:ring-2 focus:ring-[#edf3ff]'
                />

                <div className='relative overflow-hidden rounded-xl border border-[#c9d8f8] bg-white'>
                  <div className='flex flex-wrap items-center gap-1 border-b border-[#e3e9f3] bg-[#fbfcff] p-2'>
                    <ToolbarButton
                      label='B'
                      title='Жирный'
                      isActive={editor?.isActive('bold')}
                      disabled={!editor}
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                    />
                    <ToolbarButton
                      label='I'
                      title='Курсив'
                      isActive={editor?.isActive('italic')}
                      disabled={!editor}
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                    />
                    <ToolbarButton
                      label='S'
                      title='Зачёркнутый'
                      isActive={editor?.isActive('strike')}
                      disabled={!editor}
                      onClick={() => editor?.chain().focus().toggleStrike().run()}
                    />
                    <ToolbarSeparator />
                    <ToolbarButton
                      label='H1'
                      title='Заголовок 1'
                      isActive={editor?.isActive('heading', { level: 1 })}
                      disabled={!editor}
                      onClick={() =>
                        editor?.chain().focus().toggleHeading({ level: 1 }).run()
                      }
                    />
                    <ToolbarButton
                      label='H2'
                      title='Заголовок 2'
                      isActive={editor?.isActive('heading', { level: 2 })}
                      disabled={!editor}
                      onClick={() =>
                        editor?.chain().focus().toggleHeading({ level: 2 }).run()
                      }
                    />
                    <ToolbarButton
                      label='H3'
                      title='Заголовок 3'
                      isActive={editor?.isActive('heading', { level: 3 })}
                      disabled={!editor}
                      onClick={() =>
                        editor?.chain().focus().toggleHeading({ level: 3 }).run()
                      }
                    />
                    <ToolbarButton
                      label='•'
                      title='Маркированный список'
                      isActive={editor?.isActive('bulletList')}
                      disabled={!editor}
                      onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    />
                    <ToolbarButton
                      label='1.'
                      title='Нумерованный список'
                      isActive={editor?.isActive('orderedList')}
                      disabled={!editor}
                      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                    />
                    <ToolbarButton
                      label='❝'
                      title='Цитата'
                      isActive={editor?.isActive('blockquote')}
                      disabled={!editor}
                      onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                    />
                    <ToolbarSeparator />
                    <ToolbarButton
                      label={
                        <svg
                          viewBox='0 0 24 24'
                          className='size-4 fill-none stroke-current stroke-[1.7] [stroke-linecap:round] [stroke-linejoin:round]'
                          aria-hidden='true'
                        >
                          <path d='M10 13a5 5 0 0 0 7 0l3-3a5 5 0 1 0-7-7l-1 1' />
                          <path d='M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 1 0 7 7l1-1' />
                        </svg>
                      }
                      title='Вставить ссылку'
                      isActive={editor?.isActive('link')}
                      disabled={!editor}
                      onClick={addNoteLink}
                    />
                    <ToolbarButton
                      label={
                        <svg
                          viewBox='0 0 24 24'
                          className='size-4 fill-none stroke-current stroke-[1.7] [stroke-linecap:round] [stroke-linejoin:round]'
                          aria-hidden='true'
                        >
                          <rect x='3' y='5' width='18' height='14' rx='2' />
                          <circle cx='8' cy='10' r='1.5' />
                          <path d='m21 15-5-5L5 19' />
                        </svg>
                      }
                      title={
                        uploadNoteIdRef.current
                          ? isUploadingImage
                            ? 'Загрузка изображения...'
                            : 'Вставить изображение'
                          : 'Картинки можно добавлять только в созданную заметку'
                      }
                      disabled={!editor || isUploadingImage}
                      onClick={handleInsertNoteImageClick}
                    />
                    <input
                      ref={noteImageInputRef}
                      type='file'
                      accept='image/jpeg,image/png,image/gif,image/webp'
                      hidden
                      onChange={(event) =>
                        void handleNoteImageInputChange(event.target.files)
                      }
                    />
                    <ToolbarSeparator />
                    <ToolbarButton
                      label='↶'
                      title='Отменить'
                      disabled={!editor?.can().undo()}
                      onClick={() => editor?.chain().focus().undo().run()}
                    />
                    <ToolbarButton
                      label='↷'
                      title='Повторить'
                      disabled={!editor?.can().redo()}
                      onClick={() => editor?.chain().focus().redo().run()}
                    />
                  </div>

                  <EditorContent
                    editor={editor}
                    className='[&_.ProseMirror]:min-h-65 [&_.ProseMirror_a]:font-semibold [&_.ProseMirror_a]:text-[#2d6ff7] [&_.ProseMirror_a]:underline [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-[#c9d8f8] [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_h1]:mt-5 [&_.ProseMirror_h1]:text-[26px] [&_.ProseMirror_h1]:leading-tight [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h2]:mt-4 [&_.ProseMirror_h2]:text-[20px] [&_.ProseMirror_h2]:leading-tight [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:mt-3 [&_.ProseMirror_h3]:text-[16px] [&_.ProseMirror_h3]:leading-tight [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_img]:my-2 [&_.ProseMirror_img]:block [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:cursor-zoom-in [&_.ProseMirror_li]:my-1 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_p]:my-2 [&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6'
                  />

                  {isUploadingImage ? (
                    <div className='absolute inset-0 z-10 grid place-items-center bg-white/75 backdrop-blur-[1px]'>
                      <div className='flex items-center gap-2 rounded-lg border border-[#e3e9f3] bg-white px-4 py-3 text-[13px] font-medium text-[#1f3565] shadow-sm'>
                        <span
                          className='size-5 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]'
                          aria-hidden='true'
                        />
                        Загрузка изображения...
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className='flex flex-wrap justify-end gap-2'>
                  <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    Отмена
                  </Button>
                  <Button
                    type='button'
                    variant='primary'
                    size='sm'
                    onClick={() => void saveDraft()}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </div>
              </div>
            ) : selectedNote ? (
              <>
                <div className='flex flex-wrap items-start justify-between gap-3 border-b border-[#e3e9f3] px-4 py-3'>
                  <h4 className='min-w-0 truncate text-[20px] font-semibold text-[#10275a]'>
                    {selectedNote.title?.trim() || 'Без названия'}
                  </h4>
                  <div className='flex shrink-0 flex-wrap gap-2'>
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      onClick={() => void copyNoteLink(selectedNote)}
                    >
                      Скопировать ссылку
                    </Button>
                    {canCreateUpdateNotes ? (
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={startEdit}
                        disabled={busyNoteId === selectedNote.id}
                      >
                        Редактировать
                      </Button>
                    ) : null}
                    {canDeleteNotes ? (
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() => void deleteNote(selectedNote)}
                        disabled={busyNoteId === selectedNote.id}
                        className='border-[#ffd7dd]! text-[#c83f52]! hover:bg-[#fff1f3]!'
                      >
                        Удалить
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div
                  className='flex-1 overflow-auto px-4 py-3 text-[14px] leading-relaxed text-[#1f3565] [&_a]:font-semibold [&_a]:text-[#2d6ff7] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#c9d8f8] [&_blockquote]:pl-4 [&_h1]:mt-5 [&_h1]:text-[26px] [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-[16px] [&_h3]:font-semibold [&_img]:my-2 [&_img]:block [&_img]:max-w-full [&_img]:rounded-lg [&_img]:cursor-zoom-in [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6'
                  onClick={(event) => {
                    const target = event.target;
                    if (target instanceof HTMLImageElement) {
                      setSelectedNoteImage({
                        src: target.currentSrc || target.src,
                        alt: target.alt || 'Изображение заметки',
                      });
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: selectedNoteHtml }}
                />

                <div className='border-t border-[#e3e9f3] bg-[#fbfcff] px-4 py-2.5 text-[12px] text-[#7e8fb4]'>
                  {getNoteVisibility(selectedNote) === 'restricted' ? (
                    <div className='mb-2 rounded-lg border border-[#ffe3a3] bg-[#fff9e8] px-3 py-2 text-[#7c5a0a]'>
                      <p className='font-semibold text-[#9a6a00]'>Ограниченный доступ</p>
                      <p>
                        Доступно:{' '}
                        {selectedNoteAccessLabels.length > 0
                          ? selectedNoteAccessLabels.join(', ')
                          : 'только автору'}
                      </p>
                    </div>
                  ) : null}
                  <p>Автор: {formatName(selectedNote.author)}</p>
                  <p>
                    Кем изменено:{' '}
                    {formatName(selectedNote.changed_by ?? selectedNote.author)}
                  </p>
                  <p>
                    Последнее обновление:{' '}
                    {formatNoteDateTime(
                      selectedNote.updated_at ?? selectedNote.created_at,
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className='grid flex-1 place-items-center px-4 py-10 text-center text-[13px] text-[#7e8fb4]'>
                {sortedNotes.length === 0
                  ? 'Создайте первую заметку, чтобы она появилась здесь.'
                  : 'Выберите заметку из списка слева.'}
              </div>
            )}
          </div>
        </div>
      </section>

      {accessNote ? (
        <NoteAccessDialog
          note={accessNote}
          visibility={accessVisibility}
          visibleUserIds={accessVisibleUserIds}
          roleValues={accessRoleValues}
          roleOptions={roleOptionItems}
          visibleUserOptions={visibleUserOptions}
          error={accessVisibleUserIdsError}
          isSaving={isSavingAccess}
          onVisibilityChange={(nextVisibility) => {
            setAccessVisibility(nextVisibility);
            if (nextVisibility === 'restricted') {
              setAccessVisibleUserIds((current) => ensureUserId(current, user?.id));
            }
            setAccessVisibleUserIdsError(null);
          }}
          onRoleValuesChange={(nextRoles) => {
            setAccessRoleValues(nextRoles);
            setAccessVisibleUserIdsError(null);
          }}
          onVisibleUserIdsChange={(nextUserIds) => {
            setAccessVisibleUserIds(ensureUserId(nextUserIds, user?.id));
            setAccessVisibleUserIdsError(null);
          }}
          onClose={() => {
            setAccessNote(null);
            setAccessVisibleUserIdsError(null);
          }}
          onSubmit={() => void saveAccess()}
          currentUserId={user?.id}
        />
      ) : null}

      {selectedNoteImage ? (
        <ImageViewerModal
          isOpen
          src={selectedNoteImage.src}
          alt={selectedNoteImage.alt}
          onClose={() => setSelectedNoteImage(null)}
        />
      ) : null}
    </>
  );
}

function NoteAccessDialog({
  note,
  visibility,
  visibleUserIds,
  roleValues,
  roleOptions,
  visibleUserOptions,
  currentUserId,
  error,
  isSaving,
  onVisibilityChange,
  onRoleValuesChange,
  onVisibleUserIdsChange,
  onClose,
  onSubmit,
}: {
  note: ProjectNote;
  visibility: NoteVisibility;
  visibleUserIds: string[];
  roleValues: string[];
  roleOptions: Array<{ value: string; label: string }>;
  visibleUserOptions: Array<{ value: string; label: string }>;
  currentUserId?: string;
  error: string | null;
  isSaving: boolean;
  onVisibilityChange: (_nextVisibility: NoteVisibility) => void;
  onRoleValuesChange: (_nextRoles: string[]) => void;
  onVisibleUserIdsChange: (_nextUserIds: string[]) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);

  return (
    <div
      role='dialog'
      aria-modal='true'
      className='fixed inset-0 z-1000 grid place-items-center overflow-y-auto bg-slate-900/40 p-4 text-[#1f3565]'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose) onClose();
      }}
    >
      <section
        className='max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-visible rounded-2xl border border-[#e3e9f3] bg-white p-4 shadow-2xl shadow-slate-900/20'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h2 className='text-base font-semibold text-[#1f3565]'>
              Доступ: {note.title?.trim() || 'Без названия'}
            </h2>
          </div>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={onClose}
            disabled={isSaving}
          >
            Закрыть
          </Button>
        </div>

        <form
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Field label='Видимость'>
            <div className='grid grid-cols-1 gap-1 rounded-lg border border-slate-300 bg-white p-1 sm:grid-cols-2'>
              <button
                type='button'
                onClick={() => onVisibilityChange('project')}
                className={`min-h-10 rounded-md px-3 py-1.5 text-left text-[13px] font-semibold transition-colors ${
                  visibility === 'project'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Всем участникам проекта
              </button>
              <button
                type='button'
                onClick={() => onVisibilityChange('restricted')}
                className={`min-h-10 rounded-md px-3 py-1.5 text-left text-[13px] font-semibold transition-colors ${
                  visibility === 'restricted'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Выбранным участникам
              </button>
            </div>
          </Field>

          {visibility === 'restricted' ? (
            <>
              <Field label='Роли'>
                <MultiSelect
                  values={roleValues}
                  onValuesChange={onRoleValuesChange}
                  options={roleOptions}
                  placeholder='Выберите роли'
                  disabled={isSaving}
                />
              </Field>
              <Field label='Пользователи'>
                <MultiSelect
                  values={visibleUserIds}
                  onValuesChange={onVisibleUserIdsChange}
                  options={visibleUserOptions}
                  disabledValues={currentUserId ? [currentUserId] : []}
                  searchable
                  placeholder='Выберите сотрудников'
                  emptyText='В проекте нет участников для выбора'
                  disabled={isSaving}
                />
                {error ? (
                  <p className='text-[12px] font-medium text-[#c83f52]'>{error}</p>
                ) : null}
              </Field>
            </>
          ) : null}

          <Button type='submit' disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить доступы'}
          </Button>
        </form>
      </section>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger = false,
  icon,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${
        danger ? 'text-[#c83f52] hover:bg-[#fff1f3]' : 'text-[#1f3565] hover:bg-[#f3f7ff]'
      }`}
    >
      {icon ? (
        <span className='grid size-4 shrink-0 place-items-center'>{icon}</span>
      ) : null}
      <span className='flex-1'>{children}</span>
    </button>
  );
}

function ToolbarButton({
  label,
  title,
  isActive,
  disabled,
  onClick,
}: {
  label: ReactNode;
  title: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      title={title}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-lg border text-[12px] font-semibold transition-colors duration-150 ${
        isActive
          ? 'border-[#2d6ff7] bg-[#edf3ff] text-[#2d6ff7]'
          : 'border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ToolbarSeparator() {
  return <span className='mx-0.5 h-6 w-px bg-[#e3e9f3]' aria-hidden='true' />;
}

function PinIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      viewBox='0 0 24 24'
      className='size-4 fill-none stroke-current stroke-[1.8]'
      aria-hidden='true'
    >
      <line x1='12' y1='17' x2='12' y2='22' />
      <path d='M5 17h14v-1.5c0-1.8-1-3-2-4.5V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5c-1 1.5-2 2.7-2 4.5z' />
      {filled ? <line x1='3' y1='3' x2='21' y2='21' /> : null}
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
      aria-hidden='true'
    >
      <path d='m3 21 3.8-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L3 21Z' />
      <path d='m14.5 6.5 3 3' />
    </svg>
  );
}

function AccessIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
      aria-hidden='true'
    >
      <path d='M16 11V7a4 4 0 0 0-8 0v4' />
      <rect x='5' y='11' width='14' height='10' rx='2' />
      <path d='M12 15v2' />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      className='size-4 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
      aria-hidden='true'
    >
      <path d='M3 6h18' />
      <path d='M8 6V4h8v2' />
      <path d='M19 6l-1 14H6L5 6' />
      <path d='M10 11v6M14 11v6' />
    </svg>
  );
}
