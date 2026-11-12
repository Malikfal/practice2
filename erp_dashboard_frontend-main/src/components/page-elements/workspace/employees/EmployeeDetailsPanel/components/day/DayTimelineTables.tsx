import { useMemo, useState } from 'react';

import type { TimelineSegment } from '../../../../../../../types/app';
import {
  formatDurationHms,
  formatTimeRangeLocal,
  toDateFromApiTime,
} from '../../../../../../../utils/formatters';
import {
  sortRows,
  Table,
  TableActionButton,
  TableActions,
  TableContainer,
  TableEmptyRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useTableSort,
  type SortDirection,
} from '../../../../../../ui/table';

import { formatSegmentTask } from './dayTimelineUtils';

type Props = {
  segments: TimelineSegment[];
  canViewSegmentDetails: boolean;
  onSegmentClick?: (_segment: TimelineSegment) => void;
};

type ReportMode = 'project' | 'projectTask' | 'segments';
type SegmentSortKey = 'time' | 'duration';
type ProjectTotalRow = { key: string; project_name: string; duration_seconds: number };
type ProjectTaskTotalRow = ProjectTotalRow & { task_name: string };

const reportModes: Array<{
  id: ReportMode;
  label: string;
  hint: string;
  title: string;
}> = [
  {
    id: 'project',
    label: 'Общее время по проектам',
    hint: 'Проект -> Время',
    title: 'Общее время по проектам',
  },
  {
    id: 'projectTask',
    label: 'Общее время проект - задача',
    hint: 'Проект -> Задача -> Время',
    title: 'Общее время проект - задача',
  },
  {
    id: 'segments',
    label: 'Сегменты за день',
    hint: 'Проект -> Задача -> Время -> Сегмент',
    title: 'Сегменты за день',
  },
];

