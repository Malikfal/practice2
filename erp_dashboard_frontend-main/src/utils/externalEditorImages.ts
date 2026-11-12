import type { Editor, EditorEvents } from '@tiptap/react';
import { toast } from 'sonner';

import { API_URL } from '../constants/app';

type Transaction = EditorEvents['update']['transaction'];

const attemptedSources = new WeakMap<Editor, Set<string>>();

function isExternalImageSrc(src: unknown): src is string {
  if (typeof src !== 'string' || !/^https?:\/\//i.test(src)) return false;

  try {
    const { origin } = new URL(src);
    return origin !== new URL(API_URL).origin && origin !== window.location.origin;
  } catch {
    return false;
  }
}

function replaceImageSrc(editor: Editor, src: string, nextSrc: string) {
  if (editor.isDestroyed) return;

  const { tr } = editor.state;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'image' && node.attrs.src === src) {
      tr.setNodeMarkup(position, undefined, { ...node.attrs, src: nextSrc });
    }
  });

  if (tr.docChanged) editor.view.dispatch(tr.setMeta('addToHistory', false));
}

/**
 * Картинки, вставленные вместе с текстом из других сервисов, ссылаются на их файлы
 * и пропадают, когда сервис закрывает доступ. После вставки копируем их к себе.
 */
export function importPastedExternalImages(
  editor: Editor,
  transaction: Transaction,
  importImage: (_url: string) => Promise<string>,
) {
  const uiEvent = transaction.getMeta('uiEvent');
  if (uiEvent !== 'paste' && uiEvent !== 'drop') return;

  const attempted = attemptedSources.get(editor) ?? new Set<string>();
  attemptedSources.set(editor, attempted);

  const sources = new Set<string>();
  transaction.doc.descendants((node) => {
    const src: unknown = node.attrs.src;
    if (node.type.name === 'image' && isExternalImageSrc(src) && !attempted.has(src)) {
      sources.add(src);
    }
  });

  for (const src of sources) {
    attempted.add(src);
    importImage(src)
      .then((nextSrc) => replaceImageSrc(editor, src, nextSrc))
      .catch((error: unknown) => {
        const reason =
          error instanceof Error && error.message
            ? error.message
            : `Не удалось скопировать картинку с ${new URL(src).host}.`;

        toast.warning(reason, {
          description:
            'Картинка может перестать отображаться. Сохраните её на компьютер и вставьте файлом.',
          duration: 10000,
        });
      });
  }
}
