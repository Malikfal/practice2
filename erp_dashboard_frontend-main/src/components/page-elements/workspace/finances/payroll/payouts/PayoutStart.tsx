import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../api/api';
import type { PayrollPayoutSettings } from '../../../../../../types/payrollPayouts';
import Button from '../../../../../ui/Button';
import { Field, Select } from '../../../../../ui/FormField';

import { PayoutModalShell, PayoutSpinner } from './PayoutParts';
import { monthsBetween, monthStartLabel, monthTitle } from './payoutUtils';

function useStartMonthForm(onSaved: () => void) {
  const [settings, setSettings] = useState<PayrollPayoutSettings | null>(null);
  const [month, setMonth] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.workspace.payrollPayouts
      .getSettings()
      .then((response) => {
        if (cancelled) return;
        setSettings(response);
        setMonth(response.start_month ?? response.current_month);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : 'Не удалось загрузить настройки.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Начать учёт можно с любого месяца, за который есть начисления, но не позже текущего.
  const months = useMemo(() => {
    if (!settings) return [];
    const first = [
      settings.first_accrual_month,
      settings.start_month,
      settings.current_month,
    ]
      .filter((value): value is string => Boolean(value))
      .sort()[0];

    return monthsBetween(first, settings.current_month).reverse();
  }, [settings]);

  const save = async () => {
    if (!month) return;

    try {
      setIsSaving(true);
      await api.workspace.payrollPayouts.updateSettings(month);
      toast.success(`Учёт выплат ведётся с ${monthStartLabel(month)}.`);
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить настройку.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return { settings, month, setMonth, months, isSaving, save };
}

function StartMonthSelect({
  month,
  months,
  onChange,
}: {
  month: string;
  months: string[];
  onChange: (_month: string) => void;
}) {
  return (
    <Field label='Учитывать выплаты с месяца'>
      <Select value={month} onChange={(event) => onChange(event.target.value)}>
        {months.map((value) => (
          <option key={value} value={value}>
            {monthTitle(value)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

const START_HINT =
  'Начисления и выплаты до этого месяца в ведомость и задолженность не попадают. Долг на эту дату можно указать по каждому сотруднику на вкладке "Задолженность".';

// Первый экран ведомости: пока месяц начала учёта не выбран, считать задолженность не от чего.
export function PayoutStartCard({
  canManage,
  onSaved,
}: {
  canManage: boolean;
  onSaved: () => void;
}) {
  const form = useStartMonthForm(onSaved);

  if (!canManage) {
    return (
      <div className='grid min-h-56 place-items-center rounded-xl border border-[#e3e9f3] bg-white p-6 text-center text-sm text-[#7e8fb4]'>
        Учёт выплат ещё не включён. Его включает сотрудник с правом управления финансами.
      </div>
    );
  }

  if (!form.settings) {
    return (
      <div className='rounded-xl border border-[#e3e9f3] bg-white'>
        <PayoutSpinner />
      </div>
    );
  }

  return (
    <div className='rounded-xl border border-[#e3e9f3] bg-white p-4 md:p-6'>
      <div className='grid max-w-130 gap-3'>
        <h2 className='text-lg font-semibold text-[#10275a]'>Начало учёта выплат</h2>
        <p className='text-sm text-[#1f3565]'>
          Выберите месяц, с которого выплаты сотрудникам будут отмечаться в системе.{' '}
          {START_HINT}
        </p>
        <StartMonthSelect
          month={form.month}
          months={form.months}
          onChange={form.setMonth}
        />
        <div>
          <Button
            disabled={form.isSaving || !form.month}
            onClick={() => void form.save()}
          >
            {form.isSaving ? 'Сохранение...' : 'Начать учёт выплат'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PayoutStartModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useStartMonthForm(onSaved);

  return (
    <PayoutModalShell
      title='Начало учёта выплат'
      subtitle='Общая настройка компании'
      isSaving={form.isSaving}
      onClose={onClose}
    >
      {form.settings ? (
        <div className='grid gap-3'>
          <StartMonthSelect
            month={form.month}
            months={form.months}
            onChange={form.setMonth}
          />
          <p className='text-sm text-[#7e8fb4]'>{START_HINT}</p>
          <div className='mt-1 flex flex-wrap justify-end gap-2'>
            <Button variant='secondary' disabled={form.isSaving} onClick={onClose}>
              Отмена
            </Button>
            <Button
              disabled={form.isSaving || !form.month}
              onClick={() => void form.save()}
            >
              {form.isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      ) : (
        <PayoutSpinner />
      )}
    </PayoutModalShell>
  );
}
