import { useState, type FormEvent, type ReactNode } from 'react';

import Button from '../../../../../ui/Button';
import { Field, Input } from '../../../../../ui/FormField';

import { PayoutModalShell } from './PayoutParts';
import { moneyInputValue, parseMoneyInput } from './payoutUtils';

// Правка одной суммы: аванса, расчёта или остатка на начало учёта.
export default function PayoutAmountModal({
  title,
  subtitle,
  description,
  label,
  initialAmount,
  allowNegative = false,
  isSaving,
  hint,
  onReset,
  onClose,
  onSave,
}: {
  title: string;
  subtitle?: string;
  description?: ReactNode;
  label: string;
  initialAmount: number;
  allowNegative?: boolean;
  isSaving: boolean;
  hint?: (_amount: number) => string;
  onReset?: () => void;
  onClose: () => void;
  onSave: (_amount: number) => void;
}) {
  const [value, setValue] = useState(() => moneyInputValue(initialAmount));
  const [error, setError] = useState('');
  const amount = parseMoneyInput(value, allowNegative);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (amount === null) {
      setError(
        allowNegative
          ? 'Укажите сумму, например 12000,00 или -500,00.'
          : 'Укажите сумму, например 20000,00.',
      );
      return;
    }

    setError('');
    onSave(amount);
  };

  return (
    <PayoutModalShell
      title={title}
      subtitle={subtitle}
      isSaving={isSaving}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className='grid gap-3' noValidate>
        {description ? <p className='text-sm text-[#7e8fb4]'>{description}</p> : null}
        <Field label={label}>
          <Input
            autoFocus
            inputMode='decimal'
            autoComplete='off'
            value={value}
            onChange={(event) => {
              setError('');
              setValue(event.target.value);
            }}
          />
        </Field>
        <p className='min-h-5 text-sm text-[#7e8fb4]'>
          {amount !== null && hint ? hint(amount) : ''}
        </p>
        {error ? (
          <p className='rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700'>{error}</p>
        ) : null}
        <div className='mt-1 flex flex-wrap justify-end gap-2'>
          {onReset ? (
            <Button
              variant='secondary'
              disabled={isSaving}
              className='sm:mr-auto'
              onClick={onReset}
            >
              Вернуть сумму по начислениям
            </Button>
          ) : null}
          <Button variant='secondary' disabled={isSaving} onClick={onClose}>
            Отмена
          </Button>
          <Button type='submit' disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </PayoutModalShell>
  );
}
