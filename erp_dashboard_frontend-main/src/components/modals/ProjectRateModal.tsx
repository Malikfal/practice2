import { useRef, useState, type FormEvent } from 'react';

import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/FormField';
import {
  DEFAULT_RATE_CURRENCY,
  RATE_CURRENCY_OPTIONS,
  type RateCurrency,
} from '../../utils/currency';

export type ProjectRateForm = {
  rate: string;
  currency: RateCurrency;
  vat: string;
  startDate: string;
};

const VAT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Не указано' },
  { value: '0', label: 'Без НДС' },
  { value: '5', label: '5% НДС' },
  { value: '10', label: '10% НДС' },
  { value: '20', label: '20% НДС' },
];

type ProjectRateModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  initialForm?: Partial<ProjectRateForm>;
  projectName?: string;
  onClose: () => void;
  onSave: (_form: ProjectRateForm) => Promise<void> | void;
};

export default function ProjectRateModal({ isOpen, ...props }: ProjectRateModalProps) {
  if (!isOpen) return null;

  // Содержимое монтируется при каждом открытии: форма заполняется из initialForm один раз
  // и не сбрасывается, если родитель перерисуется с новым объектом initialForm.
  return <ProjectRateModalContent {...props} />;
}

function ProjectRateModalContent({
  isSaving,
  initialForm,
  projectName,
  onClose,
  onSave,
}: Omit<ProjectRateModalProps, 'isOpen'>) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const [form, setForm] = useState<ProjectRateForm>(() => ({
    rate: initialForm?.rate ?? '',
    currency: initialForm?.currency ?? DEFAULT_RATE_CURRENCY,
    vat: initialForm?.vat ?? '',
    startDate: initialForm?.startDate ?? '',
  }));

  useEscapeToClose(() => {
    if (!isSaving) onClose();
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 sm:p-4'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        className='max-h-[calc(100dvh-1rem)] w-full max-w-[604px] overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/20 sm:max-h-[90vh] sm:rounded-2xl sm:p-5 md:overflow-auto'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h2 className='text-xl font-semibold text-slate-900'>Изменение ставки</h2>
            {projectName && (
              <p
                className='mt-1 max-w-[400px] truncate text-sm text-slate-500'
                title={projectName}
              >
                Проект: {projectName}
              </p>
            )}
          </div>
          <button
            type='button'
            onClick={onClose}
            disabled={isSaving}
            className='grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
            title='Закрыть'
          >
            <svg
              className='size-5 fill-none stroke-current stroke-[1.8]'
              viewBox='0 0 24 24'
            >
              <path
                d='M6 6l12 12M18 6L6 18'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className='grid gap-3'>
          <ProjectRateFields
            rate={form.rate}
            currency={form.currency}
            vat={form.vat}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />

          <Field label='Дата начала действия'>
            <Input
              type='date'
              className='text-base sm:text-sm'
              value={form.startDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, startDate: event.target.value }))
              }
            />
          </Field>

          <div className='mt-3'>
            <Button
              type='submit'
              disabled={isSaving}
              variant={isSaving ? 'secondary' : 'primary'}
              className='w-full'
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Ставка, валюта и НДС в одну строку: общий ряд для изменения ставки и создания проекта.
export function ProjectRateFields({
  rate,
  currency,
  vat,
  rateLabel = 'Новая ставка (валюта / час)',
  onChange,
}: {
  rate: string;
  currency: RateCurrency;
  vat: string;
  rateLabel?: string;
  onChange: (_patch: { rate?: string; currency?: RateCurrency; vat?: string }) => void;
}) {
  return (
    <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]'>
      <Field label={rateLabel}>
        <div className='grid grid-cols-[minmax(0,1fr)_130px] gap-2'>
          <Input
            type='number'
            min='0'
            step='0.01'
            inputMode='decimal'
            value={rate}
            onChange={(event) => onChange({ rate: event.target.value })}
            placeholder='0'
            className='text-base sm:text-sm'
            required
          />
          <Select
            value={currency}
            aria-label='Валюта ставки'
            className='text-base sm:text-sm'
            onChange={(event) =>
              onChange({ currency: event.target.value as RateCurrency })
            }
          >
            {RATE_CURRENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </Field>

      <Field label='НДС'>
        <Select
          value={vat}
          className='text-base sm:text-sm'
          onChange={(event) => onChange({ vat: event.target.value })}
        >
          {VAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
