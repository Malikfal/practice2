import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { extractApiFieldError } from '../../../../api/core/error';
import ProjectRateHistoryModal from '../../../modals/ProjectRateHistoryModal';
import ProjectRateModal, { type ProjectRateForm } from '../../../modals/ProjectRateModal';
import ProjectTeamModal from '../../../modals/ProjectTeamModal';
import { ChipsMultiSelect } from '../../../modals/ProjectTeamModal';
import ProjectDocumentsTab from './ProjectDocumentsTab';
import ProjectFinanceTab from './ProjectFinanceTab';
import { ProjectEntranceArticleField } from './ProjectEntranceArticleSelect';
import ProjectTasksTab from './ProjectTasks/ProjectTasksTab';
import AssignmentHistoryTab from '../assignments/AssignmentHistoryTab';
import ProjectActivityHistoryTab from './ProjectActivityHistoryTab';
import { useAppControllerContext } from '../../../../context/AppControllerContext';
import { useTariffAccess } from '../../../../hooks/useTariffAccess';
import ProBadge from '../../../tariff/ProBadge';
import ProFeatureLock from '../../../tariff/ProFeatureLock';
import Button from '../../../ui/Button';
import Preloader from '../../../ui/Preloader';
import { Field, Input, SearchableSelect, Select, Textarea } from '../../../ui/FormField';
import {
  formatDurationHms,
  formatHoursCompact,
  formatName,
  isProjectArchived,
  parseHoursInput,
} from '../../../../utils/formatters';
import {
  hasProjectEditorChanges,
  MAX_WEEKLY_LIMIT_HOURS,
  projectToEditorForm,
} from '../../../../utils/projectEditorForm';
import type {
  Client,
  Project,
  ProjectDetails,
  ProjectEditorForm,
  ProjectMember,
  ProjectRate,
  Tag,
  User,
} from '../../../../types/app';
import { currencySymbol, DEFAULT_RATE_CURRENCY } from '../../../../utils/currency';

// Заметки на tiptap: редактор грузится, только когда открыта вкладка.
const ProjectNotesTab = lazy(() => import('./ProjectNotesTab'));

function formatRubles(kopecks: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
    kopecks / 100,
  );
}

function formatProjectRate(rate: ProjectRate | null | undefined) {
  if (!rate) return null;
  const amount = formatRubles(rate.rate);
  const vat = rate.vat != null && rate.vat > 0 ? ` + ${rate.vat}% НДС` : '';
  return `${amount} ${currencySymbol(rate.currency)}/час${vat}`;
}

type Props = {
  selectedProject: Project | null;
  clients: Client[];
  projectDetailsForm: ProjectEditorForm;
  externalFinanceRefreshKey?: number;
  selectedProjectStats: ProjectDetails | null;
  unassignedEmployeesForSelectedProject: User[];
  allActiveEmployees: User[];
  projectManagerIds: string[];
  assignProjectEmployeeId: string;
  isUpdating: boolean;
  isSavingTeam: boolean;
  isSavingRate: boolean;
  isSavingTags: boolean;
  availableTags: Tag[];
  removingEmployeeIds: Set<string>;
  isAssigningEmployeeToProject: boolean;
  isStatsLoading: boolean;
  canEditProject: boolean;
  canManageProjectMembers: boolean;
  canViewTasksTab: boolean;
  canViewNotesTab: boolean;
  canViewDocumentsTab: boolean;
  canViewReportsTab: boolean;
  canViewFinanceTab: boolean;
  canManageFinance: boolean;
  canViewFinanceArticles: boolean;
  canViewAboutTab: boolean;
  canCreateUpdateProjectNotes: boolean;
  canDeleteProjectNotes: boolean;
  canCreateUpdateProjectDocuments: boolean;
  canDeleteProjectDocuments: boolean;
  canCreateUpdateTasks: boolean;
  canMoveTasks: boolean;
  canCreateUpdateTaskStatuses: boolean;
  canDeleteTaskStatuses: boolean;
  currentUserId: string;
  canDeleteAnyComment: boolean;
  canDeleteOwnComment: boolean;
  canDeleteAnyAttachments: boolean;
  canDeleteOwnAttachments: boolean;
  canViewClientTab?: boolean;
  canViewClientComments?: boolean;
  canReplyToClient?: boolean;
  canUpdateClientStatus?: boolean;
  canManageClientLink?: boolean;
  requestedTaskId?: string;
  requestedNoteId?: string;
  initialTab?: ProjectTabKey;
  onSelectedTaskIdChange?: (_taskId: string) => void;
  onProjectFormChange: (_next: ProjectEditorForm) => void;
  onCreateClient: () => void;
  onAssignProjectEmployeeIdChange: (_userId: string) => void;
  onUpdateProject: () => void;
  onUpdateProjectCreator: (_createdById: string) => Promise<Project>;
  onActivityHistoryChanged: () => Promise<void>;
  onAssignEmployeeToProject: () => void;
  onRemoveEmployeeFromProject: (_userId: string) => void;
  onSaveTeam: (
    _memberIds: string[],
    _managerIds: string[],
    _pmPayrollSelection: Record<string, boolean>,
    _managerPaymentMethod: string,
  ) => Promise<void> | void;
  onSaveRate: (_form: ProjectRateForm) => Promise<void> | void;
  onSaveTags: (_tagNames: string[]) => Promise<void> | void;
  onTogglePinProject?: (_project: Project) => void;
  onClose?: () => void;
};

