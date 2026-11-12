import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { ApiRequestError } from '../../../../api/core/error';
import type {
  Project,
  ProjectAssignmentHistory,
  ProjectAssignmentHistoryForm,
  User,
} from '../../../../types/app';
import { formatDateLocal, formatName } from '../../../../utils/formatters';
import ConfirmDialog from '../../../modals/ConfirmDialog';
import Button from '../../../ui/Button';
import { Field, Input, MultiSelect, SearchableSelect } from '../../../ui/FormField';
import {
  Table,
  TableActionButton,
  TableActions,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../ui/table';
import Icon from '../employees/components/Icon';

type Scope = { kind: 'project'; project: Project } | { kind: 'employee'; employee: User };
type FieldErrors = Partial<
  Record<keyof ProjectAssignmentHistoryForm | 'assignment', string>
>;

const emptyForm: ProjectAssignmentHistoryForm = {
  project_id: '',
  user_id: '',
  is_pm: false,
  is_pm_payroll_enabled: false,
  started_on: '',
  ended_on: '',
};

function dateLabel(value: string | null) {
  if (!value) return 'По настоящее время';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : formatDateLocal(date);
}

function localDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function employeeLabel(employee: ProjectAssignmentHistory['employee']) {
  if (!employee) return 'Сотрудник не найден';
  return formatName(employee as User) || employee.email || employee.id;
}

function PrimaryIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      onClick={onClick}
      className='group relative grid size-7 shrink-0 place-items-center rounded-md bg-[#2d6ff7] text-white transition-colors hover:bg-[#1f5edb]'
    >
      {children}
      <span className='pointer-events-none absolute right-0 bottom-full z-20 mb-1.5 whitespace-nowrap rounded-md bg-[#10275a] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
        {label}
      </span>
    </button>
  );
}

