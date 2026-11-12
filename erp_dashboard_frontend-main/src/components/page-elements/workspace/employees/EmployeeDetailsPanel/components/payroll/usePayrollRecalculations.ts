import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../../api/api';
import { ApiRequestError } from '../../../../../../../api/core/error';
import type {
  EmployeePayrollCalculationRow,
  PayrollRecalculation,
} from '../../../../../../../types/app';
import { todayInputValue } from './payrollUtils';

const POLLING_INTERVAL_MS = 2500;

export function payrollPeriodKey(periodFrom: string, periodTo: string) {
  return `${periodFrom.slice(0, 10)}|${periodTo.slice(0, 10)}`;
}

type PayrollPeriodRow = Pick<EmployeePayrollCalculationRow, 'period_from' | 'period_to'>;

export function isCompletedPayrollPeriod(row: PayrollPeriodRow) {
  return row.period_to.slice(0, 10) < todayInputValue();
}

export function usePayrollRecalculations({
  rows,
  enabled,
  onCompleted,
}: {
  rows: PayrollPeriodRow[];
  enabled: boolean;
  onCompleted: (_periodFrom: string, _periodTo: string) => Promise<void> | void;
}) {
  const completedPeriods = useMemo(
    () =>
      rows.filter(isCompletedPayrollPeriod).map((row) => ({
        periodFrom: row.period_from.slice(0, 10),
        periodTo: row.period_to.slice(0, 10),
      })),
    [rows],
  );
  const periodsKey = completedPeriods
    .map(({ periodFrom, periodTo }) => payrollPeriodKey(periodFrom, periodTo))
    .join(',');
  const [states, setStates] = useState<
    Record<string, PayrollRecalculation | null | undefined>
  >({});
  const [startingPeriods, setStartingPeriods] = useState<Set<string>>(new Set());
  const onCompletedRef = useRef(onCompleted);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    if (!enabled || !periodsKey) {
      setStates({});
      return;
    }

    let ignore = false;
    setStates({});
    const periods = periodsKey.split(',').map((key) => {
      const [periodFrom, periodTo] = key.split('|');
      return { key, periodFrom, periodTo };
    });

    const load = async () => {
      const entries = await Promise.all(
        periods.map(async ({ key, periodFrom, periodTo }) => {
          try {
            const state = await api.workspace.payrollRecalculations.getForPeriod(
              periodFrom,
              periodTo,
            );
            return [key, state] as const;
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : 'Не удалось получить состояние перерасчёта.',
            );
            return [key, null] as const;
          }
        }),
      );

      if (!ignore) setStates(Object.fromEntries(entries));
    };

    void load();

    return () => {
      ignore = true;
    };
  }, [enabled, periodsKey]);

  useEffect(() => {
    if (!enabled) return;

    const activePeriods = Object.entries(states)
      .filter(([, state]) => state?.status === 'QUEUED' || state?.status === 'RUNNING')
      .map(([key]) => {
        const [periodFrom, periodTo] = key.split('|');
        return { key, periodFrom, periodTo };
      });

    if (activePeriods.length === 0) return;

    let ignore = false;
    const timer = window.setTimeout(async () => {
      const results = await Promise.all(
        activePeriods.map(async ({ key, periodFrom, periodTo }) => {
          try {
            const state = await api.workspace.payrollRecalculations.getForPeriod(
              periodFrom,
              periodTo,
            );
            return [key, state] as const;
          } catch {
            return [key, states[key] ?? null] as const;
          }
        }),
      );

      if (ignore) return;

      setStates((current) => ({ ...current, ...Object.fromEntries(results) }));

      for (const [key, state] of results) {
        const previousStatus = states[key]?.status;
        if (state?.status === 'COMPLETED' && previousStatus !== 'COMPLETED') {
          toast.success('Начисления компании за период пересчитаны.');
          await onCompletedRef.current(state.period_from, state.period_to);
          window.dispatchEvent(new Event('payroll-financial-data-updated'));
        } else if (state?.status === 'FAILED' && previousStatus !== 'FAILED') {
          toast.error(state.error_message || 'Не удалось пересчитать начисления.');
        }
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [enabled, states]);

  /** Запускает перерасчёт; возвращает состояние, если он поставлен в очередь или уже идёт. */
  const start = useCallback(async (periodFrom: string, periodTo: string) => {
    const key = payrollPeriodKey(periodFrom, periodTo);
    setStartingPeriods((current) => new Set(current).add(key));

    try {
      const state = await api.workspace.payrollRecalculations.startForPeriod(
        periodFrom,
        periodTo,
      );
      setStates((current) => ({ ...current, [key]: state }));
      if (state?.status === 'COMPLETED') {
        toast.success('Начисления компании за период пересчитаны.');
        await onCompletedRef.current(state.period_from, state.period_to);
        window.dispatchEvent(new Event('payroll-financial-data-updated'));
      } else if (state?.status === 'FAILED') {
        toast.error(state.error_message || 'Не удалось пересчитать начисления.');
      }
      return state ?? null;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        try {
          const state = await api.workspace.payrollRecalculations.getForPeriod(
            periodFrom,
            periodTo,
          );
          setStates((current) => ({ ...current, [key]: state }));
          toast.info('Перерасчёт этого периода уже выполняется.');
          return state;
        } catch (stateError) {
          toast.error(
            stateError instanceof Error
              ? stateError.message
              : 'Не удалось получить состояние перерасчёта.',
          );
        }
        return null;
      }

      if (error instanceof ApiRequestError && error.status === 422) {
        toast.error(error.message || 'Период не завершён или его границы некорректны.');
        return null;
      }

      toast.error(
        error instanceof Error ? error.message : 'Не удалось запустить перерасчёт.',
      );
      return null;
    } finally {
      setStartingPeriods((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }, []);

  return { states, startingPeriods, start };
}
