import type { ReactNode } from 'react';

import type {
  PayrollSummaryAmounts,
  PayrollSummaryGroup,
  PayrollSummaryGroupBy,
  PayrollSummaryPeriod,
} from '../../../../../../types/payrollSummary';
import { HintToolTip } from '../../../../../ui/HintTooltip';
import { Td, Th, Tr } from '../../../../../ui/table';
import {
  formatHours,
  formatMoney,
} from '../../../employees/EmployeeDetailsPanel/components/payroll/payrollUtils';

import {
  formatRange,
  fullWeekRange,
  groupState,
  groupTitle,
  isSplitWeek,
  pluralWeeks,
} from './payrollSummaryUtils';

export type OpenDetails = (_employeeId: string, _period: PayrollSummaryPeriod) => void;

/** Фон строк иерархии: раскрытая строка верхнего уровня, вложенная строка, неделя. */
export const OPEN_ROW_BACKGROUND = 'bg-[#f7f9ff]';
export const NESTED_ROW_BACKGROUND = 'bg-[#fbfcff]';

// Первая ячейка шапки: раскрыть или свернуть все строки верхнего уровня.
export function ToggleAllHeader({
  allExpanded,
  onToggleAll,
}: {
  allExpanded: boolean;
  onToggleAll: () => void;
}) {
  const label = allExpanded ? 'Свернуть все' : 'Развернуть все';

  return (
    <Th align='center' className='w-10'>
      {/* Двойной шеврон отличает «раскрыть все» от шеврона строки. */}
      <button
        type='button'
        className='inline-flex size-6 items-center justify-center rounded-md text-[#7e8fb4] transition-colors hover:bg-[#e8efff] hover:text-[#2d6ff7]'
        onClick={onToggleAll}
        aria-label={label}
        title={label}
      >
        <span
          className={`text-lg leading-none tracking-[-0.35em] transition-transform ${allExpanded ? 'rotate-90' : ''}`}
        >
          ››
        </span>
      </button>
    </Th>
  );
}

function Badge({ tone, children }: { tone: 'blue' | 'amber'; children: ReactNode }) {
  const classes = {
    blue: 'bg-[#edf3ff] text-[#2d6ff7]',
    amber: 'bg-amber-50 text-amber-700',
  }[tone];

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${classes}`}
    >
      {children}
    </span>
  );
}

export function SplitWeekHint({ period }: { period: PayrollSummaryPeriod }) {
  if (!isSplitWeek(period)) return null;
  const week = fullWeekRange(period);

  return (
    <span className='inline-flex items-center gap-1 text-xs font-normal text-[#7e8fb4]'>
      часть недели
      <HintToolTip
        content={`Неделя ${formatRange(week.from, week.to)} разделена границей месяца. Каждая часть считается в своём месяце.`}
      />
    </span>
  );
}

// Название периода с датами, числом недель и пометками "идёт" и "неполный".
export function GroupLabel({
  group,
  groupBy,
  period,
  today,
  weeksCount,
}: {
  group: PayrollSummaryGroup;
  groupBy: PayrollSummaryGroupBy;
  period?: PayrollSummaryPeriod;
  today: string;
  // У сотрудника считаются только его недели, а не все недели периода.
  weeksCount?: number;
}) {
  const state = groupState(group, today);

  if (groupBy === 'week') {
    return (
      <span className='flex flex-wrap items-center gap-x-2 gap-y-0.5'>
        <span className='font-semibold text-[#10275a]'>{groupTitle(group, groupBy)}</span>
        {state.isRunning ? <Badge tone='blue'>текущая</Badge> : null}
        {period ? <SplitWeekHint period={period} /> : null}
      </span>
    );
  }

  return (
    <span className='grid gap-0.5'>
      <span className='flex flex-wrap items-center gap-2'>
        <span className='font-semibold text-[#10275a]'>{groupTitle(group, groupBy)}</span>
        {state.isRunning ? <Badge tone='blue'>идёт</Badge> : null}
        {state.isPartial ? (
          <span className='inline-flex items-center gap-1'>
            <Badge tone='amber'>неполный</Badge>
            <HintToolTip
              content={`В выбранный период попала только часть: ${formatRange(group.from, group.to)}. Чтобы увидеть период целиком, расширьте даты фильтра.`}
            />
          </span>
        ) : null}
      </span>
      <span className='text-xs text-[#7e8fb4]'>
        {formatRange(group.from, group.to)} ·{' '}
        {pluralWeeks(weeksCount ?? group.periods_count)}
      </span>
    </span>
  );
}

export function AmountCells({
  value,
  strong = true,
}: {
  value: PayrollSummaryAmounts;
  strong?: boolean;
}) {
  return (
    <>
      <Td numeric>{formatHours(value.own_seconds)}</Td>
      <Td numeric>{formatHours(value.supervised_seconds)}</Td>
      <Td numeric className={strong ? 'font-semibold text-[#10275a]' : undefined}>
        {formatMoney(value.amount_kopecks)}
      </Td>
    </>
  );
}

export function DetailsButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      className='ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold text-[#2d6ff7] hover:bg-[#edf3ff] disabled:opacity-60'
      disabled={loading}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {loading ? (
        <span className='size-3 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
      ) : null}
      Расчёт
    </button>
  );
}

// Недели одного сотрудника внутри месяца, квартала или года.
export function EmployeeWeekRows({
  employeeId,
  periods,
  indentClass,
  loadingKey,
  onOpenDetails,
}: {
  employeeId: string;
  periods: PayrollSummaryPeriod[];
  indentClass: string;
  loadingKey: string | null;
  onOpenDetails: OpenDetails;
}) {
  const rows = periods
    .map((period) => ({
      period,
      value: period.values.find((item) => item.employee_id === employeeId),
    }))
    .filter((row) => row.value);

  return rows.map(({ period, value }) => (
    <Tr
      key={period.key}
      background='bg-[#f8faff]'
      hoverable={false}
      className='text-[13px] text-[#53617c]'
    >
      <Td />
      <Td>
        <span className={`flex items-center gap-2 ${indentClass}`}>
          <span className='size-1 shrink-0 rounded-full bg-[#b9c7e3]' />
          <span className='flex flex-wrap items-center gap-x-2'>
            <span className='whitespace-nowrap'>
              {formatRange(period.from, period.to)}
            </span>
            <SplitWeekHint period={period} />
          </span>
          <DetailsButton
            loading={loadingKey === `${employeeId}:${period.key}`}
            onClick={() => onOpenDetails(employeeId, period)}
          />
        </span>
      </Td>
      <Td numeric />
      <AmountCells value={value!} strong={false} />
    </Tr>
  ));
}
