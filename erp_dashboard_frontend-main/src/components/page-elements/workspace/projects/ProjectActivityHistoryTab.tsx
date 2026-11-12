import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { ApiRequestError } from '../../../../api/core/error';
import type {
  Project,
  ProjectActivityHistory,
  ProjectActivityHistoryForm,
} from '../../../../types/app';
import ConfirmDialog from '../../../modals/ConfirmDialog';
import Button from '../../../ui/Button';
import { Field, Input } from '../../../ui/FormField';
import {
  Table,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../ui/table';

type FieldErrors = Partial<Record<'started_on' | 'ended_on' | 'activity', string>>;

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU').format(date);
}

function ActivityModal({
  project,
  value,
  isSaving,
  onClose,
  onSubmit,
}: {
  project: Project;
  value: ProjectActivityHistory | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (_form: ProjectActivityHistoryForm) => Promise<FieldErrors | void>;
}) {
  const backdropRef = useRef(false);
  const isCurrent = Boolean(value?.is_current || (value && value.ended_on === null));
  const [form, setForm] = useState<ProjectActivityHistoryForm>({
    started_on: value?.started_on ?? '',
    ended_on: value?.ended_on ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const today = localDate(new Date());
  const projectCreatedOn = project.created_at
    ? localDate(new Date(project.created_at))
    : undefined;

  const setField = (field: keyof ProjectActivityHistoryForm, next: string) => {
    setForm((current) => ({ ...current, [field]: next }));
    setErrors((current) => ({ ...current, [field]: undefined, activity: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!form.started_on) nextErrors.started_on = 'Укажите дату начала.';
    if (!isCurrent && !form.ended_on) nextErrors.ended_on = 'Укажите дату окончания.';
    if (form.started_on && form.started_on > today) {
      nextErrors.started_on = 'Дата начала не может быть в будущем.';
    }
    if (form.ended_on && form.ended_on > today) {
      nextErrors.ended_on = 'Дата окончания не может быть в будущем.';
    }
    if (form.started_on && form.ended_on && form.ended_on <= form.started_on) {
      nextErrors.ended_on = 'Дата окончания должна быть позже даты начала.';
    }
    if (projectCreatedOn && form.started_on && form.started_on < projectCreatedOn) {
      nextErrors.started_on = 'Дата начала не может быть раньше даты создания проекта.';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const serverErrors = await onSubmit(form);
    if (serverErrors) setErrors(serverErrors);
  };

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 sm:p-4'
      onMouseDown={(event) => {
        backdropRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        if (backdropRef.current && event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={submit}
        className='w-full max-w-140 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5'
      >
        <div className='mb-4 flex items-center justify-between gap-3'>
          <h2 className='text-xl font-semibold text-[#10275a]'>
            {value ? 'Изменение периода активности' : 'Новый период активности'}
          </h2>
          <button
            type='button'
            onClick={onClose}
            disabled={isSaving}
            className='grid size-8 place-items-center rounded-lg border border-slate-200'
          >
            ×
          </button>
        </div>
        <div className={`grid gap-4 ${isCurrent ? '' : 'sm:grid-cols-2'}`}>
          <div>
            <Field label='Начало периода'>
              <Input
                type='date'
                required
                value={form.started_on}
                min={projectCreatedOn}
                max={today}
                onChange={(event) => setField('started_on', event.target.value)}
              />
            </Field>
            {errors.started_on ? (
              <p className='mt-1 text-xs text-red-600'>{errors.started_on}</p>
            ) : null}
          </div>
          {!isCurrent ? (
            <div>
              <Field label='Окончание периода'>
                <Input
                  type='date'
                  required
                  value={form.ended_on}
                  min={form.started_on || projectCreatedOn}
                  max={today}
                  onChange={(event) => setField('ended_on', event.target.value)}
                />
              </Field>
              {errors.ended_on ? (
                <p className='mt-1 text-xs text-red-600'>{errors.ended_on}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        {errors.activity ? (
          <p className='mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700'>
            {errors.activity}
          </p>
        ) : null}
        <div className='mt-6 flex justify-end gap-2'>
          <Button type='button' variant='secondary' onClick={onClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button type='submit' disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ProjectActivityHistoryTab({
  project,
  canManage,
  onProjectChange,
}: {
  project: Project;
  canManage: boolean;
  onProjectChange: () => Promise<void>;
}) {
  const [items, setItems] = useState<ProjectActivityHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalValue, setModalValue] = useState<
    ProjectActivityHistory | null | undefined
  >();
  const [deleteTarget, setDeleteTarget] = useState<ProjectActivityHistory | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setItems(await api.workspace.projectActivityHistories.getByProject(project.id));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить историю активности.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load, project.status]);

  const save = async (form: ProjectActivityHistoryForm): Promise<FieldErrors | void> => {
    setIsSaving(true);
    try {
      if (modalValue) {
        const isCurrent = modalValue.is_current || modalValue.ended_on === null;
        await api.workspace.projectActivityHistories.update(
          modalValue.id,
          isCurrent ? { started_on: form.started_on } : form,
        );
        toast.success('Период активности обновлён.');
      } else {
        await api.workspace.projectActivityHistories.create(project.id, form);
        toast.success('Период активности добавлен.');
      }
      setModalValue(undefined);
      await Promise.all([load(), onProjectChange()]);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 422) {
        const serverErrors = Object.fromEntries(
          Object.entries(error.body.errors ?? {}).map(([key, messages]) => [
            key,
            messages[0],
          ]),
        ) as FieldErrors;
        if (
          !serverErrors.started_on &&
          !serverErrors.ended_on &&
          !serverErrors.activity
        ) {
          serverErrors.activity = error.message;
        }
        return serverErrors;
      }
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить период.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await api.workspace.projectActivityHistories.delete(deleteTarget.id);
      setDeleteTarget(null);
      toast.success('Период активности удалён.');
      await Promise.all([load(), onProjectChange()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить период.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className='grid gap-3'>
      {canManage ? (
        <div className='flex justify-end'>
          <Button type='button' size='sm' onClick={() => setModalValue(null)}>
            + Добавить период
          </Button>
        </div>
      ) : null}
      <TableContainer>
        <Table density='compact' className='min-w-170'>
          <THead>
            <tr>
              <Th>Начало периода</Th>
              <Th>Окончание периода</Th>
              <Th>Состояние</Th>
              {canManage ? <Th align='center'>Действия</Th> : null}
            </tr>
          </THead>
          <TBody>
            {isLoading ? (
              <TableLoadingRow />
            ) : items.length ? (
              items.map((item) => {
                const isCurrent = item.is_current || item.ended_on === null;
                return (
                  <Tr key={item.id}>
                    <Td>{formatDate(item.started_on)}</Td>
                    <Td>
                      {isCurrent ? 'По настоящее время' : formatDate(item.ended_on!)}
                    </Td>
                    <Td>{isCurrent ? 'Активен' : 'Завершён'}</Td>
                    {canManage ? (
                      <Td align='center'>
                        <div className='flex justify-center gap-2'>
                          <Button
                            type='button'
                            size='sm'
                            variant='secondary'
                            onClick={() => setModalValue(item)}
                          >
                            Изменить
                          </Button>
                          {!isCurrent ? (
                            <Button
                              type='button'
                              size='sm'
                              variant='danger'
                              onClick={() => setDeleteTarget(item)}
                            >
                              Удалить
                            </Button>
                          ) : null}
                        </div>
                      </Td>
                    ) : null}
                  </Tr>
                );
              })
            ) : (
              <TableEmptyRow>Периодов активности пока нет.</TableEmptyRow>
            )}
          </TBody>
        </Table>
      </TableContainer>
      {modalValue !== undefined ? (
        <ActivityModal
          project={project}
          value={modalValue}
          isSaving={isSaving}
          onClose={() => setModalValue(undefined)}
          onSubmit={save}
        />
      ) : null}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isProcessing={isSaving}
        title='Удалить период активности?'
        message='Период будет удалён без возможности восстановления.'
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
    </section>
  );
}
