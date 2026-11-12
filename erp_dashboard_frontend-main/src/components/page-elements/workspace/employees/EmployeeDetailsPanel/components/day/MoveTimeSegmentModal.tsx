import { useMemo, useRef, type FormEvent } from 'react';

import Button from '../../../../../../ui/Button';
import { Field, Input, SearchableSelect } from '../../../../../../ui/FormField';
import {
  formatDurationHms,
  formatTimeRangeLocal,
  toDateFromApiTime,
} from '../../../../../../../utils/formatters';
import type {
  MoveTimeSegmentForm,
  Project,
  Task,
  TimelineSegment,
} from '../../../../../../../types/app';

function toDateTimeLocalValue(value: string | number): string {
  const date = toDateFromApiTime(value);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 19);
}

type Props = {
  isOpen: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  isLoadingProjects: boolean;
  isLoadingTasks: boolean;
  segment: TimelineSegment | null;
  form: MoveTimeSegmentForm;
  projects: Project[];
  tasks: Task[];
  onChange: (_nextForm: MoveTimeSegmentForm) => void;
  onClose: () => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
};

export default function MoveTimeSegmentModal({
  isOpen,
  isSubmitting,
  isDeleting,
  isLoadingProjects,
  isLoadingTasks,
  segment,
  form,
  projects,
  tasks,
  onChange,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const shouldCloseOnBackdropClickRef = useRef(false);

  const minDateTime = useMemo(
    () => (segment ? toDateTimeLocalValue(segment.clamped_started_at) : ''),
    [segment],
  );
  const maxDateTime = useMemo(
    () => (segment ? toDateTimeLocalValue(segment.clamped_ended_at) : ''),
    [segment],
  );

  if (!isOpen || !segment) return null;

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

        if (shouldClose) {
          onClose();
        }
      }}
    >
      <div
        className='max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/20 sm:max-h-[90vh] sm:rounded-2xl sm:p-4 md:overflow-auto'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-3 flex items-center justify-between gap-3'>
          <h2 className='text-base font-semibold text-slate-800'>Перенос времени</h2>
          <Button type='button' variant='secondary' size='sm' onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className='mb-3 grid gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm'>
          <p className='text-slate-700'>
            Исходный сегмент:{' '}
            <span className='font-semibold text-slate-900'>
              {formatTimeRangeLocal(
                segment.clamped_started_at,
                segment.clamped_ended_at,
                {
                  includeSeconds: true,
                },
              )}
            </span>{' '}
            ({formatDurationHms(segment.duration_seconds)})
          </p>
          <p className='text-slate-600'>
            {segment.project_name || '—'} - {segment.task_name || '—'}
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(event);
          }}
          className='grid gap-3'
        >
          <div className='grid gap-2.5 md:grid-cols-2'>
            <Field label='Начало переносимого интервала'>
              <Input
                type='datetime-local'
                value={form.move_from}
                min={minDateTime}
                max={maxDateTime}
                step='1'
                onChange={(event) => onChange({ ...form, move_from: event.target.value })}
                required
              />
            </Field>
            <Field label='Окончание переносимого интервала'>
              <Input
                type='datetime-local'
                value={form.move_to}
                min={minDateTime}
                max={maxDateTime}
                step='1'
                onChange={(event) => onChange({ ...form, move_to: event.target.value })}
                required
              />
            </Field>
          </div>

          <Field label='Проект назначения'>
            <SearchableSelect
              value={form.destination_project_id}
              onValueChange={(projectId) =>
                onChange({
                  ...form,
                  destination_project_id: projectId,
                  destination_task_id: '',
                  new_task_title: '',
                })
              }
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
              placeholder='Выберите проект'
              required
              isLoading={isLoadingProjects}
            />
          </Field>

          <div className='grid gap-1'>
            <p className='text-[13px] font-medium text-slate-700'>Куда переносим время</p>
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                size='sm'
                variant={form.destination_mode === 'existing' ? 'primary' : 'secondary'}
                onClick={() =>
                  onChange({
                    ...form,
                    destination_mode: 'existing',
                    new_task_title: '',
                  })
                }
              >
                В существующую задачу
              </Button>
              <Button
                type='button'
                size='sm'
                variant={form.destination_mode === 'new' ? 'primary' : 'secondary'}
                onClick={() =>
                  onChange({
                    ...form,
                    destination_mode: 'new',
                    destination_task_id: '',
                  })
                }
              >
                В новую задачу
              </Button>
            </div>
          </div>

          {form.destination_mode === 'existing' ? (
            <Field label='Задача назначения'>
              <SearchableSelect
                value={form.destination_task_id}
                onValueChange={(taskId) =>
                  onChange({
                    ...form,
                    destination_task_id: taskId,
                    new_task_title: '',
                  })
                }
                options={tasks
                  .filter((task) => !task.is_draft)
                  .map((task) => ({
                    value: task.id,
                    label: task.title,
                  }))}
                placeholder='Выберите задачу'
                required
                isLoading={isLoadingTasks}
              />
            </Field>
          ) : (
            <Field label='Название новой задачи'>
              <Input
                value={form.new_task_title}
                onChange={(event) =>
                  onChange({
                    ...form,
                    new_task_title: event.target.value,
                    destination_task_id: '',
                  })
                }
                placeholder='Например: Исправление отчёта'
                required
              />
            </Field>
          )}

          <div className='flex flex-wrap justify-between gap-2'>
            <Button
              type='button'
              variant='danger'
              onClick={onDelete}
              disabled={isDeleting || isSubmitting}
            >
              {isDeleting ? 'Удаляем...' : 'Удалить время'}
            </Button>

            <Button
              type='submit'
              disabled={isSubmitting || isDeleting}
              variant={isSubmitting ? 'secondary' : 'primary'}
            >
              {isSubmitting ? 'Переносим...' : 'Перенести время'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
