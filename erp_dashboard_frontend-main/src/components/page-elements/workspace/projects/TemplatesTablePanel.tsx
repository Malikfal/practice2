import Button from '../../../ui/Button';
import TablePagination from '../../../ui/TablePagination';
import {
  Table,
  TableActionButton,
  TableActions,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../ui/table';
import { formatName } from '../../../../utils/formatters';
import Icon from '../employees/components/Icon';
import type { Template, ProjectMember } from '../../../../types/app';

type Props = {
  templates: Template[];
  searchQuery: string;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onSearchQueryChange: (_value: string) => void;
  onPageChange: (_page: number) => void;
  onPageSizeChange: (_pageSize: number) => void;
  onOpenCreateModal: () => void;
  onEditTemplate: (_template: Template) => void;
  onCreateProjectFromTemplate: (_template: Template) => void;
  onDeleteTemplate: (_template: Template) => void;
  onExportTemplates?: () => void;
  onTogglePinTemplate?: (_template: Template) => void;
  canManageTemplates?: boolean;
};

function getInitials(name: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function MembersAvatars({ members }: { members: ProjectMember[] }) {
  if (!members || members.length === 0) {
    return <span className='text-[13px] text-[#7e8fb4]'>—</span>;
  }

  const displayMembers = members.slice(0, 4);
  const extraCount = members.length - 4;

  return (
    <div className='flex items-center justify-center'>
      {displayMembers.map((m, i) => {
        const name = formatName(m.user);
        const initials = getInitials(name);

        return (
          <div
            key={m.user.id}
            className={`relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#edf3ff] text-[11px] font-bold text-[#2d6ff7] shadow-sm ${
              i > 0 ? '-ml-3' : ''
            }`}
            title={name}
            style={{ zIndex: 10 - i }}
          >
            {initials}
          </div>
        );
      })}
      {extraCount > 0 && (
        <div
          className='relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#f3f7ff] text-[11px] font-bold text-[#7e8fb4] shadow-sm -ml-3'
          style={{ zIndex: 0 }}
          title={`Ещё ${extraCount} участник(ов)`}
        >
          +{extraCount}
        </div>
      )}
    </div>
  );
}

export default function TemplatesTablePanel({
  templates,
  searchQuery,
  isLoading,
  currentPage,
  totalPages,
  pageSize,
  onSearchQueryChange,
  onPageChange,
  onPageSizeChange,
  onOpenCreateModal,
  onEditTemplate,
  onCreateProjectFromTemplate,
  onDeleteTemplate,
  onExportTemplates,
  onTogglePinTemplate,
  canManageTemplates = true,
}: Props) {
  return (
    <section className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-4 text-[#1f3565]'>
      <h1 className='mb-4 text-[22px] leading-none font-semibold text-[#10275a]'>
        Шаблоны
      </h1>

      <div className='mb-4 flex flex-wrap gap-4 items-center justify-between'>
        <label className='flex h-10 w-full max-w-150 flex-1 items-center gap-2 rounded-xl border border-[#e3e9f3] bg-white px-3 text-[14px] text-[#7e8fb4]'>
          <svg
            className='size-5 shrink-0 fill-none stroke-current stroke-[1.8]'
            viewBox='0 0 24 24'
          >
            <circle cx='11' cy='11' r='7' />
            <path d='m20 20-3.5-3.5' />
          </svg>
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder='Поиск'
            className='min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-[#1f3565] outline-none placeholder:text-[#7e8fb4]'
          />
        </label>

        <div className='flex gap-2'>
          {canManageTemplates && (
            <Button
              type='button'
              variant='secondary'
              className='h-10 rounded-xl border border-[#e3e9f3] bg-white px-4 text-[14px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
              onClick={onOpenCreateModal}
            >
              + Добавить
            </Button>
          )}
          <Button
            type='button'
            variant='secondary'
            className='h-10 rounded-xl border border-[#e3e9f3] bg-white px-4 text-[14px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
            onClick={onExportTemplates}
          >
            <span className='inline-flex items-center gap-2'>
              <Icon name='export' />
              Экспорт
            </span>
          </Button>
        </div>
      </div>

      <div className='mb-4 flex items-center gap-4 text-[15px] font-semibold text-[#1f3565]'>
        <span className='rounded-xl border border-[#e3e9f3] bg-[#f8f9fc] px-3 py-1.5'>
          Количество шаблонов: {templates.length}
        </span>
      </div>

      <TableContainer className='min-h-0 flex-1'>
        <Table className='min-w-200'>
          <THead sticky>
            <tr>
              <Th>Название шаблона</Th>
              <Th>Руководитель</Th>
              <Th align='center'>Участники</Th>
              <Th>Статусы</Th>
              <Th align='center' className='w-37.5 whitespace-nowrap'>
                Действия
              </Th>
            </tr>
          </THead>
          <TBody>
            {isLoading ? (
              <TableLoadingRow />
            ) : templates.length ? (
              templates.map((template) => {
                const isPinned = template.is_pinned;

                return (
                  <Tr key={template.id}>
                    <Td className='font-semibold'>
                      <div className='flex items-center gap-2'>
                        {canManageTemplates ? (
                          <button
                            type='button'
                            className='text-left hover:text-[#2d6ff7] hover:underline'
                            onClick={() => onEditTemplate(template)}
                          >
                            {template.name}
                          </button>
                        ) : (
                          <span>{template.name}</span>
                        )}
                        {template.is_default_template && (
                          <span className='rounded-full bg-[#edf3ff] px-2 py-0.5 text-[11px] text-[#2d6ff7]'>
                            По умолчанию
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>{template.manager ? formatName(template.manager) : '—'}</Td>
                    <Td align='center'>
                      <MembersAvatars members={template.members || []} />
                    </Td>
                    <Td>
                      <div className='flex flex-wrap gap-1'>
                        {(template.status_columns ?? []).map((column) => (
                          <span
                            key={column.id || `${template.id}-${column.name}`}
                            className='inline-flex items-center gap-1 rounded-full border border-[#d9e4f7] bg-[#f8fbff] px-2 py-0.5 text-[11px] text-[#1f3565]'
                          >
                            <span
                              className='size-2 rounded-full'
                              style={{ backgroundColor: column.color ?? '#7e8fb4' }}
                            />
                            <span>{column.name ?? column.label}</span>
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td align='center'>
                      {canManageTemplates ? (
                        <TableActions>
                          <TableActionButton
                            label={isPinned ? 'Открепить' : 'Закрепить'}
                            active={Boolean(isPinned)}
                            onClick={() => onTogglePinTemplate?.(template)}
                          >
                            <svg
                              className='fill-none stroke-current stroke-[1.8]'
                              viewBox='0 0 24 24'
                              aria-hidden='true'
                            >
                              <line x1='12' y1='17' x2='12' y2='22'></line>
                              <path d='M5 17h14v-1.5c0-1.8-1-3-2-4.5V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5c-1 1.5-2 2.7-2 4.5z'></path>
                              {isPinned && <line x1='3' y1='3' x2='21' y2='21'></line>}
                            </svg>
                          </TableActionButton>

                          <TableActionButton
                            label='Редактировать шаблон'
                            onClick={() => onEditTemplate(template)}
                          >
                            <svg
                              className='fill-none stroke-current stroke-[1.8]'
                              viewBox='0 0 24 24'
                              aria-hidden='true'
                            >
                              <path d='M12 20h9' />
                              <path d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' />
                            </svg>
                          </TableActionButton>

                          <TableActionButton
                            label='Создать проект из шаблона'
                            tone='success'
                            onClick={() => onCreateProjectFromTemplate(template)}
                          >
                            <svg
                              className='fill-none stroke-current stroke-[1.8]'
                              viewBox='0 0 24 24'
                              aria-hidden='true'
                            >
                              <path d='M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4' />
                              <polyline points='14 2 14 8 20 8' />
                              <path d='M3 15h6' />
                              <path d='M6 12v6' />
                            </svg>
                          </TableActionButton>

                          <TableActionButton
                            label='Удалить шаблон'
                            tone='danger'
                            onClick={() => onDeleteTemplate(template)}
                          >
                            <svg
                              className='fill-none stroke-current stroke-[1.8]'
                              viewBox='0 0 24 24'
                              aria-hidden='true'
                            >
                              <path d='M3 6h18' />
                              <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
                              <line x1='10' y1='11' x2='10' y2='17' />
                              <line x1='14' y1='11' x2='14' y2='17' />
                            </svg>
                          </TableActionButton>
                        </TableActions>
                      ) : (
                        <span className='text-[#7e8fb4]'>—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <TableEmptyRow>Шаблоны не найдены</TableEmptyRow>
            )}
          </TBody>
        </Table>
      </TableContainer>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