type ProjectTabKey =
  | 'tasks'
  | 'reports'
  | 'finances'
  | 'notes'
  | 'documents'
  | 'about'
  | 'activity'
  | 'team';

const TABS: Array<{ key: ProjectTabKey; label: string }> = [
  { key: 'tasks', label: 'Задачи' },
  { key: 'reports', label: 'Отчёты' },
  { key: 'finances', label: 'Финансы' },
  { key: 'notes', label: 'Заметки' },
  { key: 'documents', label: 'Документы' },
  { key: 'about', label: 'О проекте' },
  { key: 'activity', label: 'Активность' },
  { key: 'team', label: 'Команда' },
];

const aboutCardClassName =
  'grid content-start gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 sm:p-4';
const aboutCardTitleClassName = 'text-[18px] leading-tight font-semibold text-[#10275a]';
const aboutControlClassName =
  'h-11 rounded-xl border-[#c9d8f8] bg-white text-base text-[#1f3565] placeholder:text-[#9aa8c7] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] read-only:bg-[#f7f9fc] disabled:bg-[#f7f9fc] sm:h-10 sm:text-[14px]';
const aboutHintClassName = 'text-xs font-normal text-[#7082a8]';

function getMemberInitial(user: User) {
  const source =
    user.first_name?.trim() ||
    user.last_name?.trim() ||
    user.name?.trim() ||
    user.email?.trim() ||
    '?';
  return source.charAt(0).toUpperCase();
}

