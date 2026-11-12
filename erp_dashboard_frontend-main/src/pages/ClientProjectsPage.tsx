import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../api/api';
import type {
  ClientMessage,
  ClientPortalProject,
  ClientPortalTask,
} from '../api/modules/clientApi';
import ConfirmDialog from '../components/modals/ConfirmDialog';
import Button from '../components/ui/Button';
import { Textarea } from '../components/ui/FormField';
import ClientTasksReport from '../components/page-elements/client-portal/ClientTasksReport';
import ClientPortalTable, {
  clientTableLinkClasses,
} from '../components/page-elements/client-portal/ClientPortalTable';
import { Td, Tr } from '../components/ui/table';
import ProjectDocumentsTab from '../components/page-elements/workspace/projects/ProjectDocumentsTab';
import ProjectTaskBoard from '../components/page-elements/workspace/projects/ProjectTasks/ProjectTaskBoard';
import ProjectsListPanel from '../components/page-elements/workspace/projects/ProjectsListPanel';
import TaskModal from '../components/modals/TaskModal/TaskModal';
import { useAppControllerContext } from '../context/AppControllerContext';
import { notificationsStore } from '../notifications/notificationsStore';
import type {
  Project,
  Task,
  TaskCreateForm,
  TaskPriority,
  TaskStatusColumn,
} from '../types/app';

// board, report и documents — вкладки выбранного проекта, tasks — все задачи клиента.
type ListMode = 'board' | 'report' | 'documents' | 'tasks';

function secondsToEstimation(seconds: number | null): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function toProject(item: ClientPortalProject): Project {
  return {
    id: item.id,
    name: item.name,
    default_entrance_finance_article_id: null,
    latest_activity_period: null,
    created_by_id: '',
    members: [],
    exclude_from_payroll: false,
    payroll_exclusion_scope: 'ALL',
    payroll_excluded_employee_ids: [],
    status: 'ACTIVE',
    is_pinned: Boolean(item.pinned),
  };
}

function toColumn(column: ClientPortalProject['columns'][number]): TaskStatusColumn {
  return {
    id: column.id,
    label: column.name,
    name: column.name,
    order: column.position,
    position: column.position,
    color: column.color,
    is_final: column.is_final,
  };
}

function toTask(task: ClientPortalTask, projectId: string): Task {
  return {
    id: task.id,
    title: task.title,
    project_id: projectId,
    project_name: task.project ?? undefined,
    created_by_id: null,
    creator: null,
    description: task.description,
    status_column_id: task.status_column_id,
    status_label: task.status ?? undefined,
    priority: (task.priority as TaskPriority | null) ?? undefined,
    estimation: task.estimation,
    deadline: task.deadline,
    is_draft: false,
    published_at: null,
  };
}

const EMPTY_TASK_FORM: TaskCreateForm = {
  title: '',
  description: '',
  priority: null,
  estimation: '',
  deadline: null,
};

function taskForm(task: ClientPortalTask): TaskCreateForm {
  return {
    title: task.title,
    description: task.description ?? '',
    priority: (task.priority as TaskPriority | null) ?? null,
    estimation: secondsToEstimation(task.estimation),
    deadline: task.deadline,
  };
}

