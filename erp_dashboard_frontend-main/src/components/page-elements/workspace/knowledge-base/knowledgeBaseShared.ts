import DOMPurify from 'dompurify';

import { API_URL } from '../../../../constants/app';
import type {
  KnowledgeBaseAccess,
  KnowledgeBaseArticle,
  KnowledgeBaseArticleForm,
} from '../../../../types/app';

export const emptyArticleForm: KnowledgeBaseArticleForm = {
  folder_id: null,
  title: '',
  content: '',
  is_archive: false,
  is_pinned: false,
};

export function canEditKnowledgeBase(permissions?: string[]) {
  return permissions?.includes('knowledge_base.create_update') ?? false;
}

export function canDeleteKnowledgeBase(permissions?: string[]) {
  return permissions?.includes('knowledge_base.delete') ?? false;
}

export function createFormFromArticle(
  article: KnowledgeBaseArticle | null,
): KnowledgeBaseArticleForm {
  if (!article) return emptyArticleForm;

  return {
    folder_id: article.folder_id ?? null,
    title: article.title ?? '',
    content: article.content ?? '',
    is_archive: article.is_archive,
    is_pinned: article.is_pinned,
  };
}

export function formatKnowledgeBaseDate(value?: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function resolveKnowledgeBaseAssetUrl(url?: string | null) {
  const value = String(url ?? '').trim();
  if (!value) return '';
  if (/^(blob:|data:|https?:\/\/)/i.test(value)) return value;

  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

export function normalizeKnowledgeBaseContentImages(content: string) {
  if (typeof DOMParser === 'undefined') {
    return content.replace(
      /(<img\b[^>]*\bsrc=["'])(\/knowledge-base\/images\/[^"']+)(["'][^>]*>)/gi,
      (_match, before: string, src: string, after: string) =>
        `${before}${resolveKnowledgeBaseAssetUrl(src)}${after}`,
    );
  }

  const document = new DOMParser().parseFromString(content, 'text/html');
  document.querySelectorAll('img').forEach((image) => {
    const src = image.getAttribute('src');
    const resolvedSrc = resolveKnowledgeBaseAssetUrl(src);

    if (resolvedSrc) {
      image.setAttribute('src', resolvedSrc);
    }
  });

  return document.body.innerHTML;
}

export function sanitizeKnowledgeBaseContent(content: string) {
  return DOMPurify.sanitize(content, {
    ADD_TAGS: ['img'],
    ADD_ATTR: ['target', 'rel'],
  });
}

export function prepareKnowledgeBaseContentHtml(content: string) {
  return sanitizeKnowledgeBaseContent(normalizeKnowledgeBaseContentImages(content));
}

export function formatArticleAuthor(author?: KnowledgeBaseArticle['author']) {
  if (!author) return 'Автор не указан';

  const fullName = [author.name, author.last_name].filter(Boolean).join(' ').trim();

  return fullName || author.email || 'Автор не указан';
}

export function getArticleStatusLabel(article: KnowledgeBaseArticle) {
  if (article.is_draft) return 'Черновик';
  if (article.is_archive) return 'Архив';

  return 'Активная';
}

export function formatKnowledgeBaseAccessSummary(
  access: KnowledgeBaseAccess | null | undefined,
  context: { type: 'folder' } | { type: 'article'; folderId: string | null },
) {
  const roles = access?.roles ?? [];
  const users = access?.users ?? [];

  if (!roles.length && !users.length) {
    if (context.type === 'folder') return 'Доступно всем';

    return context.folderId ? 'Доступ определяется папкой' : 'Доступно всем';
  }

  const parts = [
    roles.length ? `Роли: ${roles.map((role) => role.label).join(', ')}` : '',
    users.length
      ? `Пользователи: ${users
          .map(
            (user) => [user.name, user.last_name].filter(Boolean).join(' ') || user.email,
          )
          .join(', ')}`
      : '',
  ].filter(Boolean);

  return parts.join('. ');
}

export function isKnowledgeBaseContentEmpty(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return true;

  if (typeof DOMParser === 'undefined') {
    return !/<img\b/i.test(trimmed) && trimmed.replace(/<[^>]*>/g, '').trim() === '';
  }

  const document = new DOMParser().parseFromString(trimmed, 'text/html');
  const hasMedia = Boolean(document.body.querySelector('img'));

  return !hasMedia && (document.body.textContent ?? '').trim() === '';
}
