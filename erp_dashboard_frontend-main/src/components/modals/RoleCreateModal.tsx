import { useRef, type FormEvent } from 'react';

import Button from '../ui/Button';
import { Field, Input } from '../ui/FormField';

export default function RoleCreateModal({
  isOpen,
  isSaving,
  mode,
  displayName,
  error,
  onDisplayNameChange,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isSaving: boolean;
  mode: 'create' | 'edit';
  displayName: string;
  error: string;
  onDisplayNameChange: (_value: string) => void;
  onClose: () => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);

  if (!isOpen) return null;

  const isEditMode = mode === 'edit';

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

        if (shouldClose) {
          onClose();
        }
      }}
    >
      <div
        className='max-h-[calc(100dvh-1rem)] w-full max-w-194.5 overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 md:overflow-auto md:rounded-2xl md:p-5'
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className='mb-4 text-[18px] leading-none font-semibold'>
          {isEditMode ? 'Переименовать роль' : 'Новая роль'}
        </h2>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(event);
          }}
          className='grid gap-3'
        >
          <Field label='Отображаемое имя *'>
            <Input
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder='Например: Тимлид'
              required
              autoFocus
              className='min-h-11 rounded-xl border-[#e3e9f3] text-base text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff] md:min-h-0 md:text-sm'
            />
          </Field>

          <p className='text-xs text-slate-500'>
            {isEditMode
              ? 'Изменится только отображаемое имя роли.'
              : 'Код роли создаётся автоматически из этого имени по транслитерации.'}
          </p>

          {error ? <p className='text-xs text-rose-600'>{error}</p> : null}

          <div className='mt-2 grid gap-2 sm:flex sm:justify-end'>
            <Button
              type='button'
              variant='secondary'
              onClick={onClose}
              className='min-h-11 w-full rounded-xl border-[#e3e9f3] bg-white px-4 text-[13px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff] sm:h-10 sm:min-h-0 sm:w-auto'
            >
              Отмена
            </Button>
            <Button
              type='submit'
              disabled={isSaving}
              variant='secondary'
              className='min-h-11 w-full rounded-xl border-transparent! bg-[#2d6ff7]! px-5 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! disabled:bg-[#2d6ff7]! disabled:text-white! disabled:opacity-80 sm:h-10 sm:min-h-0 sm:w-auto'
            >
              {isSaving
                ? isEditMode
                  ? 'Сохранение...'
                  : 'Создание...'
                : isEditMode
                  ? 'Сохранить'
                  : 'Создать роль'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
