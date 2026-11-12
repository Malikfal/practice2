import type { Dispatch, FormEvent, SetStateAction } from 'react';

import type {
  EmployeeAbsenceForm,
  EmployeeAbsenceFixedDailyAmountMonths,
  EmployeeAbsencePaymentMode,
  EmployeeAbsenceType,
} from '../../../../../../../types/app';
import Button from '../../../../../../ui/Button';

import { ABSENCE_TYPE_OPTIONS, PAYMENT_MODE_LABELS } from './constants';
import {
  FIELD_CONTROL_CLASS,
  FIELD_TEXTAREA_CLASS,
  Field,
  InfoLine,
  StyledSelect,
} from './AbsenceSharedUi';
import type { AbsenceModalState } from './types';
import {
  addDays,
  canDeleteAbsence,
  formatMoney,
  formatPeriod,
  inclusiveDays,
  todayInputValue,
} from './utils';

type Props = {
  modal: AbsenceModalState;
  form: EmployeeAbsenceForm;
  formError: string | null;
  calculationMonths: EmployeeAbsenceFixedDailyAmountMonths;
  fixedTotal: number | null;
  isSaving: boolean;
  isCalculating: boolean;
  canManageAbsences: boolean;
  canEditCurrentAbsence: boolean;
  canChangePast: boolean;
  isCurrentAbsenceStarted: boolean;
  isCurrentAbsencePast: boolean;
  onFormChange: Dispatch<SetStateAction<EmployeeAbsenceForm>>;
  onCalculationMonthsChange: (_months: EmployeeAbsenceFixedDailyAmountMonths) => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onDelete: () => void;
  onCalculateFixedDailyAmount: () => void;
};

export function AbsenceModal({
  modal,
  form,
  formError,
  calculationMonths,
  fixedTotal,
  isSaving,
  isCalculating,
  canManageAbsences,
  canEditCurrentAbsence,
  canChangePast,
  isCurrentAbsenceStarted,
  isCurrentAbsencePast,
  onFormChange,
  onCalculationMonthsChange,
  onSubmit,
  onClose,
  onDelete,
  onCalculateFixedDailyAmount,
}: Props) {
  return (
    <div className='fixed inset-0 z-50 grid place-items-center bg-[#10275a]/30 p-2 md:p-4'>
      <form
        className='grid max-h-[calc(100dvh-1rem)] w-full max-w-2xl gap-4 overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl md:max-h-[90vh] md:overflow-auto md:p-4'
        onSubmit={onSubmit}
      >
        <ModalHeader modal={modal} onClose={onClose} />
        <ModalStateMessages
          formError={formError}
          isCurrentAbsencePast={isCurrentAbsencePast}
          isCurrentAbsenceStarted={isCurrentAbsenceStarted}
        />

        <div className='grid gap-3 md:grid-cols-2'>
          <Field label='Тип'>
            <StyledSelect
              value={form.type}
              disabled={!canEditCurrentAbsence || isCurrentAbsenceStarted}
              ariaLabel='Выбрать тип отсутствия'
              options={ABSENCE_TYPE_OPTIONS}
              onChange={(value) =>
                onFormChange((current) => ({
                  ...current,
                  type: value as EmployeeAbsenceType,
                }))
              }
            />
          </Field>

          <Field label='Способ оплаты'>
            <StyledSelect
              value={form.payment_mode}
              disabled={!canEditCurrentAbsence || isCurrentAbsenceStarted}
              ariaLabel='Выбрать способ оплаты'
              options={[
                { value: 'DEFAULT', label: 'Без изменений' },
                { value: 'FIXED', label: 'Фиксированная оплата' },
              ]}
              onChange={(value) =>
                onFormChange((current) => ({
                  ...current,
                  payment_mode: value as EmployeeAbsencePaymentMode,
                  fixed_daily_amount:
                    value === 'DEFAULT' ? '' : current.fixed_daily_amount,
                  coefficient: value === 'FIXED' ? current.coefficient : '1',
                }))
              }
            />
          </Field>

          <Field label='Дата начала'>
            <input
              type='date'
              className={FIELD_CONTROL_CLASS}
              value={form.date_from}
              min={
                canChangePast || isCurrentAbsenceStarted ? undefined : todayInputValue()
              }
              disabled={!canEditCurrentAbsence || isCurrentAbsenceStarted}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  date_from: event.target.value,
                  date_to:
                    current.date_to && current.date_to >= event.target.value
                      ? current.date_to
                      : event.target.value,
                }))
              }
            />
          </Field>

          <Field label='Дата окончания'>
            <input
              type='date'
              className={FIELD_CONTROL_CLASS}
              value={form.date_to}
              min={
                isCurrentAbsenceStarted
                  ? addDays(todayInputValue(), -1)
                  : form.date_from || (canChangePast ? undefined : todayInputValue())
              }
              disabled={!canEditCurrentAbsence}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  date_to: event.target.value,
                }))
              }
            />
          </Field>
        </div>

        {form.payment_mode === 'FIXED' ? (
          <FixedPaymentFields
            form={form}
            calculationMonths={calculationMonths}
            isCalculating={isCalculating}
            canManageAbsences={canManageAbsences}
            canEditCurrentAbsence={canEditCurrentAbsence}
            isCurrentAbsenceStarted={isCurrentAbsenceStarted}
            onFormChange={onFormChange}
            onCalculationMonthsChange={onCalculationMonthsChange}
            onCalculateFixedDailyAmount={onCalculateFixedDailyAmount}
          />
        ) : null}

        <Field label='Комментарий'>
          <textarea
            className={FIELD_TEXTAREA_CLASS}
            value={form.comment}
            disabled={!canEditCurrentAbsence}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                comment: event.target.value,
              }))
            }
          />
        </Field>

        <div className='grid gap-2 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 text-sm text-[#1f3565] md:grid-cols-3'>
          <InfoLine label='Дней' value={inclusiveDays(form.date_from, form.date_to)} />
          <InfoLine
            label='Итоговая сумма'
            value={
              form.payment_mode === 'DEFAULT'
                ? 'Начисление по расчетам'
                : formatMoney(fixedTotal)
            }
          />
          <InfoLine label='Режим' value={PAYMENT_MODE_LABELS[form.payment_mode]} />
        </div>

        <ModalActions
          modal={modal}
          isSaving={isSaving}
          canManageAbsences={canManageAbsences}
          canEditCurrentAbsence={canEditCurrentAbsence}
          canChangePast={canChangePast}
          onClose={onClose}
          onDelete={onDelete}
        />
      </form>
    </div>
  );
}

