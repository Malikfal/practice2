import { useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react';

import { useEscapeToClose } from '../../../../hooks/useEscapeToClose';
import Button from '../../../ui/Button';
import {
  clientInputClasses,
  clientInputStateClasses,
  Field,
  PhoneInput,
} from '../../../ui/FormField';
import { formatDateLocal } from '../../../../utils/formatters';
import type {
  ClientContact,
  ClientForm,
  ClientLegalEntity,
  ClientLegalEntityBankDetail,
  ClientProject,
} from '../../../../types/app';
import { currencySymbol } from '../../../../utils/currency';

export type ClientTab =
  | 'general'
  | 'contacts'
  | 'legal'
  | 'projects'
  | 'finances'
  | 'flow';
export type FieldErrors = Record<string, string>;

export const emptyClientForm: ClientForm = { name: '', description: '' };
export const emptyContactForm: ClientContact = {
  first_name: '',
  last_name: '',
  middle_name: '',
  email: '',
  phone: '',
  position: '',
  comments: '',
  payload: null,
};
export const emptyLegalEntityForm: ClientLegalEntity = {
  name: '',
  legal_address: '',
  postal_code: '',
  inn: '',
  kpp: '',
  ogrn: '',
  signer_last_name: '',
  signer_first_name: '',
  signer_middle_name: '',
  signer_position: '',
  phone: '',
  email: '',
  bank_details: [],
};
export const emptyBankDetailForm: ClientLegalEntityBankDetail = {
  checking_account: '',
  bank: '',
  bik: '',
  correspondent_account: '',
};

export function nullablePayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() || null : value,
    ]),
  ) as T;
}

export function requiredErrors(
  payload: Record<string, string | null | undefined>,
  labels: Record<string, string>,
): FieldErrors {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([key]) => !String(payload[key] ?? '').trim())
      .map(([key, label]) => [key, `Заполните ${label}.`]),
  );
}

function formatHourlyRate(value?: number | null, currency?: string | null) {
  if (value == null) return '—';
  return `${new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  }).format(value / 100)} ${currencySymbol(currency)}/ч`;
}

