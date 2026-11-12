import type { KnowledgeBaseArticle } from '../../../../types/app';
import {
  formatArticleAuthor,
  formatKnowledgeBaseAccessSummary,
  formatKnowledgeBaseDate,
  getArticleStatusLabel,
  prepareKnowledgeBaseContentHtml,
} from './knowledgeBaseShared';
import PinIcon from './PinIcon';

type Props = {
  article: KnowledgeBaseArticle;
};

export default function KnowledgeBaseArticleViewer({ article }: Props) {
  const authorName = formatArticleAuthor(article.author);
  const content = prepareKnowledgeBaseContentHtml(article.content);
  const accessSummary = formatKnowledgeBaseAccessSummary(article.access, {
    type: 'article',
    folderId: article.folder_id,
  });

  return (
    <article className='mx-auto max-w-4xl pb-10'>
      <div className='mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-medium text-[#5d7098]'>
        <span className='inline-flex items-center gap-2'>
          <span className='grid size-6 place-items-center rounded-full bg-[#2d6ff7] text-[10px] font-bold text-white'>
            {authorName.slice(0, 1)}
          </span>
          {authorName}
        </span>
        <span>Создан {formatKnowledgeBaseDate(article.created_at ?? '')}</span>
        <span>Обновлен {formatKnowledgeBaseDate(article.updated_at ?? '')}</span>
        <span>{accessSummary}</span>
        <span
          className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${
            article.is_archive
              ? 'bg-[#edf1f7] text-[#5d7098]'
              : 'bg-[#edf3ff] text-[#2d6ff7]'
          }`}
        >
          {getArticleStatusLabel(article)}
        </span>
        {article.is_pinned ? (
          <span
            className='inline-flex size-5 items-center justify-center text-[#1f3565]'
            title='Закреплена'
            aria-label='Закреплена'
          >
            <PinIcon className='size-4 text-[#1f3565]' />
          </span>
        ) : null}
      </div>

      <h1 className='mb-4 text-[30px] leading-tight font-semibold text-[#0b1f3f]'>
        {article.title}
      </h1>
      <div className='h-1 w-full max-w-3xl rounded-full bg-[#d9dee8]' />

      <div
        className='mt-6 text-[15px] leading-7 text-[#0f2448] [&_a]:font-semibold [&_a]:text-[#2d6ff7] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#c9d8f8] [&_blockquote]:pl-4 [&_figure]:my-5 [&_h1]:mt-8 [&_h1]:text-[30px] [&_h1]:leading-tight [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-[24px] [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-[20px] [&_h3]:leading-tight [&_h3]:font-semibold [&_hr]:my-6 [&_hr]:border-[#d9dee8] [&_img]:max-h-130 [&_img]:w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-[#e3e9f3] [&_img]:object-contain [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6'
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </article>
  );
}