export default function ProjectDetailsPanel({
  selectedProject,
  clients,
  projectDetailsForm,
  externalFinanceRefreshKey = 0,
  selectedProjectStats,
  allActiveEmployees,
  projectManagerIds,
  isUpdating,
  isSavingTeam,
  isSavingRate,
  isSavingTags,
  availableTags,
  canEditProject,
  canManageProjectMembers,
  canViewTasksTab,
  canViewNotesTab,
  canViewDocumentsTab,
  canViewReportsTab,
  canViewFinanceTab,
  canManageFinance,
  canViewFinanceArticles,
  canViewAboutTab,
  canCreateUpdateProjectNotes,
  canDeleteProjectNotes,
  canCreateUpdateProjectDocuments,
  canDeleteProjectDocuments,
  canCreateUpdateTasks,
  canMoveTasks,
  canCreateUpdateTaskStatuses,
  canDeleteTaskStatuses,
  currentUserId,
  canDeleteAnyComment,
  canDeleteOwnComment,
  canDeleteAnyAttachments,
  canDeleteOwnAttachments,
  canViewClientTab,
  canViewClientComments,
  canReplyToClient,
  canUpdateClientStatus,
  canManageClientLink,
  requestedTaskId = '',
  requestedNoteId = '',
  initialTab,
  onSelectedTaskIdChange,
  onProjectFormChange,
  onCreateClient,
  onUpdateProject,
  onUpdateProjectCreator,
  onActivityHistoryChanged,
  onSaveTeam,
  onSaveRate,
  onSaveTags,
  onClose,
}: Props) {
  const { user } = useAppControllerContext();
  const tariffAccess = useTariffAccess();
  // На ФРИ вкладка «Финансы» и ставки проекта закрыты: вкладку показываем с меткой «ПРО».
  const isFinanceTabProLocked =
    !canViewFinanceTab && tariffAccess.isPermissionLocked('projects.tabs.finance.view');
  const isProjectRateLocked = tariffAccess.isFeatureLocked('project_economics');
  const canViewAssignmentHistory = Boolean(
    user?.permissions?.includes('project.assignment_histories.view'),
  );
  const canManageAssignmentHistory = Boolean(
    user?.permissions?.includes('project.assignment_histories.manage'),
  );
  const canViewActivityHistory = Boolean(
    user?.permissions?.includes('project.activity_histories.view'),
  );
  const canManageActivityHistory = Boolean(
    user?.permissions?.includes('project.activity_histories.manage'),
  );
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [creatorId, setCreatorId] = useState(selectedProject?.created_by_id ?? '');
  const [creatorError, setCreatorError] = useState('');
  const [isSavingCreator, setIsSavingCreator] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isRateHistoryOpen, setIsRateHistoryOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [selectedTab, setSelectedTab] = useState<ProjectTabKey>(initialTab ?? 'tasks');

  useEffect(() => {
    setCreatorId(selectedProject?.created_by_id ?? '');
    setCreatorError('');
  }, [selectedProject?.created_by_id, selectedProject?.id]);

  // Лимит клиента главнее лимита проекта; клиента могли сменить в форме, поэтому берём выбранного.
  const formClientId = projectDetailsForm.client_id || null;
  const selectedClientWeeklyLimit = formClientId
    ? (clients.find((client) => client.id === formClientId)?.weekly_limit_seconds ??
      (formClientId === selectedProject?.client_id
        ? selectedProject?.client_weekly_limit_seconds
        : null))
    : null;

  const saveProjectCreator = async () => {
    if (!selectedProject || !creatorId || !canEditProject) return;

    try {
      setIsSavingCreator(true);
      setCreatorError('');
      await onUpdateProjectCreator(creatorId);
      toast.success('Создатель проекта изменён.');
    } catch (error) {
      const fieldError = extractApiFieldError(error, 'created_by_id');
      if (fieldError) {
        setCreatorError(fieldError);
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Не удалось изменить создателя проекта.',
        );
      }
    } finally {
      setIsSavingCreator(false);
    }
  };

  const visibleTabs = useMemo(
    () =>
      TABS.filter((tab) => {
        if (tab.key === 'tasks') return canViewTasksTab;
        if (tab.key === 'team') return canViewAssignmentHistory;
        if (tab.key === 'activity') return canViewActivityHistory;
        if (tab.key === 'notes') return canViewNotesTab;
        if (tab.key === 'documents') return canViewDocumentsTab;
        if (tab.key === 'reports') return canViewReportsTab;
        if (tab.key === 'finances') return canViewFinanceTab || isFinanceTabProLocked;
        if (tab.key === 'about') return canViewAboutTab;
        return false;
      }),
    [
      canViewAboutTab,
      canViewDocumentsTab,
      canViewFinanceTab,
      canViewNotesTab,
      canViewReportsTab,
      canViewTasksTab,
      canViewAssignmentHistory,
      canViewActivityHistory,
      isFinanceTabProLocked,
    ],
  );

  const activeTab = visibleTabs.some((tab) => tab.key === selectedTab)
    ? selectedTab
    : (visibleTabs[0]?.key ?? 'tasks');

  if (!selectedProject) {
    return (
      <div className='h-full min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white p-3'>
        <p className='text-sm text-slate-500'>Выберите проект слева.</p>
      </div>
    );
  }

  const members: ProjectMember[] = selectedProject.members ?? [];
  const visibleMembers = members.slice(0, 4);
  const extraMembers = Math.max(0, members.length - visibleMembers.length);
  const managers = projectManagerIds.length
    ? projectManagerIds
        .map(
          (managerId) =>
            allActiveEmployees.find((employee) => employee.id === managerId) ??
            members.find((member) => member.user.id === managerId)?.user ??
            null,
        )
        .filter((manager): manager is User => Boolean(manager))
    : [];
  const payrollEmployeeOptions = (() => {
    const usersById = new Map(
      allActiveEmployees.map((employee) => [employee.id, employee]),
    );
    for (const member of members) {
      usersById.set(member.user.id, member.user);
    }

    const options = Array.from(usersById.values()).map((employee) => ({
      value: employee.id,
      label: formatName(employee),
    }));
    for (const employeeId of projectDetailsForm.payroll_excluded_employee_ids) {
      if (!usersById.has(employeeId)) {
        options.push({ value: employeeId, label: employeeId });
      }
    }

    return options;
  })();
  const isPayrollEmployeeSelectionRequired =
    projectDetailsForm.exclude_from_payroll &&
    projectDetailsForm.payroll_exclusion_scope === 'SELECTED' &&
    projectDetailsForm.payroll_excluded_employee_ids.length === 0;

  const totalSeconds = selectedProjectStats?.project?.total_seconds ?? 0;
  const weeklySeconds = selectedProjectStats?.project?.weekly_seconds ?? 0;

  const handleSaveTeam = async (
    memberIds: string[],
    managerIds: string[],
    pmPayrollSelection: Record<string, boolean>,
    managerPaymentMethod: string,
  ) => {
    try {
      await onSaveTeam(memberIds, managerIds, pmPayrollSelection, managerPaymentMethod);
      setIsTeamModalOpen(false);
    } catch {
      // Ошибка показывается родителем — оставляем модалку открытой.
    }
  };

  const handleSaveRate = async (form: ProjectRateForm) => {
    try {
      await onSaveRate(form);
      setIsRateModalOpen(false);
    } catch {
      // Ошибка показывается родителем — оставляем модалку открытой.
    }
  };

  const projectTags = selectedProject.tags ?? [];
  const projectTagNames = projectTags.map((tag) => tag.name);
  const projectTagSet = new Set(projectTagNames.map((name) => name.trim().toLowerCase()));
  const tagSuggestions = availableTags.filter(
    (tag) => !projectTagSet.has(tag.name.trim().toLowerCase()),
  );

  const handleRemoveTag = async (tagName: string) => {
    if (isSavingTags) return;
    await onSaveTags(projectTagNames.filter((name) => name !== tagName));
  };

  const handleAddTag = async (rawName: string) => {
    const name = rawName.trim();
    if (!name || isSavingTags) return;
    if (projectTagSet.has(name.toLowerCase())) {
      setTagInput('');
      return;
    }
    try {
      await onSaveTags([...projectTagNames, name]);
      setTagInput('');
    } catch {
      // Ошибка показывается родителем.
    }
  };

  // Ставка, статья и теги сохраняются сразу (с тостом), остальное общей кнопкой внизу.
  const weeklyLimitSeconds = parseHoursInput(
    projectDetailsForm.weekly_limit_hours ?? '',
    MAX_WEEKLY_LIMIT_HOURS,
  );
  const isProjectFormDirty =
    weeklyLimitSeconds === undefined ||
    hasProjectEditorChanges(projectDetailsForm, selectedProject, weeklyLimitSeconds);
  const isCreatorDirty =
    Boolean(creatorId) && creatorId !== (selectedProject.created_by_id ?? '');
  const isAboutDirty = isProjectFormDirty || isCreatorDirty;
  const isSavingAbout = isUpdating || isSavingCreator;

  const handleSaveAbout = async () => {
    if (isCreatorDirty) await saveProjectCreator();
    if (isProjectFormDirty) onUpdateProject();
  };

  const handleResetAbout = () => {
    onProjectFormChange(projectToEditorForm(selectedProject));
    setCreatorId(selectedProject.created_by_id ?? '');
    setCreatorError('');
  };

  return (
    <div className='flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white text-[#1f3565] sm:overflow-hidden'>
      {/* Header */}
      <div className='flex items-start justify-between gap-2 border-b border-[#e3e9f3] px-3 py-3 sm:gap-4 sm:px-5 sm:py-4'>
        <div className='min-w-0'>
          <h2 className='truncate text-[20px] leading-snug font-semibold text-[#10275a] sm:text-[26px]'>
            {projectDetailsForm.name || selectedProject.name || 'Без названия'}
          </h2>
          <div className='mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#7e8fb4]'>
            {/* На телефоне заглушку не показываем: экономим строку над вкладками. */}
            <span
              className={
                projectDetailsForm.description || selectedProject.description
                  ? 'truncate'
                  : 'hidden truncate sm:inline'
              }
            >
              {projectDetailsForm.description ||
                selectedProject.description ||
                'Описание не указано'}
            </span>
            <span
              className={`rounded-lg px-2 py-1 text-[11px] leading-none font-semibold ${
                isProjectArchived(projectDetailsForm.status || selectedProject.status)
                  ? 'bg-[#edf1f7] text-[#7e8fb4]'
                  : 'bg-[#e8f6eb] text-[#3e8d59]'
              }`}
            >
              {isProjectArchived(projectDetailsForm.status || selectedProject.status)
                ? 'Архив'
                : 'Активный'}
            </span>
            <span className='rounded-lg bg-[#edf3ff] px-2 py-1 text-[11px] leading-none font-semibold text-[#2d6ff7]'>
              Отработано всего: {formatDurationHms(totalSeconds)}
            </span>
            <span className='rounded-lg bg-[#9af3e47e] px-2 py-1 text-[11px] leading-none font-semibold text-[#1c927e]'>
              За неделю: {formatDurationHms(weeklySeconds)}
            </span>
            {projectDetailsForm.is_internal ? (
              <span className='rounded-lg bg-[#fff4d8] px-2 py-1 text-[11px] leading-none font-semibold text-[#8a5a0a]'>
                Внутренний проект
              </span>
            ) : null}
            {projectDetailsForm.exclude_from_payroll ? (
              <span className='rounded-lg bg-[#ffe7ec] px-2 py-1 text-[11px] leading-none font-semibold text-[#b42345]'>
                Не учитывается в оплате
              </span>
            ) : null}
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-1 sm:gap-3'>
          <div className='hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex'>
            <span className='text-xs leading-tight text-slate-500'>
              Руководитель проекта:
            </span>
            <span className='text-xs leading-tight font-semibold text-slate-800'>
              {managers.length
                ? managers.map((manager) => formatName(manager)).join(', ')
                : 'Не назначен'}
            </span>
          </div>

          <div className='hidden -space-x-2 sm:flex'>
            {visibleMembers.map((member) => (
              <span
                key={member.id}
                title={formatName(member.user)}
                className='grid size-8 place-items-center rounded-full border-2 border-white bg-slate-200 text-xs font-semibold text-slate-700 shadow-sm'
              >
                {getMemberInitial(member.user)}
              </span>
            ))}
            {extraMembers > 0 && (
              <span className='grid size-8 place-items-center rounded-full border-2 border-white bg-slate-100 text-xs font-semibold text-slate-600 shadow-sm'>
                +{extraMembers}
              </span>
            )}
          </div>

          {canManageProjectMembers && (
            <button
              type='button'
              onClick={() => setIsTeamModalOpen(true)}
              className='grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
              title='Редактировать состав'
            >
              <svg
                className='size-4 fill-none stroke-current stroke-[1.8]'
                viewBox='0 0 24 24'
              >
                <path
                  d='M4 20h4l10-10-4-4L4 16v4z'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
                <path d='M14 6l4 4' strokeLinecap='round' strokeLinejoin='round' />
              </svg>
            </button>
          )}

          <button
            type='button'
            onClick={onClose}
            className='grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700'
            title='Закрыть'
          >
            <svg
              className='size-5 fill-none stroke-current stroke-[1.8]'
              viewBox='0 0 24 24'
            >
              <path
                d='M6 6l12 12M18 6L6 18'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className='border-b border-[#e3e9f3] p-2 lg:hidden'>
        <SearchableSelect
          value={activeTab}
          options={visibleTabs.map((tab) => ({
            value: tab.key,
            label:
              tab.key === 'finances' && isFinanceTabProLocked
                ? `${tab.label} · ПРО`
                : tab.label,
          }))}
          className='h-11 rounded-xl border-[#c9d8f8] bg-[#edf3ff] pr-11 text-sm font-semibold text-[#1f3565]'
          onValueChange={(value) => {
            if (!value || !visibleTabs.some((tab) => tab.key === value)) return;
            setSelectedTab(value as ProjectTabKey);
          }}
        />
      </div>

      <div
        className='hidden border-b border-[#e3e9f3] text-[13px] font-semibold lg:grid'
        style={{
          gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))`,
        }}
      >
        {visibleTabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type='button'
              onClick={() => setSelectedTab(tab.key)}
              className={`min-h-11 min-w-0 border-r border-[#e3e9f3] px-2 py-2 text-center transition-colors last:border-r-0 xl:px-3 ${
                isActive
                  ? 'bg-[#edf3ff] text-[#2d6ff7]'
                  : 'bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
            >
              {tab.label}
              {tab.key === 'finances' && isFinanceTabProLocked ? (
                <ProBadge className='ml-1.5 align-middle' />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className='flex flex-none flex-col gap-3 p-2 sm:min-h-0 sm:flex-1 sm:gap-4 sm:overflow-auto sm:p-4'>
        {visibleTabs.length === 0 ? (
          <div className='grid min-h-50 place-items-center text-[14px] text-[#7e8fb4]'>
            У вас нет доступных вкладок проекта.
          </div>
        ) : activeTab === 'tasks' && canViewTasksTab ? (
          <ProjectTasksTab
            selectedProject={selectedProject}
            requestedTaskId={requestedTaskId}
            onSelectedTaskIdChange={onSelectedTaskIdChange}
            canCreateUpdateTasks={canCreateUpdateTasks}
            canMoveTasks={canMoveTasks}
            canCreateUpdateTaskStatuses={canCreateUpdateTaskStatuses}
            canDeleteTaskStatuses={canDeleteTaskStatuses}
            currentUserId={currentUserId}
            canDeleteAnyComment={canDeleteAnyComment}
            canDeleteOwnComment={canDeleteOwnComment}
            canDeleteAnyAttachments={canDeleteAnyAttachments}
            canDeleteOwnAttachments={canDeleteOwnAttachments}
            canViewClientTab={canViewClientTab}
            canViewClientComments={canViewClientComments}
            canReplyToClient={canReplyToClient}
            canUpdateClientStatus={canUpdateClientStatus}
            canManageClientLink={canManageClientLink}
          />
        ) : activeTab === 'notes' && canViewNotesTab ? (
          <Suspense
            fallback={
              <div className='flex min-h-40 items-center justify-center'>
                <Preloader size='lg' />
              </div>
            }
          >
            <ProjectNotesTab
              project={selectedProject}
              canCreateUpdateNotes={canCreateUpdateProjectNotes}
              canDeleteNotes={canDeleteProjectNotes}
              requestedNoteId={requestedNoteId}
            />
          </Suspense>
        ) : activeTab === 'team' && canViewAssignmentHistory ? (
          <AssignmentHistoryTab
            scope={{ kind: 'project', project: selectedProject }}
            employees={allActiveEmployees}
            projects={[selectedProject]}
            canManage={canManageAssignmentHistory}
          />
        ) : activeTab === 'activity' && canViewActivityHistory ? (
          <ProjectActivityHistoryTab
            project={selectedProject}
            canManage={canManageActivityHistory}
            onProjectChange={onActivityHistoryChanged}
          />
        ) : activeTab === 'documents' && canViewDocumentsTab ? (
          <ProjectDocumentsTab
            project={selectedProject}
            canUploadDocuments={canCreateUpdateProjectDocuments}
            canDeleteDocuments={canDeleteProjectDocuments}
            showClientVisibility={Boolean(
              selectedProject.client_id ?? selectedProject.client,
            )}
          />
        ) : activeTab === 'finances' && isFinanceTabProLocked ? (
          <ProFeatureLock
            feature='project_economics'
            screen='project_finances'
            variant='inline'
          />
        ) : activeTab === 'finances' && canViewFinanceTab ? (
          <ProjectFinanceTab
            project={selectedProject}
            employees={allActiveEmployees}
            canManage={canManageFinance}
            externalRefreshKey={externalFinanceRefreshKey}
          />
        ) : activeTab === 'about' && canViewAboutTab ? (
          <>
            <section className={`${aboutCardClassName} md:grid-cols-2 md:gap-x-6`}>
              <div className='grid content-start gap-2'>
                <h3 className={`${aboutCardTitleClassName} flex items-center gap-2`}>
                  Ставка проекта
                  {isProjectRateLocked ? <ProBadge /> : null}
                </h3>
                <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
                  <p className='text-lg leading-tight font-bold text-[#10275a]'>
                    {formatProjectRate(selectedProject.current_rate) ?? 'Не указана'}
                  </p>
                  {isProjectRateLocked ? (
                    <p className='text-sm text-[#7e8fb4]'>
                      История и изменение ставки доступны на тарифе ПРО.
                    </p>
                  ) : (
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() => setIsRateHistoryOpen(true)}
                      >
                        История изменений
                      </Button>
                      {canEditProject && (
                        <Button
                          type='button'
                          variant='secondary'
                          size='sm'
                          onClick={() => setIsRateModalOpen(true)}
                        >
                          + Изменить ставку
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {canViewFinanceArticles && (
                <div className='grid content-start gap-2'>
                  <h3 className={aboutCardTitleClassName}>
                    Статья поступления по умолчанию
                  </h3>
                  <div className='max-w-105'>
                    <ProjectEntranceArticleField
                      project={selectedProject}
                      disabled={!canEditProject}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className={aboutCardClassName}>
              <h3 className={aboutCardTitleClassName}>Основная информация</h3>
              <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                <Field label='Название проекта' className='text-[#1f3565]'>
                  <Input
                    value={projectDetailsForm.name}
                    readOnly={!canEditProject}
                    onChange={(event) =>
                      onProjectFormChange({
                        ...projectDetailsForm,
                        projectId: selectedProject.id,
                        name: event.target.value,
                      })
                    }
                    className={aboutControlClassName}
                  />
                </Field>

                <Field label='Клиент' className='text-[#1f3565]'>
                  <div className='flex items-center gap-2'>
                    <Select
                      value={projectDetailsForm.client_id}
                      disabled={!canEditProject}
                      onChange={(event) =>
                        onProjectFormChange({
                          ...projectDetailsForm,
                          projectId: selectedProject.id,
                          client_id: event.target.value,
                        })
                      }
                      className={`${aboutControlClassName} min-w-0 flex-1`}
                    >
                      <option value=''>Без клиента</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </Select>
                    {canEditProject ? (
                      <Button
                        type='button'
                        variant='secondary'
                        className='h-10 shrink-0 rounded-xl border-[#e3e9f3] px-3 text-[13px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
                        onClick={onCreateClient}
                      >
                        + Добавить клиента
                      </Button>
                    ) : null}
                  </div>
                </Field>

                <Field label='Создатель проекта' className='text-[#1f3565]'>
                  <Select
                    value={creatorId}
                    disabled={!canEditProject || isSavingCreator}
                    aria-invalid={Boolean(creatorError)}
                    onChange={(event) => {
                      setCreatorId(event.target.value);
                      setCreatorError('');
                    }}
                    className={`${aboutControlClassName} ${
                      creatorError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                        : ''
                    }`}
                  >
                    {!creatorId ? <option value=''>Выберите сотрудника</option> : null}
                    {creatorId &&
                    !allActiveEmployees.some((employee) => employee.id === creatorId) ? (
                      <option value={creatorId}>Текущий создатель</option>
                    ) : null}
                    {allActiveEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {formatName(employee)}
                      </option>
                    ))}
                  </Select>
                  {creatorError ? (
                    <span className='text-xs font-normal text-red-500'>
                      {creatorError}
                    </span>
                  ) : null}
                </Field>
              </div>

              <Field label='Описание' className='text-[#1f3565]'>
                <Textarea
                  value={projectDetailsForm.description}
                  readOnly={!canEditProject}
                  onChange={(event) =>
                    onProjectFormChange({
                      ...projectDetailsForm,
                      projectId: selectedProject.id,
                      description: event.target.value,
                    })
                  }
                  className='rounded-xl border-[#c9d8f8] bg-white text-base text-[#1f3565] placeholder:text-[#9aa8c7] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] sm:text-[14px]'
                />
              </Field>

              <div className='grid gap-2 rounded-xl border border-[#dbe6ff] bg-white p-3'>
                <div className='flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] font-medium text-[#1f3565]'>
                  <label className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      checked={!isProjectArchived(projectDetailsForm.status)}
                      disabled={!canEditProject}
                      onChange={(event) =>
                        onProjectFormChange({
                          ...projectDetailsForm,
                          projectId: selectedProject.id,
                          status: event.target.checked ? 'ACTIVE' : 'ARCHIVED',
                        })
                      }
                    />
                    <span>Активный</span>
                  </label>
                  <label className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      checked={projectDetailsForm.is_internal}
                      disabled={!canEditProject}
                      onChange={(event) =>
                        onProjectFormChange({
                          ...projectDetailsForm,
                          projectId: selectedProject.id,
                          is_internal: event.target.checked,
                        })
                      }
                    />
                    <span>Внутренний проект</span>
                  </label>
                  <label className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      checked={projectDetailsForm.exclude_from_payroll}
                      disabled={!canEditProject}
                      onChange={(event) =>
                        onProjectFormChange({
                          ...projectDetailsForm,
                          projectId: selectedProject.id,
                          exclude_from_payroll: event.target.checked,
                          payroll_exclusion_scope: event.target.checked
                            ? projectDetailsForm.payroll_exclusion_scope
                            : 'ALL',
                          payroll_excluded_employee_ids: event.target.checked
                            ? projectDetailsForm.payroll_excluded_employee_ids
                            : [],
                        })
                      }
                    />
                    <span>Не учитывать часы проекта в оплате</span>
                  </label>
                  <label className='flex items-center gap-2'>
                    <span className='whitespace-nowrap'>Недельный лимит, ч</span>
                    <span className='block w-28 shrink-0'>
                      <Input
                        inputMode='decimal'
                        value={projectDetailsForm.weekly_limit_hours ?? ''}
                        readOnly={!canEditProject}
                        placeholder='Не задан'
                        aria-invalid={weeklyLimitSeconds === undefined}
                        onChange={(event) =>
                          onProjectFormChange({
                            ...projectDetailsForm,
                            projectId: selectedProject.id,
                            weekly_limit_hours: event.target.value,
                          })
                        }
                        className={`${aboutControlClassName} ${
                          weeklyLimitSeconds === undefined
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                            : ''
                        }`}
                      />
                    </span>
                  </label>
                </div>
                {weeklyLimitSeconds === undefined ? (
                  <span className='text-xs text-red-500'>
                    Недельный лимит: нужно число часов от 0 до {MAX_WEEKLY_LIMIT_HOURS},
                    например 7,5.
                  </span>
                ) : (
                  <span className={aboutHintClassName}>
                    {selectedClientWeeklyLimit != null
                      ? `У клиента задан общий лимит ${formatHoursCompact(selectedClientWeeklyLimit)} ч в неделю на все его проекты — в отчёте действует он, лимит проекта не учитывается.`
                      : 'Недельный лимит — для отчёта «Лимитные проекты». Пусто — без лимита.'}
                  </span>
                )}
                {projectDetailsForm.exclude_from_payroll ? (
                  <div className='grid gap-2 border-t border-[#dbe6ff] pt-2 text-[14px] text-[#1f3565]'>
                    <div className='flex flex-wrap gap-x-5 gap-y-2'>
                      <label className='flex items-center gap-2'>
                        <input
                          type='radio'
                          name={`payroll-exclusion-scope-${selectedProject.id}`}
                          value='ALL'
                          checked={projectDetailsForm.payroll_exclusion_scope === 'ALL'}
                          disabled={!canEditProject}
                          onChange={() =>
                            onProjectFormChange({
                              ...projectDetailsForm,
                              projectId: selectedProject.id,
                              payroll_exclusion_scope: 'ALL',
                              payroll_excluded_employee_ids: [],
                            })
                          }
                        />
                        <span>У всех сотрудников</span>
                      </label>
                      <label className='flex items-center gap-2'>
                        <input
                          type='radio'
                          name={`payroll-exclusion-scope-${selectedProject.id}`}
                          value='SELECTED'
                          checked={
                            projectDetailsForm.payroll_exclusion_scope === 'SELECTED'
                          }
                          disabled={!canEditProject}
                          onChange={() =>
                            onProjectFormChange({
                              ...projectDetailsForm,
                              projectId: selectedProject.id,
                              payroll_exclusion_scope: 'SELECTED',
                            })
                          }
                        />
                        <span>У определённых сотрудников</span>
                      </label>
                    </div>
                    {projectDetailsForm.payroll_exclusion_scope === 'SELECTED' ? (
                      <div className='grid max-w-180 gap-1.5'>
                        <ChipsMultiSelect
                          values={projectDetailsForm.payroll_excluded_employee_ids}
                          onChange={(payroll_excluded_employee_ids) =>
                            onProjectFormChange({
                              ...projectDetailsForm,
                              projectId: selectedProject.id,
                              payroll_excluded_employee_ids,
                            })
                          }
                          options={payrollEmployeeOptions}
                          placeholder='Выберите сотрудников'
                          emptyText='Все сотрудники выбраны'
                          disabled={!canEditProject}
                        />
                        {isPayrollEmployeeSelectionRequired ? (
                          <span className='text-xs text-red-500'>
                            Выберите минимум одного сотрудника.
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>

            <section className={aboutCardClassName}>
              <h3 className={aboutCardTitleClassName}>Теги</h3>

              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-[13px] text-[#7a8aae]'>Добавленные теги:</span>
                {projectTags.length === 0 ? (
                  <span className='text-xs text-[#9aa8c7]'>Тегов пока нет</span>
                ) : (
                  projectTags.map((tag) => (
                    <span
                      key={tag.id}
                      className='inline-flex items-center gap-1.5 rounded-full border border-[#c9d8f8] bg-[#edf3ff] px-2.5 py-1 text-xs font-medium text-[#1f3565]'
                    >
                      {tag.name}
                      {canEditProject ? (
                        <button
                          type='button'
                          onClick={() => handleRemoveTag(tag.name)}
                          disabled={isSavingTags}
                          className='grid size-4 place-items-center rounded-full text-[#7a8aae] transition-colors hover:bg-[#dbe6ff] hover:text-[#1f3565] disabled:cursor-not-allowed disabled:opacity-50'
                          title='Удалить тег'
                        >
                          <svg
                            viewBox='0 0 12 12'
                            className='size-2.5 fill-none stroke-current stroke-2'
                          >
                            <path
                              d='M3 3l6 6M9 3l-6 6'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                            />
                          </svg>
                        </button>
                      ) : null}
                    </span>
                  ))
                )}
              </div>

              {canEditProject ? (
                <div className='grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center'>
                  <span className='text-[13px] text-[#7a8aae]'>Добавить тег:</span>
                  <Input
                    list='project-tag-suggestions'
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    placeholder='Введите новый тег или выберите из списка'
                    disabled={isSavingTags}
                    className={aboutControlClassName}
                  />
                  <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    onClick={() => handleAddTag(tagInput)}
                    disabled={isSavingTags || tagInput.trim() === ''}
                  >
                    Добавить
                  </Button>
                  <datalist id='project-tag-suggestions'>
                    {tagSuggestions.map((tag) => (
                      <option key={tag.id} value={tag.name} />
                    ))}
                  </datalist>
                </div>
              ) : null}
            </section>

            {canEditProject && (
              <div className='sticky bottom-0 z-10 -mx-2 mt-auto -mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e3e9f3] bg-white/95 px-3 py-2.5 backdrop-blur sm:-mx-4 sm:-mb-4 sm:px-4 sm:py-3'>
                {/* Кнопки слева: тосты всплывают справа внизу и закрывали бы «Сохранить». */}
                <div className='flex gap-2'>
                  <Button
                    type='button'
                    onClick={() => void handleSaveAbout()}
                    disabled={
                      !isAboutDirty || isSavingAbout || isPayrollEmployeeSelectionRequired
                    }
                    variant={isSavingAbout ? 'secondary' : 'primary'}
                  >
                    {isSavingAbout ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                  {isAboutDirty ? (
                    <Button
                      type='button'
                      variant='secondary'
                      onClick={handleResetAbout}
                      disabled={isSavingAbout}
                    >
                      Отменить
                    </Button>
                  ) : null}
                </div>
                {isAboutDirty ? (
                  <span className='text-[13px] font-medium text-amber-700'>
                    Изменения не сохранены
                  </span>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <div className='grid min-h-50 place-items-center text-[14px] text-[#7e8fb4]'>
            Раздел в разработке.
          </div>
        )}
      </div>

      {canManageProjectMembers && isTeamModalOpen && (
        <ProjectTeamModal
          isOpen={isTeamModalOpen}
          isSaving={isSavingTeam}
          members={members}
          managerIds={projectManagerIds}
          managerPaymentMethod={selectedProject.manager_payment_method ?? 'ACCRUE_ALL'}
          allActiveEmployees={allActiveEmployees}
          canEditManagerPaymentMethod={canEditProject}
          onClose={() => setIsTeamModalOpen(false)}
          onDetails={() => {
            setIsTeamModalOpen(false);
            setSelectedTab('team');
          }}
          onSave={(memberIds, managerIds, pmPayrollSelection, managerPaymentMethod) =>
            handleSaveTeam(
              memberIds,
              managerIds,
              pmPayrollSelection,
              managerPaymentMethod,
            )
          }
        />
      )}

      {isRateHistoryOpen && (
        <ProjectRateHistoryModal
          isOpen={isRateHistoryOpen}
          projectId={selectedProject.id}
          onClose={() => setIsRateHistoryOpen(false)}
        />
      )}

      {canEditProject && isRateModalOpen && (
        <ProjectRateModal
          isOpen={isRateModalOpen}
          isSaving={isSavingRate}
          initialForm={{
            rate: selectedProject.current_rate
              ? String(selectedProject.current_rate.rate / 100)
              : '',
            currency: selectedProject.current_rate?.currency ?? DEFAULT_RATE_CURRENCY,
            vat:
              selectedProject.current_rate?.vat != null
                ? String(selectedProject.current_rate.vat)
                : '',
            startDate: selectedProject.current_rate?.effective_from ?? '',
          }}
          onClose={() => setIsRateModalOpen(false)}
          onSave={handleSaveRate}
        />
      )}
    </div>
  );
}
