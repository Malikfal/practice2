import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../../api/api';
import { useAppControllerContext } from '../../../../../../../context/AppControllerContext';
import { createInitialEmployeeDayTimelineForm } from '../../../../../../../hooks/formFactories';
import type {
  DeleteTimeSegmentPayload,
  EmployeeDayTimelineForm,
  MoveTimeSegmentForm,
  MoveTimeSegmentPayload,
  Project,
  Task,
  TimelineSegment,
  User,
} from '../../../../../../../types/app';
import {
  isEmployeeBlocked,
  isProjectArchived,
  toDateFromApiTime,
} from '../../../../../../../utils/formatters';

import EmployeeDayTimelineCard from './EmployeeDayTimelineCard';
import MoveTimeSegmentModal from './MoveTimeSegmentModal';
import ConfirmDialog from '../../../../../../modals/ConfirmDialog';
import { NON_CURRENT_DATE_FINANCE_WARNING } from './dayTimelineUtils';

type Props = {
  employee?: User | null;
  canSelectEmployee?: boolean;
  refreshToken?: number;
  rightAction?: ReactNode;
  // День, который показать сразу (YYYY-MM-DD), например по ссылке из уведомления.
  initialDate?: string;
};

function createDayRange(dateValue: string) {
  const localDate = new Date(`${dateValue}T00:00:00`);
  const nextDate = new Date(localDate);
  nextDate.setDate(localDate.getDate() + 1);

  return {
    from: localDate.toISOString(),
    to: nextDate.toISOString(),
  };
}

function toDateTimeLocalInputValue(value: string | number | Date): string {
  const date = value instanceof Date ? value : toDateFromApiTime(value);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 19);
}

function createInitialMoveForm(segment: TimelineSegment): MoveTimeSegmentForm {
  return {
    move_from: toDateTimeLocalInputValue(segment.clamped_started_at),
    move_to: toDateTimeLocalInputValue(segment.clamped_ended_at),
    destination_project_id: segment.project_id ?? '',
    destination_task_id: segment.task_id ?? '',
    new_task_title: '',
    destination_mode: segment.task_id ? 'existing' : 'new',
  };
}

const emptyMoveForm: MoveTimeSegmentForm = {
  move_from: '',
  move_to: '',
  destination_project_id: '',
  destination_task_id: '',
  new_task_title: '',
  destination_mode: 'existing',
};