export default function DayTimelineTables({
  segments,
  canViewSegmentDetails,
  onSegmentClick,
}: Props) {
  const [activeMode, setActiveMode] = useState<ReportMode>('project');
  const projectTaskSort = useTableSort<'duration'>({
    initial: { key: 'duration', direction: 'desc' },
  });
  const segmentSort = useTableSort<SegmentSortKey>({
    initial: { key: 'time', direction: 'asc' },
  });

  const sortedSegments = useMemo(
    () =>
      [...segments].sort(
        (left, right) =>
          toDateFromApiTime(left.clamped_started_at).getTime() -
          toDateFromApiTime(right.clamped_started_at).getTime(),
      ),
    [segments],
  );

  const projectTotals = useMemo(() => {
    const totals = new Map<string, ProjectTotalRow>();

    for (const segment of sortedSegments) {
      const key = segment.project_id || segment.project_name || segment.id;
      const current = totals.get(key);

      if (current) {
        current.duration_seconds += segment.duration_seconds;
        continue;
      }

      totals.set(key, {
        key,
        project_name: segment.project_name || 'Без проекта',
        duration_seconds: segment.duration_seconds,
      });
    }

    return Array.from(totals.values()).sort((left, right) =>
      left.project_name.localeCompare(right.project_name, 'ru'),
    );
  }, [sortedSegments]);

  const projectTaskTotals = useMemo(() => {
    const totals = new Map<string, ProjectTaskTotalRow>();

    for (const segment of sortedSegments) {
      const key = `${segment.project_id || segment.project_name}-${segment.task_id || segment.task_name}`;
      const current = totals.get(key);

      if (current) {
        current.duration_seconds += segment.duration_seconds;
        continue;
      }

      totals.set(key, {
        key,
        project_name: segment.project_name || 'Без проекта',
        task_name: segment.task_name || 'Без задачи',
        duration_seconds: segment.duration_seconds,
      });
    }

    return Array.from(totals.values()).sort((left, right) => {
      const projectCompare = left.project_name.localeCompare(right.project_name, 'ru');
      if (projectCompare !== 0) return projectCompare;
      return left.task_name.localeCompare(right.task_name, 'ru');
    });
  }, [sortedSegments]);

  // Сортировка устойчивая: при равном времени остаётся порядок «проект → задача».
  const sortedProjectTaskTotals = useMemo(
    () =>
      sortRows(projectTaskTotals, projectTaskSort.sort, (row) => row.duration_seconds),
    [projectTaskSort.sort, projectTaskTotals],
  );

  const sortedSegmentRows = useMemo(() => {
    const { key, direction } = segmentSort.sort;
    const valueOf = (segment: TimelineSegment) =>
      key === 'duration'
        ? segment.duration_seconds
        : toDateFromApiTime(segment.clamped_started_at).getTime();

    return [...sortedSegments].sort((left, right) => {
      const leftValue = valueOf(left);
      const rightValue = valueOf(right);
      const valueCompare =
        direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;

      if (valueCompare !== 0) return valueCompare;

      return (left.project_name || '').localeCompare(right.project_name || '', 'ru');
    });
  }, [segmentSort.sort, sortedSegments]);

  const activeReport =
    reportModes.find((mode) => mode.id === activeMode) ?? reportModes[0];

  return (
    <section className='grid min-w-0 content-start gap-4 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3'>
      <div className='grid min-w-0 gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center'>
        <h3 className='text-[20px] font-semibold text-[#10275a]'>Отчёт дня</h3>
        <div className='grid min-w-0 gap-2 md:grid-cols-3'>
          {reportModes.map((mode) => (
            <button
              key={mode.id}
              type='button'
              className={`rounded-xl border px-3 py-2 text-center text-[12px] leading-tight font-semibold transition-colors ${
                activeMode === mode.id
                  ? 'border-[#2d6ff7] bg-[#2d6ff7] text-white shadow-sm shadow-[#2d6ff7]/25'
                  : 'border-[#c9d8f8] bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() => setActiveMode(mode.id)}
            >
              <span className='block'>{mode.label}</span>
              <span
                className={`mt-0.5 block text-[11px] font-medium ${
                  activeMode === mode.id ? 'text-white/85' : 'text-[#7e8fb4]'
                }`}
              >
                {mode.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className='grid min-w-0 gap-2'>
        <h4 className='text-[18px] font-semibold text-[#10275a]'>
          Таблица: [{activeReport.title}]
        </h4>

        {activeMode === 'project' ? (
          <ProjectTotalsTable rows={projectTotals} />
        ) : activeMode === 'projectTask' ? (
          <ProjectTaskTotalsTable
            rows={sortedProjectTaskTotals}
            sortDirection={projectTaskSort.directionOf('duration')}
            onSortByTime={() => projectTaskSort.toggleSort('duration')}
          />
        ) : (
          <SegmentsTable
            rows={sortedSegmentRows}
            sortDirectionOf={segmentSort.directionOf}
            onSort={segmentSort.toggleSort}
            canViewSegmentDetails={canViewSegmentDetails}
            onSegmentClick={onSegmentClick}
          />
        )}
      </div>
    </section>
  );
}

function ProjectTotalsTable({ rows }: { rows: ProjectTotalRow[] }) {
  return (
    <TableContainer>
      <Table density='compact' className='min-w-160'>
        <THead>
          <tr>
            <Th>Проект</Th>
            <Th numeric>Время</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((project) => (
            <Tr key={project.key}>
              <Td>{project.project_name}</Td>
              <Td numeric className='font-semibold text-[#10275a]'>
                {formatDurationHms(project.duration_seconds)}
              </Td>
            </Tr>
          ))}
          {!rows.length ? <TableEmptyRow>Нет данных.</TableEmptyRow> : null}
        </TBody>
      </Table>
    </TableContainer>
  );
}

function ProjectTaskTotalsTable({
  rows,
  sortDirection,
  onSortByTime,
}: {
  rows: ProjectTaskTotalRow[];
  sortDirection: SortDirection | null;
  onSortByTime: () => void;
}) {
  return (
    <TableContainer>
      <Table density='compact' className='min-w-190'>
        <THead>
          <tr>
            <Th>Проект</Th>
            <Th>Задача</Th>
            <Th numeric sortDirection={sortDirection} onSort={onSortByTime}>
              Время
            </Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <Tr key={row.key}>
              <Td>{row.project_name}</Td>
              <Td>{row.task_name}</Td>
              <Td numeric className='font-semibold text-[#10275a]'>
                {formatDurationHms(row.duration_seconds)}
              </Td>
            </Tr>
          ))}
          {!rows.length ? <TableEmptyRow>Нет данных.</TableEmptyRow> : null}
        </TBody>
      </Table>
    </TableContainer>
  );
}

function SegmentsTable({
  rows,
  sortDirectionOf,
  onSort,
  canViewSegmentDetails,
  onSegmentClick,
}: {
  rows: TimelineSegment[];
  sortDirectionOf: (_key: SegmentSortKey) => SortDirection | null;
  onSort: (_key: SegmentSortKey) => void;
  canViewSegmentDetails: boolean;
  onSegmentClick?: (_segment: TimelineSegment) => void;
}) {
  return (
    <TableContainer>
      <Table density='compact' className='min-w-215'>
        <THead>
          <tr>
            <Th>Проект</Th>
            <Th>Задача</Th>
            <Th sortDirection={sortDirectionOf('time')} onSort={() => onSort('time')}>
              Время
            </Th>
            <Th
              numeric
              sortDirection={sortDirectionOf('duration')}
              onSort={() => onSort('duration')}
            >
              Сегмент
            </Th>
            <Th align='center' className='w-10'>
              Действия
            </Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((segment) => (
            <Tr key={segment.id}>
              <Td>{segment.project_name || '—'}</Td>
              <Td>{formatSegmentTask(segment, canViewSegmentDetails)}</Td>
              <Td className='whitespace-nowrap tabular-nums'>
                {formatTimeRangeLocal(
                  segment.clamped_started_at,
                  segment.clamped_ended_at,
                )}
              </Td>
              <Td numeric className='font-semibold text-[#10275a]'>
                {formatDurationHms(segment.duration_seconds)}
              </Td>
              <Td align='center' className='w-10'>
                <TableActions>
                  <TableActionButton
                    label='Открыть'
                    disabled={!onSegmentClick}
                    onClick={() => onSegmentClick?.(segment)}
                  >
                    <svg
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      aria-hidden='true'
                    >
                      <path d='M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z' />
                      <circle cx='12' cy='12' r='3' />
                    </svg>
                  </TableActionButton>
                </TableActions>
              </Td>
            </Tr>
          ))}
          {!rows.length ? <TableEmptyRow>Нет данных.</TableEmptyRow> : null}
        </TBody>
      </Table>
    </TableContainer>
  );
}
