import { useMemo } from 'react';

import {
  cx,
  Table,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type SortState,
} from '../../../../../ui/table';
import { formatDurationHms, formatName } from '../../../../../../utils/formatters';
import type { UserBoardTask } from '../../../../../../types/app';
import { orderTasksByHierarchy } from '../../orderTasksByHierarchy';
import { PRIORITY_CHIP_CLASS, PRIORITY_LABEL } from '../constants';
import type { SortKey } from '../types';

export default function TasksTable({
  isLoading,
  tasks,
  hasActiveFilter,
  sort,
  onSort,
  onOpenTask,
}: {
  isLoading: boolean;
  tasks: UserBoardTask[];
  hasActiveFilter: boolean;
  sort: SortState<SortKey>;
  onSort: (_key: SortKey) => void;
  onOpenTask: (_task: UserBoardTask) => void;
}) {
  const orderedTasks = useMemo(() => orderTasksByHierarchy(tasks), [tasks]);
  const sortOf = (key: SortKey) => (sort.key === key ? sort.direction : null);

  return (
    <TableContainer className='min-h-0 flex-1'>
      <Table className='min-w-240'>
        <THead sticky>
          <tr>
            <Th sortDirection={sortOf('title')} onSort={() => onSort('title')}>
              Название
            </Th>
            <Th sortDirection={sortOf('project')} onSort={() => onSort('project')}>
              Проект
            </Th>
            <Th sortDirection={sortOf('status')} onSort={() => onSort('status')}>
              Статус
            </Th>
            <Th sortDirection={sortOf('priority')} onSort={() => onSort('priority')}>
              Приоритет
            </Th>
            <Th sortDirection={sortOf('assignees')} onSort={() => onSort('assignees')}>
              Исполнители
            </Th>
            <Th
              numeric
              className='whitespace-nowrap'
              sortDirection={sortOf('spent')}
              onSort={() => onSort('spent')}
            >
              Затрачено
            </Th>
          </tr>
        </THead>
        <TBody>
          {isLoading ? (
            <TableLoadingRow />
          ) : orderedTasks.length ? (
            orderedTasks.map((task) => {
              const assigneeNames = (task.assignees ?? [])
                .map((assignee) => formatName(assignee))
                .join(', ');
              const statusColor =
                task.status_column?.color ?? task.status_color ?? '#7e8fb4';
              const statusLabel = task.status_label ?? task.status_column?.name ?? '—';
              const title = task.title || 'Без названия';

              return (
                <Tr
                  key={task.id}
                  onClick={() => onOpenTask(task)}
                  background={task.is_draft ? 'bg-amber-50/60' : undefined}
                  className={cx('cursor-pointer', task.is_draft && 'opacity-80')}
                >
                  <Td className='min-w-0 font-semibold'>
                    <span className='flex max-w-80 min-w-0 items-center'>
                      <button
                        type='button'
                        className='min-w-0 truncate text-left hover:text-[#2d6ff7]'
                        title={task.title}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenTask(task);
                        }}
                      >
                        {task.parent_task_id ? `↳ ${title}` : title}
                      </button>
                      {task.is_draft ? (
                        <span className='ml-2 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700'>
                          Черновик
                        </span>
                      ) : null}
                    </span>
                  </Td>
                  <Td className='min-w-0'>
                    <span
                      className='block max-w-55 truncate'
                      title={task.project?.name ?? '—'}
                    >
                      {task.project?.name ?? '—'}
                    </span>
                  </Td>
                  <Td className='min-w-0'>
                    <span className='inline-flex items-center gap-2'>
                      <span
                        className='inline-block size-2 rounded-full'
                        style={{ backgroundColor: statusColor }}
                        aria-hidden='true'
                      />
                      <span className='truncate' title={statusLabel}>
                        {statusLabel}
                      </span>
                    </span>
                  </Td>
                  <Td>
                    {task.priority ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold ${PRIORITY_CHIP_CLASS[task.priority]}`}
                      >
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                    ) : (
                      <span className='text-[#7e8fb4]'>—</span>
                    )}
                  </Td>
                  <Td className='min-w-0'>
                    {assigneeNames ? (
                      <span className='block max-w-65 truncate' title={assigneeNames}>
                        {assigneeNames}
                      </span>
                    ) : (
                      <span className='text-[#7e8fb4]'>—</span>
                    )}
                  </Td>
                  <Td numeric>{formatDurationHms(task.spent_seconds ?? 0)}</Td>
                </Tr>
              );
            })
          ) : (
            <TableEmptyRow>
              {hasActiveFilter
                ? 'По выбранным фильтрам ничего не найдено.'
                : 'Задач пока нет.'}
            </TableEmptyRow>
          )}
        </TBody>
      </Table>
    </TableContainer>
  );
}