function ModalHeader({
  modal,
  onClose,
}: {
  modal: AbsenceModalState;
  onClose: () => void;
}) {
  return (
    <div className='flex items-start justify-between gap-3'>
      <div>
        <h4 className='text-[20px] font-semibold text-[#10275a]'>
          {modal.mode === 'create' ? 'Добавить отсутствие' : 'Информация об отсутствии'}
        </h4>
        {modal.absence ? (
          <p className='mt-1 text-sm text-[#7e8fb4]'>
            {formatPeriod(modal.absence.date_from, modal.absence.date_to)}
          </p>
        ) : null}
      </div>
      <button
        type='button'
        className='grid size-9 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-[18px] leading-none text-[#1f3565] transition-colors hover:bg-[#f3f7ff] hover:text-[#2d6ff7]'
        onClick={onClose}
        aria-label='Закрыть'
      >
        x
      </button>
    </div>
  );
}

function ModalStateMessages({
  formError,
  isCurrentAbsencePast,
  isCurrentAbsenceStarted,
}: {
  formError: string | null;
  isCurrentAbsencePast: boolean;
  isCurrentAbsenceStarted: boolean;
}) {
  return (
    <>
      {formError ? (
        <div className='rounded-xl border border-[#ffd7dd] bg-[#fff1f3] px-3 py-2 text-sm font-medium text-[#c83f52]'>
          {formError}
        </div>
      ) : null}

      {isCurrentAbsencePast ? (
        <div className='rounded-xl border border-[#e3e9f3] bg-[#f5f7fb] px-3 py-2 text-sm font-medium text-[#7e8fb4]'>
          Полностью прошедшее отсутствие доступно только для просмотра.
        </div>
      ) : isCurrentAbsenceStarted ? (
        <div className='rounded-xl border border-[#ffe1aa] bg-[#fff8ea] px-3 py-2 text-sm font-medium text-[#9a6400]'>
          Отсутствие уже началось. Можно изменить только дату окончания.
        </div>
      ) : null}
    </>
  );
}

