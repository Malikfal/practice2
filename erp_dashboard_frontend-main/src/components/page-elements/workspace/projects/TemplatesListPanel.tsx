import { useMemo } from 'react';
import Button from '../../../ui/Button';
import type { Template } from '../../../../types/app';

type Props = {
  templates: Template[];
  isLoading: boolean;
  searchQuery: string;
  selectedTemplateId: string;
  onSearchQueryChange: (_value: string) => void;
  onSelectTemplate: (_templateId: string) => void;
  onOpenCreateModal: () => void;
  onExitTemplates: () => void;
  onTogglePinTemplate?: (_template: Template) => void;
};

export default function TemplatesListPanel({
  templates,
  isLoading,
  searchQuery,
  selectedTemplateId,
  onSearchQueryChange,
  onSelectTemplate,
  onOpenCreateModal,
  onExitTemplates,
  onTogglePinTemplate,
}: Props) {
  const sortedTemplates = useMemo(() => {
    return [...templates].sort((l, r) => {
      if (l.is_pinned !== r.is_pinned) {
        return l.is_pinned ? -1 : 1;
      }
      return 0;
    });
  }, [templates]);

  return (
    <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-4 text-[#1f3565]'>
      <div className='mb-3 flex items-center justify-between gap-2'>
        <h2 className='text-[12px] leading-none font-semibold'>Шаблоны</h2>
        <Button
          type='button'
          variant='secondary'
          size='sm'
          className='h-auto! min-h-0! rounded-xl border-[#bad0ff] bg-[#edf3ff] px-2! py-1! text-[12px] leading-normal font-semibold text-[#2d6ff7] hover:bg-[#edf3ff]'
          onClick={onOpenCreateModal}
        >
          + Добавить
        </Button>
      </div>

      <label className='mb-3 flex items-center gap-2 rounded-xl border border-[#e3e9f3] px-2 py-1 text-[12px] text-[#7e8fb4]'>
        <svg className='size-4 fill-none stroke-current stroke-[1.8]' viewBox='0 0 24 24'>
          <circle cx='11' cy='11' r='7' />
          <path d='m20 20-3.5-3.5' />
        </svg>
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder='Поиск'
          className='min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-[#1f3565] outline-none placeholder:text-[#7e8fb4]'
        />
      </label>

      <ul className='grid min-h-0 flex-1 content-start gap-1 overflow-auto p-0'>
        {isLoading ? (
          <li className='flex items-center justify-center py-8'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
          </li>
        ) : !sortedTemplates.length ? (
          <li className='py-1 text-center text-sm font-medium text-slate-500'>
            Шаблоны не найдены
          </li>
        ) : (
          sortedTemplates.map((template) => (
            <li
              key={template.id}
              className={`grid min-w-0 cursor-pointer gap-2 rounded-xl border p-2 transition-colors duration-150 ${
                selectedTemplateId === template.id
                  ? 'border-[#c9d8f8] bg-[#edf2fb]'
                  : 'border-[#e3e9f3] bg-white hover:border-[#c9d8f8] hover:bg-[#fbfcff]'
              }`}
              onClick={() => onSelectTemplate(template.id)}
            >
              <div className='flex min-w-0 items-start justify-between gap-2'>
                <div className='min-w-0 flex-1'>
                  <div className='flex min-w-0 flex-wrap items-center gap-1'>
                    <h3 className='min-w-0 truncate text-[13px] leading-snug font-semibold'>
                      {template.name}
                    </h3>
                    {template.is_default_template && (
                      <span className='inline-flex max-w-full shrink-0 whitespace-nowrap rounded-full border border-[#cfe0ff] bg-[#f3f7ff] px-1.5 py-0.5 text-[9px] leading-none font-semibold tracking-[0.01em] text-[#2d6ff7]'>
                        По умолчанию
                      </span>
                    )}
                  </div>
                  <div className='text-[11px] text-[#7e8fb4]'>
                    Участники: {template.members?.length ?? 0}
                  </div>
                  <div className='text-[11px] text-[#7e8fb4]'>
                    Статусы: {template.status_columns?.length ?? 0}
                  </div>
                </div>
                {onTogglePinTemplate && (
                  <button
                    type='button'
                    className={`rounded p-0.5 transition-colors hover:bg-[#f3f7ff] ${
                      template.is_pinned
                        ? 'text-[#2d6ff7]'
                        : 'text-[#7e8fb4] hover:text-[#2d6ff7]'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePinTemplate(template);
                    }}
                  >
                    <svg
                      className='size-4 fill-none stroke-current stroke-[1.8]'
                      viewBox='0 0 24 24'
                    >
                      <line x1='12' y1='17' x2='12' y2='22'></line>
                      <path d='M5 17h14v-1.5c0-1.8-1-3-2-4.5V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5c-1 1.5-2 2.7-2 4.5z'></path>
                      {template.is_pinned && <line x1='3' y1='3' x2='21' y2='21'></line>}
                    </svg>
                  </button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>

      <div className='mt-auto pt-3'>
        <Button
          type='button'
          variant='secondary'
          className='w-full rounded-xl border border-[#e3e9f3] bg-white py-3 text-[14px] font-medium text-[#1f3565] hover:bg-[#f3f7ff]'
          onClick={onExitTemplates}
        >
          <span className='inline-flex items-center gap-2'>
            <svg
              className='size-5 fill-none stroke-current stroke-[1.8]'
              viewBox='0 0 24 24'
            >
              <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
              <polyline points='16 17 21 12 16 7' />
              <line x1='21' y1='12' x2='9' y2='12' />
            </svg>
            Проекты
          </span>
        </Button>
      </div>
    </div>
  );
}
