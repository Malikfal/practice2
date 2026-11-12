import { useMemo, useState } from 'react';

import Button from '../../../ui/Button';
import { Field, Select } from '../../../ui/FormField';

type Props = {
  canManage: boolean;
  isSaving: boolean;
  value: string;
  availableStatuses: string[];
  // Тексты различаются для задач трекера и задач, созданных клиентом.
  title: string;
  description: string;
  currentHint: string;
  resultText: string;
  onSave: (_statusName: string) => Promise<void> | void;
};

function formatVariantsCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} вариантов`;
  }

  if (mod10 === 1) {
    return `${count} вариант`;
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} варианта`;
  }

  return `${count} вариантов`;
}

export default function TaskStatusSettingPanel({
  canManage,
  isSaving,
  value,
  availableStatuses,
  title,
  description,
  currentHint,
  resultText,
  onSave,
}: Props) {
  const options = useMemo(
    () => Array.from(new Set([value, ...availableStatuses])),
    [availableStatuses, value],
  );
  const [draftValue, setDraftValue] = useState(value);

  const isDirty = draftValue !== value;
  const currentStatusLabel = value || 'Без статуса';

  return (
    <section className='grid gap-4 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 md:p-4'>
      <div className='grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.75fr)]'>
        <div className='grid content-start gap-4'>
          <div className='grid gap-1'>
            <h2 className='text-[18px] leading-tight font-semibold text-[#10275a] md:text-[20px] md:leading-none'>
              {title}
            </h2>
            <p className='text-[13px] leading-6 text-[#7082a8]'>{description}</p>
          </div>

          <Field label='Статус' className='text-[#1f3565]'>
            <Select
              value={draftValue}
              disabled={!canManage || isSaving}
              onChange={(event) => setDraftValue(event.target.value)}
              className='h-11 rounded-xl border-[#c9d8f8] bg-white text-base text-[#1f3565] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] disabled:bg-[#f7f9fc] md:h-10 md:text-[14px]'
            >
              {options.map((statusName) => (
                <option key={statusName} value={statusName}>
                  {statusName}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className='grid content-start gap-3'>
          <div className='flex items-center justify-between gap-3'>
            <h2 className='text-[18px] leading-tight font-semibold text-[#10275a] md:text-[20px] md:leading-none'>
              Выбор
            </h2>
            <span className='rounded-full border border-[#dce7ff] bg-[#edf3ff] px-2.5 py-1 text-[11px] font-semibold text-[#2d6ff7]'>
              {formatVariantsCount(options.length)}
            </span>
          </div>

          <div className='rounded-xl border border-[#dce7ff] bg-white px-4 py-4'>
            <span className='mb-1 block text-[12px] font-semibold text-[#7e8fb4] uppercase tracking-[0.14em]'>
              Текущий статус
            </span>
            <p className='text-[14px] leading-6 text-[#10275a]'>{currentStatusLabel}</p>
            <p className='text-[12px] text-[#7e8fb4]'>{currentHint}</p>
          </div>

          <div className='rounded-xl border border-[#dce7ff] bg-white px-4 py-4'>
            <span className='mb-1 block text-[12px] font-semibold text-[#7e8fb4] uppercase tracking-[0.14em]'>
              После сохранения
            </span>
            <p className='text-[13px] leading-5 text-[#5f7095]'>
              {resultText}{' '}
              <span className='font-semibold text-[#10275a]'>{draftValue}</span>.
            </p>
          </div>

          <div className='rounded-lg border border-[#e3e9f3] bg-white px-3 py-3'>
            <p className='text-[13px] leading-5 text-[#5f7095]'>
              Если в проекте нет статуса{' '}
              <span className='font-semibold'>«{draftValue}»</span>, задача создастся без
              статуса и окажется в специальной колонке.
            </p>
          </div>
        </div>
      </div>

      <div className='flex flex-col gap-3 border-t border-[#e8eef8] pt-4 md:flex-row md:items-center md:justify-between'>
        <p className='text-[13px] leading-5 text-[#7e8fb4]'>
          {isDirty
            ? 'Есть несохранённые изменения. После сохранения новая настройка начнёт применяться сразу.'
            : 'Настройка сохранена и уже используется для новых задач.'}
        </p>
        <Button
          type='button'
          variant='primary'
          size='sm'
          className='h-11 w-full rounded-xl px-4 text-[13px] md:h-10 md:w-auto'
          disabled={!canManage || isSaving || !isDirty}
          onClick={() => void onSave(draftValue)}
        >
          {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
        </Button>
      </div>
    </section>
  );
}