export function fullContactName(contact: ClientContact) {
  return [contact.last_name, contact.first_name, contact.middle_name]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function DialogShell({
  children,
  maxWidth = 'max-w-[560px]',
  panelClassName = '',
  isSaving = false,
  onClose,
}: {
  children: React.ReactNode;
  maxWidth?: string;
  panelClassName?: string;
  /** Пока идёт сохранение, окно не закрывается по Esc. */
  isSaving?: boolean;
  onClose: () => void;
}) {
  const shouldCloseRef = useRef(false);
  useEscapeToClose(() => {
    if (!isSaving) onClose();
  });

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-4 text-[#1f3565]'
      onMouseDown={(event) => {
        shouldCloseRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseRef.current && event.target === event.currentTarget;
        shouldCloseRef.current = false;
        if (shouldClose) onClose();
      }}
    >
      <div
        className={`max-h-[90vh] w-full ${maxWidth} overflow-auto rounded-2xl border border-[#e3e9f3] bg-white shadow-2xl shadow-slate-900/20 ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function TextInput({
  label,
  value,
  error,
  required,
  textarea,
  onChange,
  placeholder,
  readOnly,
  type = 'text',
  inputMode,
  hint,
}: {
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  textarea?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  hint?: string;
  onChange: (_value: string) => void;
}) {
  const className = [
    clientInputClasses,
    error
      ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
      : clientInputStateClasses,
    readOnly ? 'bg-[#f3f7ff] disabled:bg-[#f3f7ff]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className='grid gap-1.5 text-[13px] font-semibold text-[#1f3565]'>
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      {textarea ? (
        <textarea
          value={value}
          readOnly={readOnly}
          rows={4}
          placeholder={placeholder}
          className={`${className} min-h-28 resize-y`}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          className={className}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error ? <span className='text-[12px] text-rose-600'>{error}</span> : null}
      {hint && !error ? (
        <span className='text-[12px] font-normal text-[#7e8fb4]'>{hint}</span>
      ) : null}
    </label>
  );
}

export function Actions({
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  return (
    <div className='flex items-center justify-end gap-2'>
      {canEdit ? (
        <button
          type='button'
          className='text-[#7e8fb4] transition-colors hover:text-[#2d6ff7]'
          title='Редактировать'
          onClick={onEdit}
        >
          <svg
            className='size-4 fill-none stroke-current stroke-[1.8]'
            viewBox='0 0 24 24'
          >
            <path d='M12 20h9' />
            <path d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' />
          </svg>
        </button>
      ) : null}
      {canDelete ? (
        <button
          type='button'
          className='text-[#7e8fb4] transition-colors hover:text-[#c83f52]'
          title='Удалить'
          onClick={onDelete}
        >
          <svg
            className='size-4 fill-none stroke-current stroke-[1.8]'
            viewBox='0 0 24 24'
          >
            <path d='M3 6h18' />
            <path d='M8 6V4h8v2' />
            <path d='M19 6l-1 14H6L5 6' />
            <path d='M10 11v6M14 11v6' />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function ClientModal({
  title,
  submitLabel,
  isSaving,
  form,
  errors,
  onChange,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  isSaving: boolean;
  form: ClientForm;
  errors: FieldErrors;
  onChange: (_next: ClientForm) => void;
  onClose: () => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <DialogShell
      isSaving={isSaving}
      onClose={onClose}
      maxWidth='max-w-[760px]'
      panelClassName='overflow-hidden p-0'
    >
      <div className='px-4 pt-4'>
        <h2 className='mb-3 text-[18px] font-semibold text-[#10275a]'>{title}</h2>
      </div>
      <form
        className='flex max-h-[min(600px,calc(90vh-88px))] min-h-0 flex-col'
        onSubmit={onSubmit}
      >
        <div className='grid min-h-0 flex-1 gap-2.5 overflow-y-auto px-4 pb-3 pr-3 [scrollbar-color:#c9d8f8_transparent] [scrollbar-width:thin]'>
          <TextInput
            label='Наименование'
            required
            value={form.name}
            error={errors.name}
            placeholder='ООО Компания'
            onChange={(name) => onChange({ ...form, name })}
          />
          <TextInput
            label='Описание'
            textarea
            value={form.description}
            error={errors.description}
            placeholder='Введите дополнительную информацию...'
            onChange={(description) => onChange({ ...form, description })}
          />
          {form.weekly_limit_hours !== undefined ? (
            <TextInput
              label='Недельный лимит, ч'
              inputMode='decimal'
              value={form.weekly_limit_hours}
              error={errors.weekly_limit_hours}
              placeholder='Не задан, например 15 или 7,5'
              hint='Общий на все проекты клиента и главнее лимита проекта. Пусто — без лимита.'
              onChange={(weekly_limit_hours) => onChange({ ...form, weekly_limit_hours })}
            />
          ) : null}
        </div>
        <div className='shrink-0 border-t border-[#e3e9f3] bg-white px-4 py-3'>
          <ModalActions
            isSaving={isSaving}
            savingLabel='Сохранение...'
            submitLabel={submitLabel}
            onClose={onClose}
          />
        </div>
      </form>
    </DialogShell>
  );
}

function ModalActions({
  isSaving,
  submitLabel,
  savingLabel,
  onClose,
}: {
  isSaving: boolean;
  submitLabel: string;
  savingLabel: string;
  onClose?: () => void;
}) {
  return (
    <div className='mt-2 flex justify-end gap-2'>
      {onClose ? (
        <Button
          type='button'
          variant='secondary'
          onClick={onClose}
          className='h-10 rounded-xl border-[#e3e9f3] bg-white px-4 text-[13px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
        >
          Отмена
        </Button>
      ) : null}
      <Button
        type='submit'
        disabled={isSaving}
        variant='secondary'
        className='h-10 rounded-xl border-transparent! bg-[#2d6ff7]! px-5 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! disabled:bg-[#2d6ff7]! disabled:text-white! disabled:opacity-80'
      >
        {isSaving ? savingLabel : submitLabel}
      </Button>
    </div>
  );
}

export function ContactModal({
  contact,
  isSaving,
  errors,
  onClose,
  onSave,
}: {
  contact: ClientContact | null;
  isSaving: boolean;
  errors: FieldErrors;
  onClose: () => void;
  onSave: (_form: ClientContact) => void;
}) {
  const [form, setForm] = useState<ClientContact>(contact ?? emptyContactForm);
  const [payloadFields, setPayloadFields] = useState<
    Array<{ key: string; value: string }>
  >(() =>
    Object.entries(form.payload ?? {}).map(([key, value]) => ({
      key,
      value:
        typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value),
    })),
  );
  const [payloadError, setPayloadError] = useState('');
  const set = (key: keyof ClientContact, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submitContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const filledPayloadFields = payloadFields
      .map((field) => ({
        key: field.key.trim(),
        value: field.value.trim(),
      }))
      .filter((field) => field.key || field.value);

    if (filledPayloadFields.some((field) => !field.key)) {
      setPayloadError('Укажите название для каждого дополнительного поля.');
      return;
    }

    const payload = filledPayloadFields.length
      ? Object.fromEntries(filledPayloadFields.map((field) => [field.key, field.value]))
      : null;

    setPayloadError('');
    onSave(nullablePayload({ ...form, payload }) as ClientContact);
  };

  return (
    <DialogShell
      isSaving={isSaving}
      onClose={onClose}
      maxWidth='max-w-[760px]'
      panelClassName='overflow-hidden p-0'
    >
      <div className='px-4 pt-4'>
        <h2 className='mb-3 text-[18px] font-semibold text-[#10275a]'>
          {contact?.id ? 'Редактировать контакт' : 'Новый контакт'}
        </h2>
      </div>
      <form
        className='flex max-h-[min(600px,calc(90vh-88px))] min-h-0 flex-col'
        onSubmit={submitContact}
      >
        <div className='grid min-h-0 flex-1 gap-2.5 overflow-y-auto px-4 pb-3 pr-3 [scrollbar-color:#c9d8f8_transparent] [scrollbar-width:thin]'>
          <TextInput
            label='Имя'
            required
            value={form.first_name}
            error={errors.first_name}
            placeholder='Иван'
            onChange={(value) => set('first_name', value)}
          />
          <div className='grid gap-2.5 sm:grid-cols-2'>
            <TextInput
              label='Фамилия'
              value={form.last_name ?? ''}
              error={errors.last_name}
              placeholder='Иванов'
              onChange={(value) => set('last_name', value)}
            />
            <TextInput
              label='Отчество'
              value={form.middle_name ?? ''}
              error={errors.middle_name}
              placeholder='Иванович'
              onChange={(value) => set('middle_name', value)}
            />
            <TextInput
              label='Email'
              value={form.email ?? ''}
              error={errors.email}
              placeholder='ivan@company.ru'
              onChange={(value) => set('email', value)}
            />
            <Field label='Телефон' className='text-[#1f3565]'>
              <PhoneInput
                value={form.phone ?? ''}
                placeholder='+7 (XXX) XXX-XX-XX'
                onValueChange={(value) => set('phone', value)}
              />
            </Field>
          </div>
          <TextInput
            label='Должность'
            value={form.position ?? ''}
            error={errors.position}
            placeholder='Введите должность'
            onChange={(value) => set('position', value)}
          />
          <div className='grid gap-2'>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-[13px] font-semibold text-[#1f3565]'>
                Дополнительные поля
              </span>
              <Button
                type='button'
                size='sm'
                variant='secondary'
                className='h-8 rounded-xl border-[#e3e9f3] px-3 text-[12px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
                onClick={() =>
                  setPayloadFields((prev) => [...prev, { key: '', value: '' }])
                }
              >
                + Добавить поле
              </Button>
            </div>
            {payloadFields.map((field, index) => (
              <div
                key={index}
                className='grid gap-2 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end'
              >
                <TextInput
                  label='Название поля'
                  value={field.key}
                  placeholder='Например, Telegram'
                  onChange={(value) =>
                    setPayloadFields((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, key: value } : item,
                      ),
                    )
                  }
                />
                <TextInput
                  label='Значение'
                  value={field.value}
                  placeholder='Например, @user'
                  onChange={(value) =>
                    setPayloadFields((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value } : item,
                      ),
                    )
                  }
                />
                <button
                  type='button'
                  className='grid h-10 w-full place-items-center rounded-xl border border-[#e3e9f3] text-[#7e8fb4] transition-colors hover:bg-[#f3f7ff] hover:text-[#c83f52] sm:w-10'
                  title='Удалить поле'
                  onClick={() =>
                    setPayloadFields((prev) =>
                      prev.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
            {payloadError ? (
              <span className='text-[12px] font-semibold text-rose-600'>
                {payloadError}
              </span>
            ) : null}
          </div>
          <TextInput
            label='Комментарии'
            textarea
            value={form.comments ?? ''}
            error={errors.comments}
            placeholder='Введите дополнительную информацию...'
            onChange={(value) => set('comments', value)}
          />
        </div>
        <div className='shrink-0 border-t border-[#e3e9f3] bg-white px-4 py-3'>
          <ModalActions
            isSaving={isSaving}
            savingLabel='Сохранение...'
            submitLabel={contact?.id ? 'Сохранить' : 'Добавить контакт'}
            onClose={onClose}
          />
        </div>
      </form>
    </DialogShell>
  );
}

function BankDetailForm({
  value,
  errors,
  onChange,
}: {
  value: ClientLegalEntityBankDetail;
  errors: FieldErrors;
  onChange: (_next: ClientLegalEntityBankDetail) => void;
}) {
  const set = (key: keyof ClientLegalEntityBankDetail, fieldValue: string) =>
    onChange({ ...value, [key]: fieldValue });

  return (
    <div className='grid gap-2 rounded-xl bg-[#f7f9fc] p-3'>
      <TextInput
        label='Расчетный счет'
        required
        value={value.checking_account}
        error={errors.checking_account}
        placeholder='40702810000000000001'
        onChange={(v) => set('checking_account', v)}
      />
      <TextInput
        label='Банк'
        required
        value={value.bank}
        error={errors.bank}
        placeholder='ПАО Сбербанк'
        onChange={(v) => set('bank', v)}
      />
      <TextInput
        label='БИК'
        required
        value={value.bik}
        error={errors.bik}
        placeholder='044525225'
        onChange={(v) => set('bik', v)}
      />
      <TextInput
        label='Корреспондентский счет'
        required
        value={value.correspondent_account}
        error={errors.correspondent_account}
        placeholder='30101810400000000225'
        onChange={(v) => set('correspondent_account', v)}
      />
    </div>
  );
}

export function LegalEntityModal({
  entity,
  isSaving,
  errors,
  bankErrors,
  onClose,
  onSave,
  onEditBankDetail,
  onDeleteBankDetail,
}: {
  entity: ClientLegalEntity | null;
  isSaving: boolean;
  errors: FieldErrors;
  bankErrors: FieldErrors;
  onClose: () => void;
  onSave: (
    _form: ClientLegalEntity,
    _newBankDetails: ClientLegalEntityBankDetail[],
  ) => void;
  onEditBankDetail: (
    _entity: ClientLegalEntity,
    _detail: ClientLegalEntityBankDetail,
  ) => void;
  onDeleteBankDetail: (_entityId: string, _detailId: string) => void;
}) {
  const [form, setForm] = useState<ClientLegalEntity>(entity ?? emptyLegalEntityForm);
  const [newBankDetails, setNewBankDetails] = useState<ClientLegalEntityBankDetail[]>([]);
  const set = (key: keyof ClientLegalEntity, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <DialogShell
      isSaving={isSaving}
      onClose={onClose}
      maxWidth='max-w-[760px]'
      panelClassName='overflow-hidden p-0'
    >
      <div className='px-4 pt-4'>
        <h2 className='mb-3 text-[18px] font-semibold text-[#10275a]'>
          {entity?.id ? 'Редактировать юр. лицо' : 'Новое юр. лицо'}
        </h2>
      </div>
      <form
        className='flex max-h-[min(640px,calc(90vh-88px))] min-h-0 flex-col'
        onSubmit={(event) => {
          event.preventDefault();
          onSave(
            nullablePayload(
              form as unknown as Record<string, unknown>,
            ) as unknown as ClientLegalEntity,
            newBankDetails,
          );
        }}
      >
        <div className='grid min-h-0 flex-1 gap-3 overflow-y-auto px-4 pb-3 pr-3 [scrollbar-color:#c9d8f8_transparent] [scrollbar-width:thin]'>
          <section className='grid gap-2.5'>
            <h3 className='text-[14px] font-bold text-[#10275a]'>Основные данные</h3>
            <TextInput
              label='Наименование'
              required
              value={form.name}
              error={errors.name}
              placeholder='ООО Компания'
              onChange={(v) => set('name', v)}
            />
            <div className='grid gap-2.5 sm:grid-cols-2'>
              <TextInput
                label='Юридический адрес'
                required
                value={form.legal_address}
                error={errors.legal_address}
                placeholder='г. Киров, ул. Ленина, 1'
                onChange={(v) => set('legal_address', v)}
              />
              <TextInput
                label='Почтовый адрес'
                required
                value={form.postal_code}
                error={errors.postal_code}
                placeholder='г. Киров, ул. Ленина, 1'
                onChange={(v) => set('postal_code', v)}
              />
              <TextInput
                label='ИНН'
                required
                value={form.inn}
                error={errors.inn}
                placeholder='123456789012'
                onChange={(v) => set('inn', v)}
              />
              <TextInput
                label='КПП'
                value={form.kpp ?? ''}
                error={errors.kpp}
                placeholder='123456789'
                onChange={(v) => set('kpp', v)}
              />
              <TextInput
                label='ОГРН'
                value={form.ogrn ?? ''}
                error={errors.ogrn}
                placeholder='1234567890123'
                onChange={(v) => set('ogrn', v)}
              />
            </div>
          </section>
          <section className='grid gap-2.5 border-t border-[#e3e9f3] pt-3'>
            <h3 className='text-[14px] font-bold text-[#10275a]'>Подписант</h3>
            <div className='grid gap-2.5 sm:grid-cols-3'>
              <TextInput
                label='Фамилия'
                value={form.signer_last_name ?? ''}
                error={errors.signer_last_name}
                placeholder='Иванов'
                onChange={(v) => set('signer_last_name', v)}
              />
              <TextInput
                label='Имя'
                value={form.signer_first_name ?? ''}
                error={errors.signer_first_name}
                placeholder='Иван'
                onChange={(v) => set('signer_first_name', v)}
              />
              <TextInput
                label='Отчество'
                value={form.signer_middle_name ?? ''}
                error={errors.signer_middle_name}
                placeholder='Иванович'
                onChange={(v) => set('signer_middle_name', v)}
              />
            </div>
            <TextInput
              label='Должность'
              value={form.signer_position ?? ''}
              error={errors.signer_position}
              placeholder='Генеральный директор'
              onChange={(v) => set('signer_position', v)}
            />
          </section>
          <section className='grid gap-2.5 border-t border-[#e3e9f3] pt-3'>
            <h3 className='text-[14px] font-bold text-[#10275a]'>Контакты</h3>
            <div className='grid gap-2.5 sm:grid-cols-2'>
              <Field label='Телефон' className='text-[#1f3565]'>
                <PhoneInput
                  value={form.phone ?? ''}
                  placeholder='+7 (XXX) XXX-XX-XX'
                  onValueChange={(value) => set('phone', value)}
                  className='h-10 rounded-xl border-[#c9d8f8] bg-white text-[14px] text-[#1f3565] placeholder:text-[#9aa8c7] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] read-only:focus:border-[#c9d8f8] read-only:focus:ring-0'
                />
              </Field>
              <TextInput
                label='Email'
                value={form.email ?? ''}
                error={errors.email}
                placeholder='user@company.ru'
                onChange={(v) => set('email', v)}
              />
            </div>
          </section>
          <section className='grid gap-2.5 border-t border-[#e3e9f3] pt-3'>
            <div className='flex items-center justify-between gap-3'>
              <h3 className='text-[14px] font-bold text-[#10275a]'>
                Банковские реквизиты
              </h3>
              <Button
                type='button'
                size='sm'
                variant='secondary'
                className='h-8 rounded-xl border-[#e3e9f3] px-3 text-[12px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
                onClick={() =>
                  setNewBankDetails((prev) => [...prev, emptyBankDetailForm])
                }
              >
                + Добавить реквизиты
              </Button>
            </div>
            {(form.bank_details ?? []).map((detail) => (
              <div
                key={detail.id}
                className='flex items-start justify-between gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 text-[13px] text-[#1f3565]'
              >
                <BankDetailText detail={detail} />
                {entity?.id ? (
                  <Actions
                    canEdit
                    canDelete
                    onEdit={() => onEditBankDetail(entity, detail)}
                    onDelete={() =>
                      detail.id && entity.id && onDeleteBankDetail(entity.id, detail.id)
                    }
                  />
                ) : null}
              </div>
            ))}
            {newBankDetails.map((detail, index) => (
              <div key={index} className='grid gap-2'>
                <BankDetailForm
                  value={detail}
                  errors={bankErrors}
                  onChange={(next) =>
                    setNewBankDetails((prev) =>
                      prev.map((item, itemIndex) => (itemIndex === index ? next : item)),
                    )
                  }
                />
                <div className='flex justify-end'>
                  <Button
                    type='button'
                    size='sm'
                    variant='secondary'
                    onClick={() =>
                      setNewBankDetails((prev) =>
                        prev.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ))}
          </section>
        </div>
        <div className='shrink-0 border-t border-[#e3e9f3] bg-white px-4 py-3'>
          <ModalActions
            isSaving={isSaving}
            savingLabel='Сохранение...'
            submitLabel={entity?.id ? 'Сохранить' : 'Добавить юр. лицо'}
            onClose={onClose}
          />
        </div>
      </form>
    </DialogShell>
  );
}

export function BankDetailModal({
  detail,
  isSaving,
  errors,
  onClose,
  onSave,
}: {
  detail: ClientLegalEntityBankDetail | null;
  isSaving: boolean;
  errors: FieldErrors;
  onClose: () => void;
  onSave: (_form: ClientLegalEntityBankDetail) => void;
}) {
  const [form, setForm] = useState(detail ?? emptyBankDetailForm);
  return (
    <DialogShell
      isSaving={isSaving}
      onClose={onClose}
      maxWidth='max-w-[520px]'
      panelClassName='overflow-hidden p-0'
    >
      <div className='px-4 pt-4'>
        <h2 className='mb-3 text-[18px] font-semibold text-[#10275a]'>
          {detail?.id ? 'Редактировать реквизиты' : 'Новые реквизиты'}
        </h2>
      </div>
      <form
        className='flex max-h-[min(560px,calc(90vh-88px))] min-h-0 flex-col'
        onSubmit={(event) => {
          event.preventDefault();
          onSave(
            nullablePayload(
              form as unknown as Record<string, unknown>,
            ) as unknown as ClientLegalEntityBankDetail,
          );
        }}
      >
        <div className='grid min-h-0 flex-1 gap-2.5 overflow-y-auto px-4 pb-3 pr-3 [scrollbar-color:#c9d8f8_transparent] [scrollbar-width:thin]'>
          <BankDetailForm value={form} errors={errors} onChange={setForm} />
        </div>
        <div className='shrink-0 border-t border-[#e3e9f3] bg-white px-4 py-3'>
          <ModalActions
            isSaving={isSaving}
            savingLabel='Сохранение...'
            submitLabel='Сохранить'
            onClose={onClose}
          />
        </div>
      </form>
    </DialogShell>
  );
}

export function BankDetailText({ detail }: { detail: ClientLegalEntityBankDetail }) {
  return (
    <div className='grid gap-0.5'>
      <p>
        <b>Расчетный счет:</b> {detail.checking_account}
      </p>
      <p>
        <b>Банк:</b> {detail.bank}
      </p>
      <p>
        <b>БИК:</b> {detail.bik}
      </p>
      <p>
        <b>Корреспондентский счет:</b> {detail.correspondent_account}
      </p>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className='rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-6 text-center text-[14px] text-[#7e8fb4]'>
      {text}
    </div>
  );
}

export function InfoBox({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <div className='mt-2 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 text-[13px]'>
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <p key={label}>
            <b>{label}:</b> {value}
          </p>
        ))}
    </div>
  );
}

export function ProjectCard({ project }: { project: ClientProject }) {
  const status = project.status_label || project.status || '—';
  const currentRate = project.current_rate;
  const rateLabel = formatHourlyRate(currentRate?.rate ?? null, currentRate?.currency);
  const rateMeta = currentRate
    ? [
        currentRate.vat != null ? `НДС ${currentRate.vat}%` : null,
        currentRate.effective_from
          ? `с ${formatDateLocal(currentRate.effective_from)}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  return (
    <article className='rounded-xl border border-[#e3e9f3] bg-white p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <a
            href={`/projects?project_id=${project.id}`}
            className='font-semibold text-[#2d6ff7] hover:underline'
          >
            {project.name}
          </a>
          <p className='mt-1 text-[13px] text-[#7e8fb4]'>
            {project.description || 'Не указано'}
          </p>
        </div>
        <span className='rounded-lg bg-[#e8f6eb] px-2 py-1 text-[11px] font-semibold text-[#3e8d59]'>
          {status}
        </span>
      </div>
      <div className='mt-4 grid gap-2 text-[13px] text-[#1f3565] sm:grid-cols-3'>
        <span>
          Ставка: <b>{rateLabel}</b>
        </span>
        <span className='sm:col-span-2 text-[#7e8fb4]'>{rateMeta || ' '}</span>
      </div>
    </article>
  );
}