function AssignmentModal({
  value,
  scope,
  employees,
  projects,
  isSaving,
  onClose,
  onSubmit,
}: {
  value: ProjectAssignmentHistory | null | undefined;
  scope: Scope;
  employees: User[];
  projects: Project[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (_form: ProjectAssignmentHistoryForm) => Promise<FieldErrors | void>;
}) {
  const editing = value !== undefined && value !== null;
  const backdropRef = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<ProjectAssignmentHistoryForm>(() => ({
    ...emptyForm,
    project_id: scope.kind === 'project' ? scope.project.id : (value?.project_id ?? ''),
    user_id: scope.kind === 'employee' ? scope.employee.id : (value?.user_id ?? ''),
    is_pm: value?.is_pm ?? false,
    is_pm_payroll_enabled: value?.is_pm_payroll_enabled ?? false,
    started_on: value?.started_on ?? '',
    ended_on: value?.ended_on ?? '',
  }));
  const today = localDateInputValue(new Date());
  const selectedProject = projects.find((project) => project.id === form.project_id);
  const projectStart = selectedProject?.starts_at
    ? localDateInputValue(new Date(selectedProject.starts_at))
    : undefined;
  const set = <K extends keyof ProjectAssignmentHistoryForm>(
    key: K,
    next: ProjectAssignmentHistoryForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: next }));
    setErrors((current) => ({ ...current, [key]: undefined, assignment: undefined }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!form.project_id) nextErrors.project_id = 'Выберите проект.';
    if (!form.user_id) nextErrors.user_id = 'Выберите сотрудника.';
    if (!form.started_on) nextErrors.started_on = 'Укажите дату начала.';
    if (!form.ended_on) nextErrors.ended_on = 'Укажите дату окончания.';
    if (form.started_on && form.ended_on && form.ended_on <= form.started_on) {
      nextErrors.ended_on = 'Дата окончания должна быть позже даты начала.';
    }
    if (Object.keys(nextErrors).length) return setErrors(nextErrors);
    const serverErrors = await onSubmit(form);
    if (serverErrors) setErrors(serverErrors);
  };

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 sm:p-4'
      onMouseDown={(e) => {
        backdropRef.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (backdropRef.current && e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className='max-h-[calc(100dvh-1rem)] w-full max-w-[620px] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5'
      >
        <div className='mb-4 flex items-center justify-between gap-3'>
          <h2 className='text-xl font-semibold text-[#10275a]'>
            {editing ? 'Изменение назначения' : 'Новое назначение'}
          </h2>
          <button
            type='button'
            onClick={onClose}
            disabled={isSaving}
            className='grid size-8 place-items-center rounded-lg border border-slate-200'
          >
            x
          </button>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='sm:col-span-2'>
            <Field label='Проект'>
              <SearchableSelect
                value={form.project_id}
                disabled={editing || scope.kind === 'project'}
                required
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                placeholder='Выберите проект'
                className='!h-9 !min-h-9 py-1 text-sm'
                onValueChange={(next) => set('project_id', next)}
              />
            </Field>
            {errors.project_id ? (
              <p className='mt-1 text-xs text-red-600'>{errors.project_id}</p>
            ) : null}
          </div>
          <div className='sm:col-span-2'>
            <Field label='Сотрудник'>
              <SearchableSelect
                value={form.user_id}
                disabled={editing || scope.kind === 'employee'}
                required
                options={employees.map((u) => ({
                  value: u.id,
                  label: formatName(u),
                  searchText: u.email,
                }))}
                placeholder='Выберите сотрудника'
                className='!h-9 !min-h-9 py-1 text-sm'
                onValueChange={(next) => set('user_id', next)}
              />
            </Field>
            {errors.user_id ? (
              <p className='mt-1 text-xs text-red-600'>{errors.user_id}</p>
            ) : null}
          </div>
          <div>
            <Field label='Дата начала'>
              <Input
                type='date'
                value={form.started_on}
                max={today}
                min={projectStart}
                required
                onChange={(e) => set('started_on', e.target.value)}
              />
            </Field>
            {errors.started_on ? (
              <p className='mt-1 text-xs text-red-600'>{errors.started_on}</p>
            ) : null}
          </div>
          <div>
            <Field label='Дата окончания'>
              <Input
                type='date'
                value={form.ended_on}
                max={today}
                min={form.started_on || undefined}
                required
                onChange={(e) => set('ended_on', e.target.value)}
              />
            </Field>
            {errors.ended_on ? (
              <p className='mt-1 text-xs text-red-600'>{errors.ended_on}</p>
            ) : null}
          </div>
          <label className='flex items-center gap-2 text-sm text-slate-700'>
            <input
              type='checkbox'
              checked={form.is_pm}
              onChange={(e) => {
                set('is_pm', e.target.checked);
                if (!e.target.checked) set('is_pm_payroll_enabled', false);
              }}
            />{' '}
            Руководитель проекта
          </label>
          <label className='flex items-center gap-2 text-sm text-slate-700'>
            <input
              type='checkbox'
              disabled={!form.is_pm}
              checked={form.is_pm_payroll_enabled}
              onChange={(e) => set('is_pm_payroll_enabled', e.target.checked)}
            />{' '}
            Участвует в PM-оплате
          </label>
          {errors.is_pm || errors.is_pm_payroll_enabled ? (
            <p className='text-xs text-red-600 sm:col-span-2'>
              {errors.is_pm ?? errors.is_pm_payroll_enabled}
            </p>
          ) : null}
        </div>
        {errors.assignment ? (
          <p className='mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700'>
            {errors.assignment}
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

export default function AssignmentHistoryTab({
  scope,
  employees,
  projects,
  canManage,
}: {
  scope: Scope;
  employees: User[];
  projects: Project[];
  canManage: boolean;
}) {
  const [items, setItems] = useState<ProjectAssignmentHistory[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalValue, setModalValue] = useState<
    ProjectAssignmentHistory | null | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ProjectAssignmentHistory | null>(null);
  const scopeKind = scope.kind;
  const scopeId = scope.kind === 'project' ? scope.project.id : scope.employee.id;
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data =
        scopeKind === 'project'
          ? await api.workspace.projectAssignmentHistories.getByProject(scopeId, filters)
          : await api.workspace.projectAssignmentHistories.getByUser(scopeId, filters);
      setItems(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить назначения.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters, scopeId, scopeKind]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (
    form: ProjectAssignmentHistoryForm,
  ): Promise<FieldErrors | void> => {
    setIsSaving(true);
    try {
      if (modalValue) {
        const payload = {
          is_pm: form.is_pm,
          is_pm_payroll_enabled: form.is_pm_payroll_enabled,
          started_on: form.started_on,
          ended_on: form.ended_on,
        };
        await api.workspace.projectAssignmentHistories.update(modalValue.id, payload);
        toast.success('Назначение обновлено.');
      } else {
        await api.workspace.projectAssignmentHistories.create(form);
        toast.success('Назначение создано.');
      }
      setModalValue(undefined);
      await load();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 422) {
        return Object.fromEntries(
          Object.entries(error.body.errors ?? {}).map(([key, messages]) => [
            key,
            messages[0],
          ]),
        ) as FieldErrors;
      }
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить назначение.',
      );
    } finally {
      setIsSaving(false);
    }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await api.workspace.projectAssignmentHistories.delete(deleteTarget.id);
      toast.success('Назначение удалено.');
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось удалить назначение.',
      );
    } finally {
      setIsSaving(false);
    }
  };
  const filterOptions =
    scope.kind === 'project'
      ? employees.map((u) => ({ value: u.id, label: formatName(u) }))
      : projects.map((p) => ({ value: p.id, label: p.name }));

  return (
    <section className='grid gap-3'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div className='w-full max-w-xs'>
          <Field
            label={
              scope.kind === 'project' ? 'Фильтр по сотрудникам' : 'Фильтр по проектам'
            }
          >
            <MultiSelect
              values={filters}
              onValuesChange={setFilters}
              options={filterOptions}
              searchable
              placeholder='Все'
              className='!h-8 !min-h-8 rounded-lg !px-2 py-0 text-xs'
            />
          </Field>
        </div>
        {canManage ? (
          <PrimaryIconButton
            label='Добавить назначение'
            onClick={() => setModalValue(null)}
          >
            <svg viewBox='0 0 20 20' className='size-4 fill-none stroke-current stroke-2'>
              <path d='M10 4v12M4 10h12' strokeLinecap='round' />
            </svg>
          </PrimaryIconButton>
        ) : null}
      </div>
      <TableContainer>
        <Table density='compact' className='min-w-190'>
          <THead>
            <tr>
              <Th>{scope.kind === 'project' ? 'Сотрудник' : 'Проект'}</Th>
              <Th>Период</Th>
              <Th>Роль</Th>
              <Th>PM-оплата</Th>
              {canManage ? <Th align='center'>Действия</Th> : null}
            </tr>
          </THead>
          <TBody>
            {isLoading ? (
              <TableLoadingRow />
            ) : items.length ? (
              items.map((item) => (
                <Tr key={item.id}>
                  <Td className='font-medium'>
                    {scope.kind === 'project'
                      ? employeeLabel(item.employee)
                      : (item.project?.name ?? 'Проект не найден')}
                  </Td>
                  <Td>
                    {dateLabel(item.started_on)} — {dateLabel(item.ended_on)}
                  </Td>
                  <Td>{item.is_pm ? 'Руководитель' : 'Участник'}</Td>
                  <Td>{item.is_pm_payroll_enabled ? 'Да' : 'Нет'}</Td>
                  {canManage ? (
                    <Td align='center'>
                      {item.ended_on ? (
                        <TableActions>
                          <TableActionButton
                            label='Изменить'
                            onClick={() => setModalValue(item)}
                          >
                            <Icon name='edit' />
                          </TableActionButton>
                          <TableActionButton
                            label='Удалить'
                            tone='danger'
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Icon name='trash' />
                          </TableActionButton>
                        </TableActions>
                      ) : (
                        <span className='text-xs text-slate-400'>
                          Активное назначение
                        </span>
                      )}
                    </Td>
                  ) : null}
                </Tr>
              ))
            ) : (
              <TableEmptyRow>Назначений пока нет.</TableEmptyRow>
            )}
          </TBody>
        </Table>
      </TableContainer>
      {modalValue !== undefined ? (
        <AssignmentModal
          value={modalValue}
          scope={scope}
          employees={employees}
          projects={projects}
          isSaving={isSaving}
          onClose={() => setModalValue(undefined)}
          onSubmit={save}
        />
      ) : null}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isProcessing={isSaving}
        title='Удалить назначение?'
        message='Запись истории будет удалена без возможности восстановления.'
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
    </section>
  );
}