export default function ClientProjectsPage() {
  const { user } = useAppControllerContext();
  const permissions = user?.permissions ?? [];
  const canViewComments = permissions.includes(
    'projects.tabs.tasks.client.comments.view',
  );
  const canReply = permissions.includes('projects.tabs.tasks.client.reply');
  const canUpload = permissions.includes('client_portal.attachments.upload');
  const canApprove = permissions.includes('projects.tabs.tasks.client.status.update');
  const canCreateTasks = permissions.includes('tasks.create_update');
  const canViewAllTasks = permissions.includes('tasks.view_all');
  const canViewReport = permissions.includes('reports.tasks.view');
  const canViewDocuments = permissions.includes('projects.tabs.documents.view');
  const canUpdatePriority = permissions.includes('client_portal.task.priority.update');
  const canSetDeadline = permissions.includes('client_portal.task.deadline.set');
  const clientFields = {
    description: permissions.includes('client_portal.task.description.view'),
    estimation: permissions.includes('client_portal.task.estimation.view'),
    priority:
      canUpdatePriority || permissions.includes('client_portal.task.priority.view'),
    deadline: canSetDeadline || permissions.includes('client_portal.task.deadline.view'),
    spentTime: permissions.includes('client_portal.task.spent_time.view'),
  };
  const projectTabs: { key: ListMode; label: string }[] = [
    { key: 'board', label: 'Задачи' },
    ...(canViewReport ? [{ key: 'report' as const, label: 'Отчёт по задачам' }] : []),
    ...(canViewDocuments ? [{ key: 'documents' as const, label: 'Документы' }] : []),
  ];
  const [portalProjects, setPortalProjects] = useState<ClientPortalProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [listMode, setListMode] = useState<ListMode>('board');
  // Черновик новой задачи: клиент создаёт её в том же окне, в котором потом смотрит.
  const [draftTask, setDraftTask] = useState<TaskCreateForm | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isMobileContentOpen, setIsMobileContentOpen] = useState(false);
  const [openedTaskId, setOpenedTaskId] = useState('');
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Адрес задачи в кабинете: /projects?project_id=…&task_id=… (ссылки из уведомлений).
  const requestedTaskId = useMemo(
    () => new URLSearchParams(location.search).get('task_id') ?? '',
    [location.search],
  );
  const requestedProjectId = useMemo(
    () => new URLSearchParams(location.search).get('project_id') ?? '',
    [location.search],
  );
  // Задача из адреса уже открыта: эффект не открывает её повторно, пока адрес не изменится.
  const openedFromUrlRef = useRef('');

  const reload = async () => {
    try {
      setPortalProjects(await api.client.portal());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить проекты.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!requestedTaskId || isLoading || openedFromUrlRef.current === requestedTaskId) {
      return;
    }
    openedFromUrlRef.current = requestedTaskId;

    void (async () => {
      const findTask = (projects: ClientPortalProject[]) => {
        for (const project of projects) {
          const task = project.tasks.find((item) => item.id === requestedTaskId);
          if (task) return { project, task };
        }
        return null;
      };

      try {
        // Задачи могло не быть при загрузке кабинета: например, её только что открыли клиенту.
        let found = findTask(portalProjects);
        if (!found) {
          const projects = await api.client.portal();
          setPortalProjects(projects);
          found = findTask(projects);
        }
        if (!found) {
          toast.error('Задача недоступна.');
          return;
        }

        setListMode('board');
        setIsMobileContentOpen(true);
        setSelectedProjectId(found.project.id);
        setOpenedTaskId(found.task.id);
        setMessages(
          canViewComments ? (await api.client.messages(found.task.id)).data : [],
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Не удалось открыть задачу.',
        );
      }
    })();
  }, [requestedTaskId, isLoading, portalProjects, canViewComments]);

  // Уведомления по задачам кабинета: обновляем доску и переписку открытой задачи.
  useEffect(() => {
    let reloadTimer: number | null = null;
    const unsubscribe = notificationsStore.onNotification((notification) => {
      const taskId = notification.task?.id;
      if (!taskId) return;

      if (
        taskId === openedTaskId &&
        canViewComments &&
        notification.type === 'task.client_reply_added'
      ) {
        api.client
          .messages(taskId)
          .then((result) => setMessages(result.data))
          .catch(() => undefined);
      }

      if (reloadTimer === null) {
        reloadTimer = window.setTimeout(() => {
          reloadTimer = null;
          api.client
            .portal()
            .then(setPortalProjects)
            .catch(() => undefined);
        }, 800);
      }
    });

    return () => {
      unsubscribe();
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
    };
  }, [openedTaskId, canViewComments]);

  useEffect(() => {
    if (selectedProjectId || portalProjects.length === 0) return;
    const initial =
      portalProjects.find((item) => item.id === requestedProjectId) ?? portalProjects[0];
    // Функцией: в этом же обновлении проект могла выбрать задача из адреса, её выбор важнее.
    setSelectedProjectId((current) => current || initial.id);
    setIsMobileContentOpen(true);
  }, [portalProjects, selectedProjectId, requestedProjectId]);

  const projects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return portalProjects
      .filter((item) => !query || item.name.toLowerCase().includes(query))
      .map(toProject);
  }, [portalProjects, searchQuery]);
  const selectedPortal =
    portalProjects.find((item) => item.id === selectedProjectId) ?? null;
  const columns = selectedPortal?.columns.map(toColumn) ?? [];
  const tasks =
    selectedPortal?.tasks.map((task) => toTask(task, selectedPortal.id)) ?? [];
  const opened = selectedPortal?.tasks.find((task) => task.id === openedTaskId) ?? null;
  // Архивный проект открыт клиенту только для просмотра.
  const isReadOnlyProject = Boolean(selectedPortal?.is_archived);
  const canEditOpened = Boolean(opened && !opened.is_final && !isReadOnlyProject);

  const syncTaskUrl = (projectId: string, taskId: string) => {
    const params = new URLSearchParams(location.search);
    if (taskId) {
      params.set('project_id', projectId);
      params.set('task_id', taskId);
    } else {
      params.delete('project_id');
      params.delete('task_id');
    }
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ''}`, { replace: true });
  };

  const closeTask = () => {
    setOpenedTaskId('');
    openedFromUrlRef.current = '';
    if (requestedTaskId) syncTaskUrl('', '');
  };

  const openTask = async (task: Task) => {
    setSelectedProjectId(task.project_id);
    setOpenedTaskId(task.id);
    openedFromUrlRef.current = task.id;
    if (requestedTaskId !== task.id) syncTaskUrl(task.project_id, task.id);
    if (!canViewComments) {
      setMessages([]);
      return;
    }
    try {
      const result = await api.client.messages(task.id);
      setMessages(result.data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить комментарии.',
      );
    }
  };

  const togglePin = async (project: Project) => {
    try {
      if (project.is_pinned) await api.client.unpinProject(project.id);
      else await api.client.pinProject(project.id);
      await reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось закрепить проект.',
      );
    }
  };

  const allTasks = portalProjects.flatMap((project) =>
    project.tasks.map((task) => toTask(task, project.id)),
  );

  const send = async () => {
    if (!opened || (!draft.trim() && files.length === 0)) return;
    try {
      await api.client.sendMessage(opened.id, draft.trim(), files);
      setDraft('');
      setFiles([]);
      const result = await api.client.messages(opened.id);
      setMessages(result.data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось отправить комментарий.',
      );
    }
  };

  const createTask = async () => {
    if (!selectedPortal || !draftTask) return;
    if (!draftTask.title.trim()) {
      toast.error('Укажите название задачи.');
      return;
    }
    try {
      setIsCreating(true);
      const task = await api.client.createTask(selectedPortal.id, {
        title: draftTask.title.trim(),
        description: draftTask.description ?? '',
        ...(canUpdatePriority && draftTask.priority
          ? { priority: draftTask.priority }
          : {}),
        ...(canSetDeadline && draftTask.deadline ? { deadline: draftTask.deadline } : {}),
      });
      setDraftTask(null);
      await reload();
      toast.success('Задача создана.');
      await openTask(toTask(task, selectedPortal.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось создать задачу.');
    } finally {
      setIsCreating(false);
    }
  };

  const replaceTask = (updated: ClientPortalTask) => {
    setPortalProjects((current) =>
      current.map((project) => ({
        ...project,
        tasks: project.tasks.map((task) => (task.id === updated.id ? updated : task)),
      })),
    );
  };

  const updateTask = async (payload: { priority?: string | null; deadline?: string }) => {
    if (!opened) return;
    try {
      replaceTask(await api.client.updateTask(opened.id, payload));
      toast.success('Задача обновлена.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось обновить задачу.');
    }
  };

  const approve = async () => {
    if (!opened) return;
    try {
      setIsApproving(true);
      await api.client.approve(opened.id);
      replaceTask({ ...opened, approval_status: 'approved' });
      setIsApproveConfirmOpen(false);
      toast.success('Задача согласована.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось согласовать задачу.',
      );
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <>
      <div className='grid h-full min-h-0 gap-2 lg:grid-cols-[260px_minmax(0,1fr)]'>
        <div className={`min-h-0 ${isMobileContentOpen ? 'hidden lg:block' : ''}`}>
          <ProjectsListPanel
            clientSidebar
            isLoading={isLoading}
            projects={projects}
            searchQuery={searchQuery}
            statusFilter='ACTIVE'
            selectedProjectId={listMode === 'tasks' ? '' : selectedProjectId}
            activeCount={projects.length}
            archivedCount={0}
            canManageProject={false}
            isAllProjectsActive={false}
            isAllTasksActive={listMode === 'tasks'}
            onSearchQueryChange={setSearchQuery}
            onStatusFilterChange={() => undefined}
            onShowAllTasks={
              canViewAllTasks
                ? () => {
                    setListMode('tasks');
                    setIsMobileContentOpen(true);
                    closeTask();
                  }
                : undefined
            }
            onTogglePinProject={(project) => void togglePin(project)}
            onSelectProject={(projectId) => {
              if (listMode === 'tasks') setListMode('board');
              setSelectedProjectId(projectId);
              setIsMobileContentOpen(true);
              closeTask();
            }}
            onOpenCreateModal={() => undefined}
          />
        </div>
        <div
          className={`${isMobileContentOpen ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col gap-2 lg:flex`}
        >
          <button
            type='button'
            onClick={() => setIsMobileContentOpen(false)}
            className='flex min-h-11 shrink-0 items-center rounded-xl border border-[#e3e9f3] bg-white px-3 text-left text-sm font-semibold text-[#1f3565] lg:hidden'
          >
            ← К списку проектов
          </button>
          <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3'>
            {selectedPortal && listMode !== 'tasks' ? (
              <>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <h1 className='min-w-0 truncate text-[18px] font-semibold text-[#10275a]'>
                    {selectedPortal.name}
                  </h1>
                  {listMode === 'board' && canCreateTasks && !isReadOnlyProject ? (
                    <Button
                      type='button'
                      size='sm'
                      onClick={() => setDraftTask(EMPTY_TASK_FORM)}
                    >
                      Новая задача
                    </Button>
                  ) : null}
                </div>
                {projectTabs.length > 1 ? (
                  <div
                    role='tablist'
                    className='flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-[#dbe6fb]'
                  >
                    {projectTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type='button'
                        role='tab'
                        aria-selected={listMode === tab.key}
                        onClick={() => setListMode(tab.key)}
                        className={`-mb-px min-h-11 min-w-max shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors md:min-h-0 md:px-4 ${
                          listMode === tab.key
                            ? 'border-[#2d6ff7] text-[#2d6ff7]'
                            : 'border-transparent text-[#7e8fb4] hover:text-[#1f3565]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
            {listMode === 'report' && selectedPortal && canViewReport ? (
              <ClientTasksReport
                key={selectedPortal.id}
                projectId={selectedPortal.id}
                columns={selectedPortal.columns}
                onOpenTask={(task) => void openTask(toTask(task, task.project_id))}
              />
            ) : listMode === 'documents' && selectedPortal && canViewDocuments ? (
              <div className='min-h-0 flex-1 overflow-auto'>
                <ProjectDocumentsTab
                  project={selectedPortal}
                  canUploadDocuments={false}
                  canDeleteDocuments={false}
                  fetchDocuments={api.client.projectDocuments}
                  namesOnly
                />
              </div>
            ) : listMode === 'tasks' ? (
              <ClientTaskTable tasks={allTasks} onOpen={(task) => void openTask(task)} />
            ) : selectedPortal ? (
              <ProjectTaskBoard
                clientView
                tasks={tasks}
                columns={columns}
                members={[]}
                isLoading={false}
                isTaskDragBlocked
                isColumnDragBlocked
                canCreateTasks={false}
                canMoveTasks={false}
                canCreateUpdateColumns={false}
                canDeleteColumns={false}
                onMoveTask={() => undefined}
                onMoveColumn={() => undefined}
                onOpenTask={(task) => void openTask(task)}
                onCreateTaskInColumn={() => undefined}
                onCreateColumn={() => undefined}
                onEditColumn={() => undefined}
                onDeleteColumn={() => undefined}
              />
            ) : (
              <div className='grid h-full place-items-center text-sm text-[#7e8fb4]'>
                Выберите проект
              </div>
            )}
          </div>
        </div>
      </div>
      {opened && selectedPortal ? (
        <TaskModal
          key={opened.id}
          isOpen
          isSubmitting={false}
          canEditTasks={false}
          clientView
          projectId={selectedPortal.id}
          projectName={selectedPortal.name}
          taskId={opened.id}
          title='Просмотр задачи'
          clientFields={clientFields}
          spentSeconds={opened.spent_seconds ?? 0}
          form={taskForm(opened)}
          members={[]}
          columns={columns}
          columnId={opened.status_column_id ?? ''}
          onChange={() => undefined}
          onClose={closeTask}
          onSubmit={(event: FormEvent) => event.preventDefault()}
          onClientPriorityChange={
            canUpdatePriority && canEditOpened
              ? (priority) => void updateTask({ priority })
              : undefined
          }
          onClientDeadlineSet={
            canSetDeadline && canEditOpened
              ? (deadline) => void updateTask({ deadline })
              : undefined
          }
          clientApproval={
            opened.approval_status
              ? {
                  status: opened.approval_status,
                  onApprove:
                    canApprove && canEditOpened
                      ? () => setIsApproveConfirmOpen(true)
                      : undefined,
                }
              : undefined
          }
          clientPanel={
            <ClientTaskPanel
              canViewComments={canViewComments}
              canReply={canReply && canEditOpened}
              canUpload={canUpload}
              messages={messages}
              draft={draft}
              files={files}
              onDraft={setDraft}
              onFiles={setFiles}
              onSend={() => void send()}
            />
          }
        />
      ) : null}
      <ConfirmDialog
        isOpen={isApproveConfirmOpen && Boolean(opened)}
        isProcessing={isApproving}
        title='Согласовать задачу?'
        message='Согласуйте задачу, когда все детали обсуждены. Отменить согласование будет нельзя.'
        confirmLabel='Согласовать'
        processingLabel='Согласование...'
        onClose={() => setIsApproveConfirmOpen(false)}
        onConfirm={() => void approve()}
      />
      {draftTask && selectedPortal ? (
        <TaskModal
          isOpen
          isSubmitting={isCreating}
          canEditTasks
          clientView
          projectId={selectedPortal.id}
          projectName={selectedPortal.name}
          title='Новая задача'
          submitLabel='Создать задачу'
          clientFields={{
            description: true,
            estimation: false,
            priority: canUpdatePriority,
            deadline: canSetDeadline,
            spentTime: false,
          }}
          form={draftTask}
          members={[]}
          columns={columns}
          onChange={setDraftTask}
          onClose={() => setDraftTask(null)}
          onSubmit={() => void createTask()}
          onClientPriorityChange={
            canUpdatePriority
              ? (priority) =>
                  setDraftTask((current) => current && { ...current, priority })
              : undefined
          }
          clientPanel={
            <p className='rounded-lg border border-slate-200 p-3 text-sm text-slate-500'>
              Комментарии и файлы можно будет добавить после создания задачи.
            </p>
          }
        />
      ) : null}
    </>
  );
}

