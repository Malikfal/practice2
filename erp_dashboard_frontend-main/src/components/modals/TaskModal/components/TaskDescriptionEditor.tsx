import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { API_URL } from '../../../../constants/app';
import ImageViewerModal from '../../ImageViewerModal';
import type { TaskCreateForm } from '../../../../types/app';
import { importPastedExternalImages } from '../../../../utils/externalEditorImages';
import { joinClassNames } from '../shared';

const DESCRIPTION_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

function resolveTaskDescriptionImageUrl(url?: string | null) {
  const value = String(url ?? '').trim();
  if (!value) return '';
  if (/^(blob:|data:|https?:\/\/)/i.test(value)) return value;

  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

function normalizeTaskDescriptionImages(content: string) {
  if (typeof DOMParser === 'undefined') {
    return content.replace(
      /(<img\b[^>]*\bsrc=["'])(\/task-description-images\/[^"']+)(["'][^>]*>)/gi,
      (_match, before: string, src: string, after: string) =>
        `${before}${resolveTaskDescriptionImageUrl(src)}${after}`,
    );
  }

  const document = new DOMParser().parseFromString(content, 'text/html');
  document.querySelectorAll('img').forEach((image) => {
    const resolvedSrc = resolveTaskDescriptionImageUrl(image.getAttribute('src'));

    if (resolvedSrc) {
      image.setAttribute('src', resolvedSrc);
    }
  });

  return document.body.innerHTML;
}

function getImageFiles(files: FileList | File[]) {
  return Array.from(files).filter((file) => file.type.startsWith('image/'));
}

export default function TaskDescriptionEditor({
  canEditTasks,
  projectId,
  taskId,
  form,
  onChange,
}: {
  canEditTasks: boolean;
  projectId: string;
  taskId: string;
  form: TaskCreateForm;
  onChange: (_nextForm: TaskCreateForm) => void;
}) {
  const descriptionImageInputRef = useRef<HTMLInputElement | null>(null);
  const latestFormRef = useRef(form);
  const [editorTextLength, setEditorTextLength] = useState(0);
  const [isUploadingDescriptionImage, setIsUploadingDescriptionImage] = useState(false);
  const [selectedDescriptionImage, setSelectedDescriptionImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  latestFormRef.current = form;

  const importTarget = useRef({ projectId, taskId });
  importTarget.current = { projectId, taskId };

  const importDescriptionImage = async (url: string) => {
    const target = importTarget.current;
    if (!target.taskId || !target.projectId) {
      throw new Error(
        'Картинки с других сайтов копируются только в созданную задачу. Сохраните задачу и вставьте текст ещё раз.',
      );
    }

    const response = await api.workspace.projects.importTaskDescriptionImage(
      target.projectId,
      target.taskId,
      url,
    );
    return resolveTaskDescriptionImageUrl(response.url);
  };

  const uploadDescriptionImages = async (files: FileList | File[]) => {
    const imageFiles = getImageFiles(files);
    if (!imageFiles.length) return [];
    if (isUploadingDescriptionImage) return [];

    if (!taskId) {
      toast.info('Картинки можно добавлять только в созданную задачу.');
      return [];
    }
    if (!projectId) {
      toast.error('Не удалось определить проект для загрузки картинки.');
      return [];
    }

    const oversized = imageFiles.find((file) => file.size > DESCRIPTION_IMAGE_MAX_BYTES);
    if (oversized) {
      toast.error(`Файл «${oversized.name}» больше 20 МБ.`);
      return [];
    }

    try {
      setIsUploadingDescriptionImage(true);
      const uploadedImages = [];

      for (const file of imageFiles) {
        const { url } = await api.workspace.projects.uploadTaskDescriptionImage(
          projectId,
          taskId,
          file,
        );

        uploadedImages.push({
          src: resolveTaskDescriptionImageUrl(url),
          alt: file.name.replace(/\.[^.]+$/, ''),
        });
      }

      return uploadedImages;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить изображение.',
      );
      return [];
    } finally {
      setIsUploadingDescriptionImage(false);
      if (descriptionImageInputRef.current) {
        descriptionImageInputRef.current.value = '';
      }
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Image.configure({
        allowBase64: false,
      }),
    ],
    editable: canEditTasks,
    content: normalizeTaskDescriptionImages(form.description ?? ''),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'tm-editor min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto break-words px-3 py-2 text-[14px] leading-6 text-slate-800 outline-none',
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (!files?.length || !getImageFiles(files).length) return false;

        event.preventDefault();
        void insertDescriptionImages(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length || !getImageFiles(files).length) return false;

        event.preventDefault();
        void insertDescriptionImages(files);
        return true;
      },
      handleClick: (_view, _position, event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement)) return false;

        event.preventDefault();
        setSelectedDescriptionImage({
          src: target.currentSrc || target.src,
          alt: target.alt || 'Изображение задачи',
        });
        return true;
      },
    },
    onUpdate: ({ editor: activeEditor, transaction }) => {
      importPastedExternalImages(activeEditor, transaction, importDescriptionImage);

      const textLength = activeEditor.getText().length;
      setEditorTextLength(textLength);

      const html = activeEditor.getHTML();
      const currentForm = latestFormRef.current;
      if (currentForm.description === html) return;

      onChange({ ...currentForm, description: html });
    },
  });

  useEffect(() => {
    if (!editor) return;

    editor.setEditable(canEditTasks);
  }, [canEditTasks, editor]);

  useEffect(() => {
    if (!editor) return;

    const nextContent = normalizeTaskDescriptionImages(form.description ?? '');
    if (editor.getHTML() === nextContent) return;

    editor.commands.setContent(nextContent, { emitUpdate: false });
    setEditorTextLength(editor.getText().length);
  }, [editor, form.description]);

  const insertDescriptionImages = async (files: FileList | File[]) => {
    if (!editor) return;

    const uploadedImages = await uploadDescriptionImages(files);
    for (const image of uploadedImages) {
      editor.chain().focus().setImage(image).run();
    }
  };

  const handleDescriptionImageChange = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const imageFiles = getImageFiles(fileList);
    if (!imageFiles.length) {
      toast.error('Можно загрузить только изображение.');
      return;
    }

    await insertDescriptionImages(imageFiles);
  };

  const handleInsertDescriptionImageClick = () => {
    if (!canEditTasks || isUploadingDescriptionImage) return;

    if (!taskId) {
      toast.info('Картинки можно добавлять только в созданную задачу.');
      return;
    }

    descriptionImageInputRef.current?.click();
  };

  const addLink = () => {
    if (!editor || !canEditTasks) return;

    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Введите URL ссылки', previousUrl ?? '');
    if (url === null) return;

    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const isToolbarDisabled = !editor || !canEditTasks;

  return (
    <>
      <div className='flex h-full flex-1 min-h-[320px] min-w-0 max-w-full flex-col gap-2 overflow-hidden lg:min-h-0'>
        <span className='text-[13px] leading-tight font-medium text-slate-700'>
          Описание
        </span>
        <div className='relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-300 bg-white'>
          <style>{`
          .tm-editor p { margin: 0.35rem 0; }
          .tm-editor p:first-child { margin-top: 0; }
          .tm-editor p:last-child { margin-bottom: 0; }
          .tm-editor h1 { font-size: 1.5rem; font-weight: 700; margin: 0.4em 0; }
          .tm-editor h2 { font-size: 1.25rem; font-weight: 700; margin: 0.4em 0; }
          .tm-editor ul { list-style: disc; padding-left: 1.5rem; }
          .tm-editor ol { list-style: decimal; padding-left: 1.5rem; }
          .tm-editor blockquote {
            border-left: 3px solid #cbd5e1;
            padding-left: 0.75rem;
            color: #475569;
            margin: 0.4em 0;
          }
          .tm-editor a { color: #2563eb; text-decoration: underline; }
          .tm-editor img {
            display: block;
            max-width: 100%;
            height: auto;
            margin: 0.5rem 0;
            border-radius: 0.5rem;
            cursor: zoom-in;
          }
          .tm-editor.ProseMirror:empty:before {
            content: 'Опишите задачу…';
            color: #94a3b8;
            pointer-events: none;
            float: left;
            height: 0;
          }
        `}</style>
          {canEditTasks ? (
            <div className='flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5'>
              <ToolbarTextButton
                title='Жирный'
                disabled={isToolbarDisabled}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                B
              </ToolbarTextButton>
              <ToolbarTextButton
                title='Курсив'
                italic
                disabled={isToolbarDisabled}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                I
              </ToolbarTextButton>
              <ToolbarTextButton
                title='Зачёркнутый'
                disabled={isToolbarDisabled}
                onClick={() => editor?.chain().focus().toggleStrike().run()}
              >
                S
              </ToolbarTextButton>
              <ToolbarTextButton
                title='Заголовок 1'
                disabled={isToolbarDisabled}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              >
                H1
              </ToolbarTextButton>
              <ToolbarTextButton
                title='Заголовок 2'
                disabled={isToolbarDisabled}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                H2
              </ToolbarTextButton>

              <span className='mx-1 h-5 w-px bg-slate-200' aria-hidden='true' />

              <ToolbarIcon
                title='Маркированный список'
                disabled={isToolbarDisabled}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <line x1='8' y1='6' x2='21' y2='6' />
                <line x1='8' y1='12' x2='21' y2='12' />
                <line x1='8' y1='18' x2='21' y2='18' />
                <circle cx='4' cy='6' r='1' fill='currentColor' stroke='none' />
                <circle cx='4' cy='12' r='1' fill='currentColor' stroke='none' />
                <circle cx='4' cy='18' r='1' fill='currentColor' stroke='none' />
              </ToolbarIcon>
              <ToolbarIcon
                title='Нумерованный список'
                disabled={isToolbarDisabled}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              >
                <line x1='10' y1='6' x2='21' y2='6' />
                <line x1='10' y1='12' x2='21' y2='12' />
                <line x1='10' y1='18' x2='21' y2='18' />
                <path d='M4 6h1v4' />
                <path d='M4 10h2' />
                <path d='M6 18H4c0-1 2-2 2-3s-1-1.5-2-1' />
              </ToolbarIcon>
              <ToolbarIcon
                title='Цитата'
                disabled={isToolbarDisabled}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              >
                <path d='M7 7h4v4H7c0 2 1 4 3 4v2c-3 0-6-2-6-6V7z' />
                <path d='M15 7h4v4h-4c0 2 1 4 3 4v2c-3 0-6-2-6-6V7z' />
              </ToolbarIcon>
              <ToolbarIcon
                title='Вставить ссылку'
                disabled={isToolbarDisabled}
                onClick={addLink}
              >
                <path d='M10 13a5 5 0 0 0 7 0l3-3a5 5 0 1 0-7-7l-1 1' />
                <path d='M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 1 0 7 7l1-1' />
              </ToolbarIcon>
              <ToolbarIcon
                title={
                  taskId
                    ? isUploadingDescriptionImage
                      ? 'Загрузка изображения...'
                      : 'Вставить изображение'
                    : 'Картинки можно добавлять только в созданную задачу'
                }
                disabled={!canEditTasks || isUploadingDescriptionImage}
                onClick={handleInsertDescriptionImageClick}
              >
                <rect x='3' y='5' width='18' height='14' rx='2' />
                <circle cx='8' cy='10' r='1.5' />
                <path d='m21 15-5-5L5 19' />
              </ToolbarIcon>
              <input
                ref={descriptionImageInputRef}
                type='file'
                accept='image/jpeg,image/png,image/gif,image/webp'
                hidden
                onChange={(event) =>
                  void handleDescriptionImageChange(event.target.files)
                }
              />

              <span className='ml-auto flex items-center gap-1'>
                <ToolbarIcon
                  title='Отменить'
                  disabled={!editor?.can().undo()}
                  onClick={() => editor?.chain().focus().undo().run()}
                >
                  <path d='M9 14 4 9l5-5' />
                  <path d='M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11' />
                </ToolbarIcon>
                <ToolbarIcon
                  title='Повторить'
                  disabled={!editor?.can().redo()}
                  onClick={() => editor?.chain().focus().redo().run()}
                >
                  <path d='m15 14 5-5-5-5' />
                  <path d='M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13' />
                </ToolbarIcon>
              </span>
            </div>
          ) : null}

          <EditorContent
            editor={editor}
            className={joinClassNames(
              'flex min-h-0 flex-1 flex-col overflow-hidden',
              !canEditTasks && 'cursor-default',
            )}
          />

          <div
            className={joinClassNames(
              'flex justify-end border-t border-slate-100 px-3 py-1.5 text-[12px] text-slate-400',
            )}
          >
            {editorTextLength}
          </div>

          {isUploadingDescriptionImage ? (
            <div className='absolute inset-0 z-10 grid place-items-center bg-white/75 backdrop-blur-[1px]'>
              <div className='flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-4 py-3 text-[13px] font-medium text-slate-700 shadow-sm'>
                <span
                  className='size-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700'
                  aria-hidden='true'
                />
                Загрузка изображения...
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {selectedDescriptionImage ? (
        <ImageViewerModal
          isOpen
          src={selectedDescriptionImage.src}
          alt={selectedDescriptionImage.alt}
          onClose={() => setSelectedDescriptionImage(null)}
        />
      ) : null}
    </>
  );
}

function ToolbarIcon({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      title={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className='grid h-7 w-7 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
    >
      <svg
        viewBox='0 0 24 24'
        className='size-4 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]'
        aria-hidden='true'
      >
        {children}
      </svg>
    </button>
  );
}

function ToolbarTextButton({
  title,
  disabled,
  onClick,
  italic = false,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  italic?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      title={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={joinClassNames(
        'grid h-7 min-w-7 place-items-center rounded-md px-2 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50',
        italic && 'italic',
      )}
    >
      {children}
    </button>
  );
}