export default function DailyTimelinePanel({
  employee = null,
  canSelectEmployee = true,
  refreshToken = 0,
  rightAction,
  initialDate,
}: Props) {
  const { user } = useAppControllerContext();
  const userPermissions = user?.permissions ?? [];
  const isWorker = user?.role === 'WORKER';
  const canViewSegmentDetails =
    !isWorker &&
    (userPermissions.includes('time.delete_self') ||
      userPermissions.includes('time.delete_others') ||
      userPermissions.includes('time.delete_all'));
  const fixedEmployeeId = employee?.id ?? '';
  const [form, setForm] = useState<EmployeeDayTimelineForm>(() => ({
    ...createInitialEmployeeDayTimelineForm(),
    ...(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
      ? { date: initialDate }
      : {}),
  }));
  const [employees, setEmployees] = useState<User[]>([]);
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const hasInitializedEmployeeRef = useRef(false);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [moveTasks, setMoveTasks] = useState<Task[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [isMoveTasksLoading, setIsMoveTasksLoading] = useState(false);
  const [isMovingSegment, setIsMovingSegment] = useState(false);
  const [isDeletingSegment, setIsDeletingSegment] = useState(false);
  const [pendingTimeChange, setPendingTimeChange] = useState<'move' | 'delete' | null>(
    null,
  );
  const [selectedSegment, setSelectedSegment] = useState<TimelineSegment | null>(null);
  const [moveForm, setMoveForm] = useState<MoveTimeSegmentForm>(emptyMoveForm);

  const activeEmployees = useMemo(() => {
    if (employee) return [employee];
    return employees.filter((employeeItem) => !isEmployeeBlocked(employeeItem.status));
  }, [employee, employees]);
  const workerEmployees = useMemo(() => (user ? [user] : []), [user]);
  const activeProjects = useMemo(
    () => projects.filter((project) => !isProjectArchived(project.status)),
    [projects],
  );
  const visibleEmployees = isWorker ? workerEmployees : activeEmployees;
  const effectiveUserId = isWorker && !fixedEmployeeId ? (user?.id ?? '') : form.user_id;
  const isMoveModalOpen = selectedSegment !== null;
  const shouldShowEmployeeSelect = canSelectEmployee && !fixedEmployeeId && !isWorker;

  const dayRange = useMemo(() => createDayRange(form.date), [form.date]);

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  const loadTimeline = useCallback(async () => {
    if (!user || !effectiveUserId) return;

    try {
      const requestTimeline = isWorker
        ? api.worker.reports.getDayTimeline
        : api.workspace.reports.getDayTimeline;
      const data = await requestTimeline({
        user_id: effectiveUserId,
        from: dayRange.from,
        to: dayRange.to,
      });
      setSegments(data.segments ?? []);
      setTotalSeconds(data.total_seconds ?? 0);
    } catch (err) {
      handleError(err);
    }
  }, [dayRange.from, dayRange.to, effectiveUserId, handleError, isWorker, user]);

  useEffect(() => {
    if (!fixedEmployeeId) return;

    hasInitializedEmployeeRef.current = true;
    setForm((current) => {
      if (current.user_id === fixedEmployeeId) return current;
      return {
        ...current,
        user_id: fixedEmployeeId,
      };
    });
  }, [fixedEmployeeId]);

  useEffect(() => {
    if (!user || isWorker || fixedEmployeeId) return;

    const loadEmployees = async () => {
      try {
        setIsEmployeesLoading(true);
        const response = await api.workspace.employees.getMany({
          status: 'active',
          per_page: 1000,
        });
        setEmployees(response.data ?? []);
      } catch (err) {
        handleError(err);
      } finally {
        setIsEmployeesLoading(false);
      }
    };

    void loadEmployees();
  }, [fixedEmployeeId, handleError, isWorker, user]);

  useEffect(() => {
    if (!user) return;

    const loadProjects = async () => {
      try {
        setIsProjectsLoading(true);

        if (isWorker) {
          const response = await api.worker.projects.getMany({
            status: 'all',
            per_page: 1000,
          });
          setProjects(response.data ?? []);
          return;
        }

        const response = await api.workspace.projects.getMany({
          status: 'all',
        });
        setProjects(response.data ?? []);
      } catch (err) {
        handleError(err);
      } finally {
        setIsProjectsLoading(false);
      }
    };

    void loadProjects();
  }, [handleError, isWorker, user]);

  useEffect(() => {
    if (!isWorker || !user?.id || form.user_id === user.id || fixedEmployeeId) return;

    setForm((current) => ({
      ...current,
      user_id: user.id,
    }));
  }, [fixedEmployeeId, form.user_id, isWorker, user?.id]);

  useEffect(() => {
    if (
      fixedEmployeeId ||
      hasInitializedEmployeeRef.current ||
      form.user_id ||
      !activeEmployees.length
    ) {
      return;
    }

    hasInitializedEmployeeRef.current = true;

    setForm((current) => ({
      ...current,
      user_id: activeEmployees[0].id,
    }));
  }, [activeEmployees, fixedEmployeeId, form.user_id]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline, refreshToken]);

  useEffect(() => {
    if (!isMoveModalOpen) {
      setMoveTasks([]);
      return;
    }

    if (!moveForm.destination_project_id || !effectiveUserId) {
      setMoveTasks([]);
      return;
    }

    const loadTasks = async () => {
      try {
        setIsMoveTasksLoading(true);

        if (isWorker) {
          const tasks = await api.worker.projects.getTasks(
            moveForm.destination_project_id,
          );
          setMoveTasks(Array.isArray(tasks) ? tasks : []);
          return;
        }

        const tasks = await api.workspace.projects.getForUser(
          moveForm.destination_project_id,
          effectiveUserId,
        );
        setMoveTasks(Array.isArray(tasks) ? tasks : []);
      } catch (err) {
        handleError(err);
      } finally {
        setIsMoveTasksLoading(false);
      }
    };

    void loadTasks();
  }, [
    effectiveUserId,
    handleError,
    isMoveModalOpen,
    isWorker,
    moveForm.destination_project_id,
  ]);

  useEffect(() => {
    if (!isMoveModalOpen || !activeProjects.length) {
      return;
    }

    const destinationProjectExists = activeProjects.some(
      (project) => project.id === moveForm.destination_project_id,
    );

    if (moveForm.destination_project_id && destinationProjectExists) {
      return;
    }

    setMoveForm((current) => ({
      ...current,
      destination_project_id: activeProjects[0].id,
      destination_task_id: '',
      new_task_title: '',
    }));
  }, [activeProjects, isMoveModalOpen, moveForm.destination_project_id]);

  const handleSegmentClick = useCallback((segment: TimelineSegment) => {
    setSelectedSegment(segment);
    setMoveForm(createInitialMoveForm(segment));
  }, []);

  const closeMoveModal = useCallback(() => {
    setPendingTimeChange(null);
    setSelectedSegment(null);
    setMoveTasks([]);
    setMoveForm(emptyMoveForm);
  }, []);

  const handleMoveSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!selectedSegment) return;

      if (!moveForm.destination_project_id) {
        toast.error('Выберите проект назначения.');
        return;
      }

      if (moveForm.destination_mode === 'existing' && !moveForm.destination_task_id) {
        toast.error('Выберите задачу назначения.');
        return;
      }

      if (moveForm.destination_mode === 'new' && !moveForm.new_task_title.trim()) {
        toast.error('Укажите название новой задачи.');
        return;
      }

      setPendingTimeChange('move');
    },
    [moveForm, selectedSegment],
  );

  const confirmMoveSegment = useCallback(async () => {
    if (!selectedSegment) return;

    const payload: MoveTimeSegmentPayload = {
      move_from: moveForm.move_from,
      move_to: moveForm.move_to,
      destination_project_id: moveForm.destination_project_id,
    };

    if (moveForm.destination_mode === 'existing') {
      payload.destination_task_id = moveForm.destination_task_id;
    } else {
      payload.new_task_title = moveForm.new_task_title.trim();
    }

    try {
      setIsMovingSegment(true);
      const response = await api.workspace.timeEntries.move(selectedSegment.id, payload);
      toast.success(response.message ?? 'Время успешно перенесено.');
      closeMoveModal();
      await loadTimeline();
    } catch (err) {
      handleError(err);
    } finally {
      setIsMovingSegment(false);
    }
  }, [closeMoveModal, handleError, loadTimeline, moveForm, selectedSegment]);

  const handleDeleteInterval = useCallback(() => {
    if (!selectedSegment) return;

    if (!moveForm.move_from || !moveForm.move_to) {
      toast.error('Выберите удаляемый интервал времени.');
      return;
    }

    setPendingTimeChange('delete');
  }, [moveForm.move_from, moveForm.move_to, selectedSegment]);

  const confirmDeleteInterval = useCallback(async () => {
    if (!selectedSegment) return;

    const payload: DeleteTimeSegmentPayload = {
      delete_from: moveForm.move_from,
      delete_to: moveForm.move_to,
    };

    try {
      setIsDeletingSegment(true);
      const response = await api.workspace.timeEntries.deleteInterval(
        selectedSegment.id,
        payload,
      );
      toast.success(response.message ?? 'Выбранный промежуток времени удален.');
      closeMoveModal();
      await loadTimeline();
    } catch (err) {
      handleError(err);
    } finally {
      setIsDeletingSegment(false);
    }
  }, [
    closeMoveModal,
    handleError,
    loadTimeline,
    moveForm.move_from,
    moveForm.move_to,
    selectedSegment,
  ]);

  const today = toDateTimeLocalInputValue(new Date()).slice(0, 10);
  const affectsFinancialCalculations = moveForm.move_from.slice(0, 10) !== today;

  return (
    <>
      <EmployeeDayTimelineCard
        form={form}
        employees={visibleEmployees}
        totalSeconds={totalSeconds}
        segments={segments}
        dayStartIso={dayRange.from}
        dayEndIso={dayRange.to}
        onFormChange={setForm}
        isLoading={isEmployeesLoading}
        canSelectEmployee={shouldShowEmployeeSelect}
        canViewSegmentDetails={canViewSegmentDetails}
        rightAction={rightAction}
        onSegmentClick={handleSegmentClick}
      />

      <MoveTimeSegmentModal
        isOpen={isMoveModalOpen}
        isSubmitting={isMovingSegment}
        isDeleting={isDeletingSegment}
        isLoadingProjects={isProjectsLoading}
        isLoadingTasks={isMoveTasksLoading}
        segment={selectedSegment}
        form={moveForm}
        projects={activeProjects}
        tasks={moveTasks}
        onChange={setMoveForm}
        onClose={closeMoveModal}
        onSubmit={handleMoveSubmit}
        onDelete={handleDeleteInterval}
      />

      <ConfirmDialog
        isOpen={pendingTimeChange !== null}
        isProcessing={isMovingSegment || isDeletingSegment}
        title={
          pendingTimeChange === 'delete'
            ? 'Подтвердите удаление времени'
            : 'Подтвердите перенос времени'
        }
        message={
          <div className='grid gap-2'>
            <p>
              {pendingTimeChange === 'delete'
                ? 'Удалить выбранный интервал времени?'
                : 'Перенести выбранный интервал времени?'}
            </p>
            {affectsFinancialCalculations ? (
              <p className='font-medium text-amber-700'>
                {NON_CURRENT_DATE_FINANCE_WARNING}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={
          pendingTimeChange === 'delete' ? 'Удалить время' : 'Перенести время'
        }
        processingLabel={pendingTimeChange === 'delete' ? 'Удаление...' : 'Перенос...'}
        danger={pendingTimeChange === 'delete'}
        onClose={() => setPendingTimeChange(null)}
        onConfirm={() => {
          if (pendingTimeChange === 'delete') {
            void confirmDeleteInterval();
          } else {
            void confirmMoveSegment();
          }
        }}
      />
    </>
  );
}
