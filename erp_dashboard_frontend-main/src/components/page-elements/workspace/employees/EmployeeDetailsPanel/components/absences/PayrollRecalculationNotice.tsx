import { useEffect, useMemo, useState } from 'react';

import type { PayrollRecalculationStatus } from '../../../../../../../types/app';
import Button from '../../../../../../ui/Button';
import {
  isCompletedPayrollPeriod,
  payrollPeriodKey,
  usePayrollRecalculations,
} from '../payroll/usePayrollRecalculations';

import { formatPeriod, type PayrollPeriodRange } from './utils';

type Props = {
  periods: PayrollPeriodRange[];
  canRecalculate: boolean;
  onRecalculated: (_keys: string[]) => void;
  onDismiss: () => void;
};

const STATUS_LABELS: Record<PayrollRecalculationStatus, string> = {
  QUEUED: 'В очереди',
  RUNNING: 'Пересчитывается',
  COMPLETED: 'Пересчитан',
  FAILED: 'Ошибка',
};

/**
 * Предупреждение после изменения прошедших дней: начисления за них поменяются только после
 * перерасчёта ФОТ компании за затронутые периоды.
 */
export function PayrollRecalculationNotice({
  periods,
  canRecalculate,
  onRecalculated,
  onDismiss,
}: Props) {
  const completedPeriods = useMemo(
    () => periods.filter(isCompletedPayrollPeriod),
    [periods],
  );
  const currentPeriods = periods.filter((period) => !isCompletedPayrollPeriod(period));
  const { states, startingPeriods, start } = usePayrollRecalculations({
    rows: completedPeriods,
    enabled: canRecalculate,
    onCompleted: () => undefined,
  });
  // Статус показываем только для перерасчётов, запущенных отсюда: в состоянии периода
  // может лежать результат более раннего перерасчёта, сделанного до изменения дней.
  const [launchedKeys, setLaunchedKeys] = useState<Set<string>>(new Set());
  const keyOf = (period: PayrollPeriodRange) =>
    payrollPeriodKey(period.period_from, period.period_to);
  const statusOf = (period: PayrollPeriodRange) =>
    launchedKeys.has(keyOf(period)) ? (states[keyOf(period)]?.status ?? null) : null;
  const periodsToLaunch = completedPeriods.filter((period) => {
    const status = statusOf(period);
    return status === null || status === 'FAILED';
  });
  const isStarting = startingPeriods.size > 0;

  useEffect(() => {
    const keys = completedPeriods.map((period) =>
      payrollPeriodKey(period.period_from, period.period_to),
    );
    const isAllRecalculated =
      keys.length > 0 &&
      keys.every((key) => launchedKeys.has(key) && states[key]?.status === 'COMPLETED');
    // Родитель убирает пересчитанные периоды и пересоздаёт предупреждение с чистым состоянием.
    if (isAllRecalculated) onRecalculated(keys);
  }, [completedPeriods, launchedKeys, onRecalculated, states]);

  const launchAll = async () => {
    for (const period of periodsToLaunch) {
      const state = await start(period.period_from, period.period_to);
      if (state) {
        setLaunchedKeys((current) => new Set(current).add(keyOf(period)));
      }
    }
  };

  return (
    <div className='grid gap-3 rounded-xl border border-[#ffe1aa] bg-[#fff8ea] p-3 text-sm text-[#7a4f00] md:p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='grid gap-1'>
          <p className='font-semibold text-[#9a6400]'>Нужен перерасчёт ФОТ по компании</p>
          <p>
            Изменены прошедшие дни. Начисления за них обновятся после перерасчёта ФОТ
            компании за затронутые периоды.
          </p>
        </div>
        <button
          type='button'
          className='grid size-8 shrink-0 place-items-center rounded-lg text-[16px] leading-none text-[#9a6400] transition-colors hover:bg-[#ffefcc]'
          onClick={onDismiss}
          aria-label='Скрыть предупреждение'
          title='Скрыть'
        >
          x
        </button>
      </div>

      {completedPeriods.length ? (
        <ul className='flex flex-wrap gap-2'>
          {completedPeriods.map((period) => {
            const status = statusOf(period);

            return (
              <li
                key={keyOf(period)}
                className='inline-flex items-center gap-2 rounded-lg border border-[#ffd38a] bg-white px-2.5 py-1 text-xs font-semibold'
              >
                {formatPeriod(period.period_from, period.period_to)}
                <span
                  className={
                    status === 'FAILED' ? 'text-[#c83f52]' : 'font-medium text-[#9a6400]'
                  }
                >
                  {status ? STATUS_LABELS[status] : 'Нужен перерасчёт'}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {currentPeriods.length ? (
        <p className='text-xs'>
          Текущий период{' '}
          {currentPeriods
            .map((period) => formatPeriod(period.period_from, period.period_to))
            .join(', ')}{' '}
          пересчитается автоматически после окончания.
        </p>
      ) : null}

      {completedPeriods.length ? (
        canRecalculate ? (
          periodsToLaunch.length ? (
            <div>
              <Button
                type='button'
                variant='secondary'
                className='h-10 w-full rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! sm:w-auto'
                disabled={isStarting}
                onClick={() => void launchAll()}
              >
                {isStarting ? 'Запуск...' : 'Запустить перерасчёт'}
              </Button>
            </div>
          ) : null
        ) : (
          <p className='text-xs'>
            Запустить перерасчёт может пользователь с правом управления финансами.
          </p>
        )
      ) : null}
    </div>
  );
}
