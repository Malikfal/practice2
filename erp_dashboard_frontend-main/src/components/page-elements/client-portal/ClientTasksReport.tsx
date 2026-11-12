import { useCallback, useEffect, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { toast } from 'sonner';

import { api } from '../../../api/api';
import type { ClientBoardColumn, ClientReportTask } from '../../../api/modules/clientApi';
import DateRangeFields from '../../ui/DateRangeFields';
import { Field, Select } from '../../ui/FormField';
import { Td, Tr } from '../../ui/table';
import ClientPortalTable, { clientTableLinkClasses } from './ClientPortalTable';
import { formatSecondsToHoursMinutes } from '../../modals/TaskModal/shared';

export default function ClientTasksReport({
  projectId,
  columns,
  onOpenTask,
}: {
  projectId: string;
  columns: ClientBoardColumn[];
  onOpenTask: (_task: ClientReportTask) => void;
}) {
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  // По умолчанию отчёт показывает завершённые задачи, как и раньше.
  const [statusColumnId, setStatusColumnId] = useState(
    () => columns.find((column) => column.is_final)?.id ?? '',
  );
  const [tasks, setTasks] = useState<ClientReportTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!from || !to) return;
    try {
      setIsLoading(true);
      setTasks(
        await api.client.tasksReport({
          from,
          to,
          project_id: projectId,
          ...(statusColumnId ? { status_column_id: statusColumnId } : {}),
        }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось построить отчёт.');
    } finally {
      setIsLoading(false);
    }
  }, [from, to, projectId, statusColumnId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedColumn = columns.find((column) => column.id === statusColumnId);
  const showEstimation = tasks.some((task) => task.estimation !== null);
  const showSpent = tasks.some((task) => task.spent_seconds !== null);

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'>
        <DateRangeFields
          from={from}
          to={to}
          fromLabel='Период с'
          toLabel='по'
          onChange={(nextFrom, nextTo) => {
            setFrom(nextFrom);
            setTo(nextTo);
          }}
        />
        <Field label='Статус'>
          <Select
            value={statusColumnId}
            onChange={(event) => setStatusColumnId(event.target.value)}
          >
            <option value=''>Все статусы</option>
            {[...columns]
              .sort((left, right) => left.position - right.position)
              .map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      {isLoading ? (
        <p className='py-6 text-center text-sm text-[#7e8fb4]'>Загрузка...</p>
      ) : (
        <ClientPortalTable
          columns={[
            'Задача',
            'Статус',
            selectedColumn?.is_final ? 'Завершена' : 'Дата статуса',
            ...(showEstimation ? [{ label: 'Оценка', numeric: true }] : []),
            ...(showSpent ? [{ label: 'Затрачено', numeric: true }] : []),
          ]}
          isEmpty={tasks.length === 0}
          emptyText='За этот период задач нет.'
        >
          {tasks.map((task) => (
            <Tr key={task.id}>
              <Td className='min-w-56'>
                <button
                  type='button'
                  className={clientTableLinkClasses}
                  onClick={() => onOpenTask(task)}
                >
                  {task.title}
                </button>
              </Td>
              <Td className='whitespace-nowrap'>{task.status ?? '—'}</Td>
              <Td className='whitespace-nowrap tabular-nums'>
                {new Date(task.status_changed_at).toLocaleDateString('ru-RU')}
              </Td>
              {showEstimation ? (
                <Td numeric>
                  {task.estimation !== null
                    ? formatSecondsToHoursMinutes(task.estimation)
                    : '—'}
                </Td>
              ) : null}
              {showSpent ? (
                <Td numeric>
                  {task.spent_seconds !== null
                    ? formatSecondsToHoursMinutes(task.spent_seconds)
                    : '—'}
                </Td>
              ) : null}
            </Tr>
          ))}
        </ClientPortalTable>
      )}
    </div>
  );
}