function FixedPaymentFields({
  form,
  calculationMonths,
  isCalculating,
  canManageAbsences,
  canEditCurrentAbsence,
  isCurrentAbsenceStarted,
  onFormChange,
  onCalculationMonthsChange,
  onCalculateFixedDailyAmount,
}: {
  form: EmployeeAbsenceForm;
  calculationMonths: EmployeeAbsenceFixedDailyAmountMonths;
  isCalculating: boolean;
  canManageAbsences: boolean;
  canEditCurrentAbsence: boolean;
  isCurrentAbsenceStarted: boolean;
  onFormChange: Dispatch<SetStateAction<EmployeeAbsenceForm>>;
  onCalculationMonthsChange: (_months: EmployeeAbsenceFixedDailyAmountMonths) => void;
  onCalculateFixedDailyAmount: () => void;
}) {
  return (
    <div className='grid min-w-0 gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 md:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)_auto_auto]'>
      <Field label='Фиксированная оплата за день'>
        <input
          type='number'
          min='0'
          step='0.01'
          className={FIELD_CONTROL_CLASS}
          value={form.fixed_daily_amount}
          disabled={!canEditCurrentAbsence || isCurrentAbsenceStarted}
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              fixed_daily_amount: event.target.value,
            }))
          }
        />
      </Field>

      <Field label='Коэффициент'>
        <input
          type='text'
          inputMode='decimal'
          className={FIELD_CONTROL_CLASS}
          value={form.coefficient}
          disabled={!canEditCurrentAbsence || isCurrentAbsenceStarted}
          placeholder='1'
          onChange={(event) =>
            onFormChange((current) => ({
              ...current,
              coefficient: event.target.value,
            }))
          }
        />
      </Field>

      <Field label='Расчет'>
        <StyledSelect
          className='min-w-32'
          value={calculationMonths}
          disabled={!canEditCurrentAbsence || isCurrentAbsenceStarted}
          ariaLabel='Выбрать период расчета'
          options={[
            { value: 1, label: '1 месяц' },
            { value: 1.5, label: '1.5 месяца' },
            { value: 3, label: '3 месяца' },
            { value: 6, label: '6 месяцев' },
            { value: 12, label: '12 месяцев' },
          ]}
          onChange={(value) =>
            onCalculationMonthsChange(
              Number(value) as EmployeeAbsenceFixedDailyAmountMonths,
            )
          }
        />
      </Field>

      {canManageAbsences ? (
        <div className='flex items-end'>
          <Button
            type='button'
            variant='secondary'
            className='h-10 w-full rounded-xl border-[#c9d8f8] bg-white px-4 text-[13px] font-semibold text-[#2d6ff7] hover:bg-[#f3f7ff] md:w-auto'
            disabled={!canEditCurrentAbsence || isCurrentAbsenceStarted || isCalculating}
            onClick={onCalculateFixedDailyAmount}
          >
            {isCalculating ? 'Расчет...' : 'Рассчитать'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ModalActions({
  modal,
  isSaving,
  canManageAbsences,
  canEditCurrentAbsence,
  canChangePast,
  onClose,
  onDelete,
}: {
  modal: AbsenceModalState;
  isSaving: boolean;
  canManageAbsences: boolean;
  canEditCurrentAbsence: boolean;
  canChangePast: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div className='grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between'>
      {modal.absence && canManageAbsences ? (
        <Button
          type='button'
          variant='danger'
          className='h-10 rounded-xl px-4 text-[13px] font-semibold'
          disabled={isSaving || !(canChangePast || canDeleteAbsence(modal.absence))}
          onClick={onDelete}
        >
          Удалить
        </Button>
      ) : (
        <span className='hidden sm:block' />
      )}

      <div className='grid grid-cols-2 gap-2 sm:flex sm:items-center'>
        <Button
          type='button'
          variant='secondary'
          className='h-10 rounded-xl px-4 text-[13px] font-semibold'
          onClick={onClose}
        >
          Закрыть
        </Button>
        {canEditCurrentAbsence ? (
          <Button
            type='submit'
            variant='secondary'
            className='h-10 rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[13px] font-semibold text-white! hover:bg-[#245fd8]!'
            disabled={isSaving}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