function ClientTaskTable({
  tasks,
  onOpen,
}: {
  tasks: Task[];
  onOpen: (_task: Task) => void;
}) {
  return (
    <ClientPortalTable
      columns={['Задача', 'Проект', 'Статус']}
      isEmpty={tasks.length === 0}
      emptyText='Задач пока нет.'
    >
      {tasks.map((task) => (
        <Tr key={task.id}>
          <Td className='min-w-56'>
            <button
              type='button'
              className={clientTableLinkClasses}
              onClick={() => onOpen(task)}
            >
              {task.title}
            </button>
          </Td>
          <Td className='whitespace-nowrap'>{task.project_name ?? '—'}</Td>
          <Td className='whitespace-nowrap'>{task.status_label ?? '—'}</Td>
        </Tr>
      ))}
    </ClientPortalTable>
  );
}

function ClientTaskPanel({
  canViewComments,
  canReply,
  canUpload,
  messages,
  draft,
  files,
  onDraft,
  onFiles,
  onSend,
}: {
  canViewComments: boolean;
  canReply: boolean;
  canUpload: boolean;
  messages: ClientMessage[];
  draft: string;
  files: File[];
  onDraft: (_value: string) => void;
  onFiles: (_value: File[]) => void;
  onSend: () => void;
}) {
  const messagesListRef = useRef<HTMLDivElement | null>(null);

  // Как в переписке панели: открываем на последнем сообщении и показываем новое.
  useEffect(() => {
    const el = messagesListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className='flex h-full min-h-[320px] min-w-0 flex-col gap-3 lg:min-h-0'>
      {canViewComments ? (
        <>
          <div className='text-[13px] font-semibold text-slate-700'>Комментарии</div>
          <div
            ref={messagesListRef}
            className='grid min-h-0 flex-1 content-start gap-2 overflow-y-auto'
          >
            {messages.length === 0 ? (
              <p className='text-sm text-slate-400'>Комментариев пока нет.</p>
            ) : null}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-lg p-3 text-sm ${message.is_from_client ? 'bg-[#edf3ff]' : 'bg-slate-50'}`}
              >
                <div className='mb-1 text-xs text-slate-400'>
                  {message.is_from_client ? 'Клиент' : 'Компания'} ·{' '}
                  {new Date(message.created_at).toLocaleString('ru-RU')}
                </div>
                {message.text}
                {message.attachments.map((file) => (
                  <a
                    key={file.id}
                    className='mt-1 block text-[#2d6ff7] underline'
                    href={file.url}
                    target='_blank'
                    rel='noreferrer'
                  >
                    {file.name}
                  </a>
                ))}
              </article>
            ))}
          </div>
          {canReply ? (
            <div className='grid gap-2'>
              <Textarea
                placeholder='Комментарий'
                value={draft}
                onChange={(event) => onDraft(event.target.value)}
              />
              <div className='flex flex-wrap items-center gap-2'>
                {canUpload ? (
                  <label className='cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm'>
                    Файлы
                    <input
                      className='hidden'
                      type='file'
                      multiple
                      onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
                    />
                  </label>
                ) : null}
                <Button type='button' size='sm' onClick={onSend}>
                  Отправить
                </Button>
              </div>
              {files.length > 0 ? (
                <div className='text-xs text-slate-400'>
                  {files.map((file) => file.name).join(', ')}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
