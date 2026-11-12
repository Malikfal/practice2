import { useRef, useState } from 'react';

import Button from '../ui/Button';
import { Field, Input } from '../ui/FormField';
import type { TaskStatusColumn, TaskStatusColumnForm } from '../../types/app';

const COLOR_PRESETS = [
  '#4db6f2',
  '#f29a3f',
  '#ef2d2d',
  '#60c94a',
  '#9c6bff',
  '#2d6ff7',
  '#ff7eb3',
  '#7e8fb4',
];

type Props = {
  isOpen: boolean;
  isSaving: boolean;
  initialColumn?: TaskStatusColumn | null;
  onClose: () => void;
  onSave: (_form: TaskStatusColumnForm) => Promise<void> | void;
};

export default function TaskStatusColumnModal({
  isOpen,
  isSaving,
  initialColumn,
  onClose,
  onSave,
}: Props) {
  if (!isOpen) return null;

  return (
    <TaskStatusColumnModalContent
      key={initialColumn?.id ?? 'new'}
      isSaving={isSaving}
      initialColumn={initialColumn}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function TaskStatusColumnModalContent({
  isSaving,
  initialColumn,
  onClose,
  onSave,
}: Omit<Props, 'isOpen'>) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const [name, setName] = useState(initialColumn?.name ?? initialColumn?.label ?? '');
  const [color, setColor] = useState(initialColumn?.color ?? COLOR_PRESETS[0]);
  const [isFinal, setIsFinal] = useState(Boolean(initialColumn?.is_final));

  const isEdit = Boolean(initialColumn);
  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (trimmedName === '') return;

    await onSave({
      name: trimmedName,
      color,
      is_final: isFinal,
    });
  };

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] md:p-4'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose && !isSaving) onClose();
      }}
    >
      <div
        className='max-h-[calc(100dvh-1rem)] w-full max-w-[604px] overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 md:overflow-auto md:rounded-2xl md:p-4'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <h2 className='text-base font-semibold text-[#10275a]'>
            {isEdit ? 'Редактировать колонку' : 'Новая колонка'}
          </h2>
          <Button type='button' variant='secondary' size='sm' onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <form
          className='grid gap-3'
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Field label='Название' className='text-[#1f3565]'>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
              maxLength={255}
              className='h-10 rounded-xl border-[#c9d8f8] bg-white text-[14px] text-[#1f3565] placeholder:text-[#9aa8c7] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
            />
          </Field>

          <div className='grid gap-2'>
            <span className='text-[12px] font-semibold text-[#7e8fb4]'>Цвет</span>
            <div className='flex flex-wrap items-center gap-2'>
              {COLOR_PRESETS.map((preset) => {
                const isActive = preset.toLowerCase() === (color ?? '').toLowerCase();
                return (
                  <button
                    key={preset}
                    type='button'
                    onClick={() => setColor(preset)}
                    className={`grid size-7 place-items-center rounded-full border-2 transition-transform ${
                      isActive
                        ? 'border-[#2d6ff7] scale-110'
                        : 'border-transparent hover:border-[#c9d8f8]'
                    }`}
                    title={preset}
                    aria-label={`Цвет ${preset}`}
                  >
                    <span
                      className='size-5 rounded-full'
                      style={{ backgroundColor: preset }}
                    />
                  </button>
                );
              })}

              <label className='flex items-center gap-2 text-[12px] text-[#7e8fb4]'>
                <input
                  type='color'
                  value={color || '#2d6ff7'}
                  onChange={(event) => setColor(event.target.value)}
                  className='h-7 w-7 cursor-pointer rounded border border-[#c9d8f8] bg-white p-0'
                />
                Свой
              </label>
            </div>
          </div>

          {isEdit ? (
            <label className='flex items-center gap-2 text-[13px] text-[#1f3565]'>
              <input
                type='checkbox'
                checked={isFinal}
                onChange={(event) => setIsFinal(event.target.checked)}
                className='size-4 accent-[#2d6ff7]'
              />
              Финальный статус (задачи в этой колонке считаются завершёнными)
            </label>
          ) : null}

          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='secondary' size='sm' onClick={onClose}>
              Отмена
            </Button>
            <Button
              type='submit'
              variant='primary'
              size='sm'
              disabled={isSaving || name.trim() === ''}
            >
              {isSaving ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
