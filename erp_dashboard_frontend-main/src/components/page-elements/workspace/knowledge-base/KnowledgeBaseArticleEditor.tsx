import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { importPastedExternalImages } from '../../../../utils/externalEditorImages';
import { SearchableSelect } from '../../../ui/FormField';
import type {
  KnowledgeBaseArticleForm,
  KnowledgeBaseFolder,
} from '../../../../types/app';
import {
  prepareKnowledgeBaseContentHtml,
  sanitizeKnowledgeBaseContent,
} from './knowledgeBaseShared';
import KnowledgeBaseTextInputDialog, {
  type KnowledgeBaseTextInputDialogState,
} from './modals/KnowledgeBaseTextInputDialog';

type Props = {
  form: KnowledgeBaseArticleForm;
  folders: KnowledgeBaseFolder[];
  onChange: Dispatch<SetStateAction<KnowledgeBaseArticleForm>>;
  onUploadImage: (_file: File) => Promise<string | null>;
  onImportImage: (_url: string) => Promise<string>;
};

type ToolbarButton = {
  label: string;
  title: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getImageFiles(files: FileList | File[]) {
  return Array.from(files).filter((file) => file.type.startsWith('image/'));
}

function ToolbarButton({ label, title, isActive, disabled, onClick }: ToolbarButton) {
  return (
    <button
      type='button'
      title={title}
      disabled={disabled}
      className={`grid size-10 shrink-0 place-items-center rounded-lg border text-[12px] font-semibold transition-colors duration-150 md:size-8 ${
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

export default function KnowledgeBaseArticleEditor({
  form,
  folders,
  onChange,
  onUploadImage,
  onImportImage,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const importImageRef = useRef(onImportImage);
  const [linkDialog, setLinkDialog] = useState<KnowledgeBaseTextInputDialogState | null>(
    null,
  );
  const preparedContent = prepareKnowledgeBaseContentHtml(form.content || '');

  const insertImages = async (files: FileList | File[]) => {
    const imageFiles = getImageFiles(files);
    if (!imageFiles.length || !editorRef.current) return;

    for (const file of imageFiles) {
      try {
        const uploadedUrl = await onUploadImage(file);
        const imageUrl = uploadedUrl || (await readFileAsDataUrl(file));

        editorRef.current
          .chain()
          .focus()
          .setImage({
            src: imageUrl,
            alt: file.name.replace(/\.[^.]+$/, ''),
          })
          .run();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Не удалось вставить изображение.',
        );
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
        allowBase64: true,
      }),
    ],
    content: preparedContent,
    editorProps: {
      attributes: {
        class:
          'min-h-[50dvh] rounded-b-xl px-3 py-3 text-base leading-7 text-[#1f3565] outline-none md:min-h-[360px] md:px-4 md:text-[14px]',
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (!files?.length || !getImageFiles(files).length) return false;

        event.preventDefault();
        insertImages(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length || !getImageFiles(files).length) return false;

        event.preventDefault();
        insertImages(files);
        return true;
      },
    },
    onUpdate: ({ editor: activeEditor, transaction }) => {
      importPastedExternalImages(activeEditor, transaction, (url) =>
        importImageRef.current(url),
      );

      const nextContent = sanitizeKnowledgeBaseContent(activeEditor.getHTML());
      onChange((prev) =>
        prev.content === nextContent ? prev : { ...prev, content: nextContent },
      );
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    importImageRef.current = onImportImage;
  }, [onImportImage]);

  useEffect(() => {
    if (!editor) return;
    if (sanitizeKnowledgeBaseContent(editor.getHTML()) === preparedContent) return;

    editor.commands.setContent(preparedContent, { emitUpdate: false });
  }, [editor, preparedContent]);

  const addLink = () => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href as string | undefined;

    setLinkDialog({
      title: 'Ссылка',
      label: 'URL',
      defaultValue: previousUrl ?? '',
      placeholder: 'https://example.com',
      submitLabel: 'Применить',
      allowEmpty: true,
      onSubmit: (url) => {
        if (url.trim() === '') {
          editor.chain().focus().unsetLink().run();
          return;
        }

        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href: url.trim() })
          .run();
      },
    });
  };

  return (
    <>
      <div className='mx-auto grid min-h-full max-w-4xl grid-rows-[auto_auto_1fr] gap-3'>
        <label className='grid gap-1 text-[12px] font-semibold text-[#7e8fb4]'>
          Заголовок
          <input
            value={form.title}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, title: event.target.value }))
            }
            className='h-11 rounded-xl border border-[#e3e9f3] px-3 text-base font-medium text-[#1f3565] outline-none focus:border-[#2d6ff7] md:h-10 md:text-[14px]'
          />
        </label>

        <div className='grid grid-cols-2 gap-2 md:grid-cols-[minmax(240px,1fr)_180px_150px]'>
          <label className='col-span-2 grid gap-1 text-[12px] font-semibold text-[#7e8fb4] md:col-span-1'>
            Папка
            <SearchableSelect
              value={form.folder_id ?? ''}
              onValueChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  folder_id: value || null,
                }))
              }
              options={[
                { value: '', label: 'Без папки' },
                ...folders
                  .slice()
                  .sort((left, right) => left.name.localeCompare(right.name, 'ru'))
                  .map((folder) => ({ value: folder.id, label: folder.name })),
              ]}
              placeholder='Выберите папку'
              className='h-11 rounded-xl border-[#e3e9f3] text-base font-medium text-[#1f3565] focus:border-[#2d6ff7] md:h-10 md:text-[13px]'
            />
          </label>
          <label className='mt-auto flex h-11 items-center gap-2 rounded-xl border border-[#e3e9f3] px-3 text-[12px] font-semibold text-[#1f3565] md:h-10'>
            <input
              type='checkbox'
              checked={form.is_pinned}
              onChange={(event) =>
                onChange((prev) => ({ ...prev, is_pinned: event.target.checked }))
              }
              className='size-5 accent-[#2d6ff7] md:size-4'
            />
            Закрепить
          </label>
          <label className='mt-auto flex h-11 items-center gap-2 rounded-xl border border-[#e3e9f3] px-3 text-[12px] font-semibold text-[#1f3565] md:h-10'>
            <input
              type='checkbox'
              checked={form.is_archive}
              onChange={(event) =>
                onChange((prev) => ({ ...prev, is_archive: event.target.checked }))
              }
              className='size-5 accent-[#2d6ff7] md:size-4'
            />
            Архив
          </label>
        </div>

        <section className='overflow-hidden rounded-xl border border-[#e3e9f3] bg-white'>
          <div className='flex items-center gap-1 overflow-x-auto border-b border-[#e3e9f3] bg-[#fbfcff] p-2 md:flex-wrap md:overflow-visible'>
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
              label='H2'
              title='Заголовок'
              isActive={editor?.isActive('heading', { level: 2 })}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
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
              label='↗'
              title='Ссылка'
              isActive={editor?.isActive('link')}
              disabled={!editor}
              onClick={addLink}
            />
            <ToolbarButton
              label='▧'
              title='Изображение'
              disabled={!editor}
              onClick={() => fileInputRef.current?.click()}
            />
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
            className='[&_.ProseMirror_a]:font-semibold [&_.ProseMirror_a]:text-[#2d6ff7] [&_.ProseMirror_a]:underline [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-[#c9d8f8] [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_figure]:my-5 [&_.ProseMirror_h1]:mt-8 [&_.ProseMirror_h1]:text-[30px] [&_.ProseMirror_h1]:leading-tight [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h2]:text-[24px] [&_.ProseMirror_h2]:leading-tight [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:mt-5 [&_.ProseMirror_h3]:text-[20px] [&_.ProseMirror_h3]:leading-tight [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_hr]:my-6 [&_.ProseMirror_hr]:border-[#d9dee8] [&_.ProseMirror_img]:max-h-105 [&_.ProseMirror_img]:w-full [&_.ProseMirror_img]:rounded-xl [&_.ProseMirror_img]:border [&_.ProseMirror_img]:border-[#e3e9f3] [&_.ProseMirror_img]:object-contain [&_.ProseMirror_li]:my-1 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_p]:my-2 [&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6'
          />

          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            multiple
            className='hidden'
            onChange={(event) => {
              insertImages(event.target.files ?? []);
              event.target.value = '';
            }}
          />
        </section>
      </div>
      <KnowledgeBaseTextInputDialog
        state={linkDialog}
        onClose={() => setLinkDialog(null)}
      />
    </>
  );
}
