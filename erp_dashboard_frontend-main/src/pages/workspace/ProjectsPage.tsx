import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../api/api';
import AllTasksTablePanel from '../../components/page-elements/workspace/projects/AllTasksTablePanel/AllTasksTablePanel';
import ProjectDetailsPanel from '../../components/page-elements/workspace/projects/ProjectDetailsPanel';
import ProjectsListPanel from '../../components/page-elements/workspace/projects/ProjectsListPanel';
import ProjectsTablePanel, {
  type ProjectSortKey,
} from '../../components/page-elements/workspace/projects/ProjectsTablePanel';
import {
  ClientModal,
  emptyClientForm,
  type FieldErrors,
} from '../../components/page-elements/workspace/clients/ClientPageComponents';
import ProjectModal from '../../components/modals/ProjectModal';
import ProjectTeamModal from '../../components/modals/ProjectTeamModal';
import ExportDataModal from '../../components/modals/ExportDataModal';
import ConfirmDialog from '../../components/modals/ConfirmDialog';
import type { ProjectRateForm } from '../../components/modals/ProjectRateModal';
import { useAppControllerContext } from '../../context/AppControllerContext';
import { useTariffAccess } from '../../hooks/useTariffAccess';
import { createInitialProjectForm } from '../../hooks/formFactories';
import {
  formatDurationHms,
  formatName,
  formatProjectStatus,
  isEmployeeBlocked,
  isProjectArchived,
  parseHoursInput,
} from '../../utils/formatters';
import {
  hasProjectEditorChanges,
  MAX_WEEKLY_LIMIT_HOURS,
  projectToEditorForm,
} from '../../utils/projectEditorForm';
import {
  downloadCsv,
  downloadExportXlsx,
  type ExportTableData,
} from '../../utils/exportFiles';
import type {
  Project,
  Client,
  ClientForm,
  ProjectDetails,
  ProjectEditorForm,
  ProjectMember,
  Tag,
  Template,
  User,
  ProjectForm,
} from '../../types/app';
import ImportDataModal from '../../components/modals/ImportDataModal';
import { useServerPagination } from '../../components/ui/Pagination';
import { parseCSV, parseXLSX } from '../../utils/importFiles';

export default function ProjectsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, socketData } = useAppControllerContext();
  const userPermissions = user?.permissions ?? [];
  const canOpenProjectsPage =
    userPermissions.includes('projects.manage') ||
    userPermissions.includes('projects.view_all') ||
    userPermissions.includes('projects.view_assigned');
  const canViewProjects =
    userPermissions.includes('projects.view_all') ||
    userPermissions.includes('projects.view_assigned') ||
    userPermissions.includes('projects.manage');
  const canEditProject = userPermissions.includes('projects.create_update');
  const canArchiveProject = userPermissions.includes('projects.delete');
  const canManageProjectMembers = userPermissions.includes('project.members.manage');
  const canViewProjectTasksTab = userPermissions.includes('projects.tabs.tasks.view');
  const canViewProjectNotesTab = userPermissions.includes('projects.tabs.notes.view');
  const canViewProjectDocumentsTab = userPermissions.includes(
    'projects.tabs.documents.view',
  );
  const canViewProjectReportsTab = userPermissions.includes('projects.tabs.reports.view');
  const canViewProjectFinanceTab = userPermissions.includes('projects.tabs.finance.view');
  // На ФРИ ставки проектов закрыты: в форме нового проекта поля ставки нет.
  const isProjectEconomicsLocked = useTariffAccess().isFeatureLocked('project_economics');
  const canManageFinance = userPermissions.includes('finance.manage');
  const canViewFinanceArticles =
    userPermissions.includes('finance.view') || canManageFinance;
  const canViewProjectAboutTab = userPermissions.includes('projects.tabs.about.view');
  const canViewProjectDetails = canEditProject || canViewProjectAboutTab;
  const canCreateUpdateProjectNotes = userPermissions.includes(
    'projects.notes.create_update',
  );
  const canDeleteProjectNotes = userPermissions.includes('projects.notes.delete');
  const canCreateUpdateProjectDocuments = userPermissions.includes(
    'projects.documents.create_update',
  );
  const canDeleteProjectDocuments = userPermissions.includes('projects.documents.delete');
  const canCreateUpdateTasks = userPermissions.includes('tasks.create_update');
  const canMoveTasks = userPermissions.includes('tasks.move');
  const canCreateUpdateTaskStatuses = userPermissions.includes(
    'tasks.status.create_update',
  );
  const canDeleteTaskStatuses = userPermissions.includes('tasks.status.delete');
  const canViewTemplates = canViewProjects;
  const canDeleteAnyComment = userPermissions.includes(
    'projects.tabs.tasks.comments.delete_all',
  );
  const canDeleteOwnComment = userPermissions.includes(
    'projects.tabs.tasks.comments.delete_self',
  );
  const canDeleteAnyAttachments = userPermissions.includes(
    'projects.tabs.tasks.attachments.delete_all',
  );
  const canDeleteOwnAttachments = userPermissions.includes(
    'projects.tabs.tasks.attachments.delete_self',
  );
  const canViewClientTab = userPermissions.includes('projects.tabs.tasks.client.view');
  const canViewClientComments = userPermissions.includes(
    'projects.tabs.tasks.client.comments.view',
  );
  const canReplyToClient = userPermissions.includes('projects.tabs.tasks.client.reply');
  const canUpdateClientStatus = userPermissions.includes(
    'projects.tabs.tasks.client.status.update',
  );
  const canManageClientLink = userPermissions.includes(
    'projects.tabs.tasks.client.link.manage',
  );
  const currentUserId = user?.id ?? '';

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTableProjects, setIsLoadingTableProjects] = useState(false);
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isAssigningEmployeeToProject, setIsAssigningEmployeeToProject] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [projectFinanceRefreshKey, setProjectFinanceRefreshKey] = useState(0);
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projectManagerIdsByProject, setProjectManagerIdsByProject] = useState<
    Record<string, string[]>
  >({});
  const [employees, setEmployees] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectListOrderIds, setProjectListOrderIds] = useState<string[]>([]);
  const [tableProjects, setTableProjects] = useState<Project[]>([]);
  const {
    currentPage: tablePage,
    pageSize: tablePageSize,
    totalPages: tableTotalPages,
    setCurrentPage: setTablePage,
    resetPage: resetTablePage,
    onPageSizeChange: onTablePageSizeChange,
    applyMeta: applyTableMeta,
  } = useServerPagination(20);
  const [hasTablePaginationMeta, setHasTablePaginationMeta] = useState(false);
  const [tableSortKey, setTableSortKey] = useState<ProjectSortKey | ''>('');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClientForm);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [editingTeamProjectId, setEditingTeamProjectId] = useState('');
  const [projectDetailsInitialTab, setProjectDetailsInitialTab] = useState<
    | 'tasks'
    | 'team'
    | 'activity'
    | 'notes'
    | 'documents'
    | 'reports'
    | 'finances'
    | 'about'
    | undefined
  >(undefined);
  const [selectedProjectStats, setSelectedProjectStats] = useState<ProjectDetails | null>(
    null,
  );
  const [projectForm, setProjectForm] = useState(createInitialProjectForm);
  const [selectedProjectForm, setSelectedProjectForm] = useState<ProjectEditorForm>({
    projectId: '',
    name: '',
    description: '',
    status: 'ACTIVE',
    client_id: '',
    manager_payment_method: 'ACCRUE_ALL',
    is_internal: false,
    exclude_from_payroll: false,
    payroll_exclusion_scope: 'ALL',
    payroll_excluded_employee_ids: [],
  });
  const [removingEmployeeIds, setRemovingEmployeeIds] = useState<Set<string>>(new Set());
  const [assignProjectEmployeeId, setAssignProjectEmployeeId] = useState('');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listStatusFilter, setListStatusFilter] = useState('ALL');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState('ALL');
  const [isAllTasksActive, setIsAllTasksActive] = useState(false);
  const [isMobileContentOpen, setIsMobileContentOpen] = useState(() => {
    const initialParams = new URLSearchParams(location.search);
    return Boolean(
      initialParams.get('project_id') ||
      initialParams.get('task_id') ||
      initialParams.get('note_id'),
    );
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isProjectImporting, setIsProjectImporting] = useState(false);
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const requestedProjectId = queryParams.get('project_id') ?? '';
  const requestedProjectIdRef = useRef(requestedProjectId);
  requestedProjectIdRef.current = requestedProjectId;
  const requestedTemplateId = queryParams.get('template_id') ?? '';
  const requestedClientId = queryParams.get('client_id') ?? '';
  const requestedTaskId = queryParams.get('task_id') ?? '';
  const requestedNoteId = queryParams.get('note_id') ?? '';

  const updateProjectsUrl = useCallback(
    (projectId: string, taskId = '') => {
      const params = new URLSearchParams(location.search);

      params.delete('template_id');
      params.delete('client_id');
      params.delete('note_id');

      if (projectId) {
        params.set('project_id', projectId);
      } else {
        params.delete('project_id');
      }

      if (projectId && taskId) {
        params.set('task_id', taskId);
      } else {
        params.delete('task_id');
      }

      const search = params.toString();
      const nextUrl = `${location.pathname}${search ? `?${search}` : ''}`;
      const currentUrl = `${location.pathname}${location.search}`;

      if (nextUrl !== currentUrl) {
        navigate(nextUrl, { replace: true });
      }
    },
    [location.pathname, location.search, navigate],
  );

  const activeEmployees = useMemo(
    () => employees.filter((employee) => !isEmployeeBlocked(employee.status)),
    [employees],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    setProjectListOrderIds((prev) => {
      const currentIds = projects.map((project) => project.id);
      const currentIdSet = new Set(currentIds);
      const next = prev.filter((id) => currentIdSet.has(id));

      for (const id of currentIds) {
        if (!next.includes(id)) {
          next.push(id);
        }
      }

      return next.length === prev.length && next.every((id, index) => id === prev[index])
        ? prev
        : next;
    });
  }, [projects]);

  const projectDetailsForm = useMemo<ProjectEditorForm>(() => {
    if (!selectedProject) {
      return {
        projectId: '',
        name: '',
        description: '',
        status: 'ACTIVE',
        client_id: '',
        manager_payment_method: 'ACCRUE_ALL',
        is_internal: false,
        exclude_from_payroll: false,
        payroll_exclusion_scope: 'ALL',
        payroll_excluded_employee_ids: [],
      };
    }

    if (selectedProjectForm.projectId === selectedProject.id) {
      return selectedProjectForm;
    }

    return projectToEditorForm(selectedProject);
  }, [selectedProject, selectedProjectForm]);

  const editingTeamProject = useMemo(
    () =>
      editingTeamProjectId
        ? (projects.find((project) => project.id === editingTeamProjectId) ?? null)
        : null,
    [editingTeamProjectId, projects],
  );

  const editingTeamProjectManagerIds = useMemo(() => {
    if (!editingTeamProject) return [];
    const stored = projectManagerIdsByProject[editingTeamProject.id];
    if (stored) return stored;
    return (editingTeamProject.members ?? [])
      .filter((member) => member.is_pm)
      .map((member) => member.user.id);
  }, [editingTeamProject, projectManagerIdsByProject]);

  const unassignedEmployeesForSelectedProject = useMemo(() => {
    if (!selectedProject) return [];
    return activeEmployees.filter(
      (employee) =>
        !selectedProject.members.some(
          (member: ProjectMember) => member.user.id === employee.id,
        ),
    );
  }, [activeEmployees, selectedProject]);

  const projectCounts = useMemo(() => {
    const active = projects.filter(
      (project) => !isProjectArchived(project.status),
    ).length;

    return {
      active,
      archived: projects.length - active,
    };
  }, [projects]);

  const panelProjects = useMemo(() => {
    const query = listSearchQuery.trim().toLowerCase();
    return projects.filter((project) => {
      const archived = isProjectArchived(project.status);
      if (listStatusFilter === 'ACTIVE' && archived) return false;
      if (listStatusFilter === 'ARCHIVED' && !archived) return false;

      if (!query) return true;
      const name = (project.name ?? '').toLowerCase();
      const description = (project.description ?? '').toLowerCase();
      return name.includes(query) || description.includes(query);
    });
  }, [projects, listStatusFilter, listSearchQuery]);

  const defaultTemplateId = useMemo(
    () => templates.find((template) => template.is_default_template)?.id ?? '',
    [templates],
  );

  const projectExportData = useMemo<ExportTableData>(() => {
    const formatCurrency = (value?: number | null, currency = 'RUB') => {
      if (value == null) return '';
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(value / 100);
    };
    const formatPeriod = (start?: string | null, end?: string | null) => {
      if (!start && !end) return '';
      const startDate = start ? new Date(start).toLocaleDateString('ru-RU') : '';
      const endDate = end ? new Date(end).toLocaleDateString('ru-RU') : '';
      return `${startDate} - ${endDate}`;
    };

    return {
      headers: [
        'Название',
        'Клиент',
        'Статус',
        'Менеджеры',
        'Участники',
        'Часы за неделю',
        'Затрачено',
        'Бюджет',
        'Сроки',
      ],
      rows: tableProjects.map((project) => {
        const managers = (project.members ?? [])
          .filter((member) => member.is_pm)
          .map((member) => formatName(member.user))
          .filter(Boolean)
          .join(', ');
        const members = (project.members ?? [])
          .map((member) => formatName(member.user))
          .filter(Boolean)
          .join(', ');

        return [
          project.name,
          project.client?.name ?? '',
          formatProjectStatus(project.status),
          managers,
          members,
          formatDurationHms(project.weekly_seconds ?? 0),
          formatCurrency(project.weekly_amount, project.weekly_amount_currency),
          formatCurrency(project.budget),
          formatPeriod(project.starts_at, project.ends_at),
        ];
      }),
      fileName: 'projects',
      sheetName: 'Проекты',
    };
  }, [tableProjects]);

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  /* const showImportStub = () => {
    toast.message('Импорт пока недоступен.');
  }; */

  const exportProjectsXlsx = async () => {
    await downloadExportXlsx(projectExportData);
    setIsExportModalOpen(false);
    toast.success('XLSX сохранен.');
  };

  const exportProjectsCsv = () => {
    downloadCsv(projectExportData);
    setIsExportModalOpen(false);
    toast.success('CSV сохранен.');
  };

  const fetchEmployees = useCallback(async () => {
    try {
      const employeeData = await api.workspace.employees.getMany({
        status: 'active',
        per_page: 1000,
      });
      setEmployees(Array.isArray(employeeData.data) ? employeeData.data : []);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const fetchProjects = useCallback(async () => {
    if (!canViewProjects) {
      setProjects([]);
      return;
    }

    try {
      setIsLoadingProjects(true);
      const requestedId = requestedProjectIdRef.current;
      const [response, pinnedIds, sidebarOrderIds] = await Promise.all([
        api.workspace.projects.getMany(),
        api.workspace.projects.getPinned(),
        api.workspace.projects.getSidebarOrder(),
      ]);

      let projectList = Array.isArray(response.data) ? response.data : [];
      if (requestedId && !projectList.some((project) => project.id === requestedId)) {
        try {
          const details = await api.workspace.projects.getDetails(requestedId);
          if (details.project) {
            projectList = [details.project, ...projectList];
          }
        } catch {
          // Если прямой project_id недоступен, показываем обычный список.
        }
      }

      const pinnedSet = new Set(pinnedIds);
      setProjectListOrderIds(() => {
        const projectIds = projectList.map((project) => project.id);
        const projectIdSet = new Set(projectIds);
        const next = sidebarOrderIds.filter((id) => projectIdSet.has(id));

        for (const id of projectIds) {
          if (!next.includes(id)) {
            next.push(id);
          }
        }

        return next;
      });

      setProjects((prev) => {
        const pinnedAtMap = new Map(prev.map((p) => [p.id, p.pinned_at]));
        return projectList.map((p) => {
          const isPinned = pinnedSet.has(p.id);
          return {
            ...p,
            is_pinned: isPinned,
            pinned_at: isPinned ? pinnedAtMap.get(p.id) || Date.now() : undefined,
          };
        });
      });

      setSelectedProjectId((prev) => {
        if (!projectList.length) return '';
        const currentRequestedId = requestedProjectIdRef.current;
        if (
          currentRequestedId &&
          projectList.some((project) => project.id === currentRequestedId)
        ) {
          return currentRequestedId;
        }
        if (prev && projectList.some((project) => project.id === prev)) {
          return prev;
        }
        return '';
      });
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [canViewProjects, handleError]);

  const fetchTableProjects = useCallback(async () => {
    if (!canViewProjects) {
      setTableProjects([]);
      return;
    }

    try {
      setIsLoadingTableProjects(true);
      const trimmedSearch = tableSearchQuery.trim();
      const status =
        tableStatusFilter === 'ACTIVE'
          ? 'active'
          : tableStatusFilter === 'ARCHIVED'
            ? 'archived'
            : 'all';
      const params: Record<string, string | number> = {
        status,
        page: tablePage,
        per_page: tablePageSize,
      };

      if (trimmedSearch) {
        params.search = trimmedSearch;
      }

      if (tableSortKey) {
        params.sort_by = tableSortKey;
        params.sort_direction = tableSortDirection;
      }

      const response = await api.workspace.projects.getMany(params);
      setTableProjects(Array.isArray(response.data) ? response.data : []);
      setHasTablePaginationMeta(Boolean(response.meta));
      if (response.meta) {
        applyTableMeta(response.meta);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingTableProjects(false);
    }
  }, [
    canViewProjects,
    applyTableMeta,
    handleError,
    tablePage,
    tablePageSize,
    tableSearchQuery,
    tableSortDirection,
    tableSortKey,
    tableStatusFilter,
  ]);

  const fetchProjectDetails = useCallback(
    async (projectId: string) => {
      if (!projectId) {
        setSelectedProjectStats(null);
        return;
      }
      try {
        setIsStatsLoading(true);
        const details = await api.workspace.projects.getDetails(projectId);
        setSelectedProjectStats(details);
        if (details.project) {
          const detailedProject = details.project;
          setProjects((prev) =>
            prev.map((project) =>
              project.id === detailedProject.id
                ? {
                    ...project,
                    ...detailedProject,
                    is_pinned: detailedProject.is_pinned ?? project.is_pinned,
                    pinned_at: detailedProject.pinned_at ?? project.pinned_at,
                  }
                : project,
            ),
          );
        }
      } catch (err) {
        setSelectedProjectStats(null);
        handleError(err);
      } finally {
        setIsStatsLoading(false);
      }
    },
    [handleError],
  );

  const fetchTags = useCallback(async () => {
    if (!canViewProjectAboutTab) {
      setAvailableTags([]);
      return;
    }

    try {
      const tags = await api.workspace.tags.getMany();
      setAvailableTags(tags);
    } catch {
      // Тихий отказ для подсказок тегов
    }
  }, [canViewProjectAboutTab]);

  const fetchTemplates = useCallback(async () => {
    if (!canViewTemplates) {
      setTemplates([]);
      return;
    }

    try {
      const response = await api.workspace.templates.getMany({ per_page: 1000 });
      setTemplates(Array.isArray(response.data) ? response.data : []);
    } catch {
      // Тихий отказ для списка шаблонов
    }
  }, [canViewTemplates]);

  const openCreateProjectModal = useCallback(
    (templateId = '', clientId = '') => {
      setProjectForm({
        ...createInitialProjectForm(templateId || defaultTemplateId),
        client_id: clientId,
      });
      setIsProjectModalOpen(true);
    },
    [defaultTemplateId],
  );

  const fetchClients = useCallback(async () => {
    if (!canEditProject) {
      setClients([]);
      return;
    }

    try {
      const response = await api.workspace.clients.getMany({ per_page: 1000 });
      setClients(Array.isArray(response.data) ? response.data : []);
    } catch {
      // Тихий отказ: создание проекта останется доступно без выбора клиента.
    }
  }, [canEditProject]);

  useEffect(() => {
    const needsEmployeesForProjectForm =
      canEditProject && (isProjectModalOpen || Boolean(selectedProjectId));
    const needsEmployeesForTeam =
      canManageProjectMembers && Boolean(selectedProjectId || editingTeamProjectId);

    if (!needsEmployeesForProjectForm && !needsEmployeesForTeam) {
      setEmployees([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 0);
    return () => clearTimeout(timer);
  }, [
    canEditProject,
    canManageProjectMembers,
    editingTeamProjectId,
    fetchEmployees,
    isProjectModalOpen,
    selectedProjectId,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProjects]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTableProjects();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTableProjects]);

  useEffect(() => {
    if (!canViewProjectDetails) {
      setSelectedProjectStats(null);
      return;
    }
    const timer = setTimeout(() => {
      fetchProjectDetails(selectedProjectId);
    }, 0);
    return () => clearTimeout(timer);
  }, [canViewProjectDetails, fetchProjectDetails, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || availableTags.length > 0) return;
    const timer = setTimeout(() => {
      fetchTags();
    }, 0);
    return () => clearTimeout(timer);
  }, [availableTags.length, fetchTags, selectedProjectId]);

  useEffect(() => {
    if (!isProjectModalOpen || templates.length > 0) return;
    const timer = setTimeout(() => {
      fetchTemplates();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchTemplates, isProjectModalOpen, templates.length]);

  useEffect(() => {
    if ((!isProjectModalOpen && !selectedProjectId) || clients.length > 0) return;
    const timer = setTimeout(() => {
      fetchClients();
    }, 0);
    return () => clearTimeout(timer);
  }, [clients.length, fetchClients, isProjectModalOpen, selectedProjectId]);

  useEffect(() => {
    if (!requestedTemplateId) return;
    openCreateProjectModal(requestedTemplateId, requestedClientId);
  }, [openCreateProjectModal, requestedClientId, requestedTemplateId]);

  useEffect(() => {
    if (!requestedClientId || requestedTemplateId) return;
    openCreateProjectModal('', requestedClientId);
  }, [openCreateProjectModal, requestedClientId, requestedTemplateId]);

  const onCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEditProject) return;
    if (
      projectForm.exclude_from_payroll &&
      projectForm.payroll_exclusion_scope === 'SELECTED' &&
      projectForm.payroll_excluded_employee_ids.length === 0
    ) {
      toast.error('Выберите минимум одного сотрудника.');
      return;
    }

    try {
      setIsAddingProject(true);
      const templateId = projectForm.template?.trim();
      const createPayload: ProjectForm = {
        ...projectForm,
        payroll_exclusion_scope: projectForm.exclude_from_payroll
          ? projectForm.payroll_exclusion_scope
          : 'ALL',
        payroll_excluded_employee_ids:
          projectForm.exclude_from_payroll &&
          projectForm.payroll_exclusion_scope === 'SELECTED'
            ? projectForm.payroll_excluded_employee_ids
            : [],
      };
      if (templateId) {
        await api.workspace.projects.createFromTemplate(templateId, createPayload);
      } else {
        await api.workspace.projects.create(createPayload);
      }
      setProjectForm(createInitialProjectForm());
      setIsProjectModalOpen(false);
      toast.success('Проект создан.');
      fetchProjects();
      fetchTableProjects();
      if (requestedTemplateId || requestedClientId) {
        navigate(location.pathname, { replace: true });
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsAddingProject(false);
    }
  };

  const openClientCreateModal = () => {
    setClientForm(emptyClientForm);
    setClientErrors({});
    setIsClientModalOpen(true);
  };

  const onCreateClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clientForm.name.trim()) {
      setClientErrors({ name: 'Заполните наименование.' });
      return;
    }

    try {
      setIsAddingClient(true);
      setClientErrors({});
      await api.workspace.clients.create(clientForm);
      toast.success('Клиент добавлен.');
      setIsClientModalOpen(false);
      setClientForm(emptyClientForm);
      fetchClients();
    } catch (err) {
      handleError(err);
    } finally {
      setIsAddingClient(false);
    }
  };

  const onUpdateProject = async () => {
    if (!canEditProject) return;
    if (!selectedProject) return;
    if (
      projectDetailsForm.exclude_from_payroll &&
      projectDetailsForm.payroll_exclusion_scope === 'SELECTED' &&
      projectDetailsForm.payroll_excluded_employee_ids.length === 0
    ) {
      toast.error('Выберите минимум одного сотрудника.');
      return;
    }
    const weeklyLimitSeconds = parseHoursInput(
      projectDetailsForm.weekly_limit_hours ?? '',
      MAX_WEEKLY_LIMIT_HOURS,
    );
    if (weeklyLimitSeconds === undefined) {
      toast.error(
        `Недельный лимит: укажите число часов от 0 до ${MAX_WEEKLY_LIMIT_HOURS}, например 7,5, или оставьте пустым.`,
      );
      return;
    }

    try {
      setIsUpdatingProject(true);
      if (
        !hasProjectEditorChanges(projectDetailsForm, selectedProject, weeklyLimitSeconds)
      ) {
        toast.message('Нет изменений для сохранения.');
        return;
      }

      const updatedProject = await api.workspace.projects.update(selectedProject.id, {
        projectId: selectedProject.id,
        name: projectDetailsForm.name,
        description: projectDetailsForm.description,
        status: projectDetailsForm.status,
        client_id: projectDetailsForm.client_id || '',
        manager_payment_method: projectDetailsForm.manager_payment_method,
        is_internal: projectDetailsForm.is_internal,
        exclude_from_payroll: projectDetailsForm.exclude_from_payroll,
        payroll_exclusion_scope: projectDetailsForm.exclude_from_payroll
          ? projectDetailsForm.payroll_exclusion_scope
          : 'ALL',
        payroll_excluded_employee_ids:
          projectDetailsForm.exclude_from_payroll &&
          projectDetailsForm.payroll_exclusion_scope === 'SELECTED'
            ? projectDetailsForm.payroll_excluded_employee_ids
            : [],
        weekly_limit_seconds: weeklyLimitSeconds,
      });

      setProjects((current) =>
        current.map((project) =>
          project.id === updatedProject.id ? { ...project, ...updatedProject } : project,
        ),
      );
      setSelectedProjectForm({
        ...projectDetailsForm,
        status: isProjectArchived(updatedProject.status) ? 'ARCHIVED' : 'ACTIVE',
      });
      setProjectFinanceRefreshKey((current) => current + 1);

      toast.success('Проект обновлён.');
      await Promise.all([
        fetchProjects(),
        fetchTableProjects(),
        fetchProjectDetails(selectedProject.id),
      ]);
    } catch (err) {
      handleError(err);
    } finally {
      setIsUpdatingProject(false);
    }
  };

  const onUpdateProjectCreator = async (createdById: string): Promise<Project> => {
    if (!canEditProject || !selectedProject) {
      throw new Error('Недостаточно прав для изменения создателя проекта.');
    }

    const updatedProject = await api.workspace.projects.updateProjectCreator(
      selectedProject.id,
      { created_by_id: createdById },
    );
    await Promise.all([
      fetchProjects(),
      fetchTableProjects(),
      fetchProjectDetails(selectedProject.id),
    ]);
    return updatedProject;
  };

  const archiveProject = async (project: Project) => {
    if (!canArchiveProject) return;

    try {
      setIsUpdatingProject(true);
      const updatedProject = await api.workspace.projects.update(project.id, {
        projectId: project.id,
        name: project.name || '',
        description: project.description || '',
        status: 'ARCHIVED',
        client_id: project.client_id ?? '',
        manager_payment_method: project.manager_payment_method ?? 'ACCRUE_ALL',
        is_internal: Boolean(project.is_internal),
        exclude_from_payroll: Boolean(project.exclude_from_payroll),
        payroll_exclusion_scope:
          project.payroll_exclusion_scope === 'SELECTED' ? 'SELECTED' : 'ALL',
        payroll_excluded_employee_ids:
          project.exclude_from_payroll && project.payroll_exclusion_scope === 'SELECTED'
            ? (project.payroll_excluded_employee_ids ?? [])
            : [],
      });
      setProjects((current) =>
        current.map((item) =>
          item.id === updatedProject.id ? { ...item, ...updatedProject } : item,
        ),
      );
      toast.success('Проект перемещен в архив.');
      await Promise.all([
        fetchProjects(),
        fetchTableProjects(),
        selectedProjectId === project.id
          ? fetchProjectDetails(project.id)
          : Promise.resolve(),
      ]);
      if (selectedProjectId === project.id) {
        setProjectFinanceRefreshKey((current) => current + 1);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsUpdatingProject(false);
    }
  };

  const deleteProject = async () => {
    if (!deleteProjectTarget) return;
    if (!isProjectArchived(deleteProjectTarget.status)) {
      toast.error('Удалять можно только проекты из архива.');
      setDeleteProjectTarget(null);
      return;
    }

    try {
      setIsDeletingProject(true);
      await api.workspace.projects.delete(deleteProjectTarget.id);
      toast.success('Проект удалён.');
      if (selectedProjectId === deleteProjectTarget.id) {
        setProjectDetailsInitialTab(undefined);
        setSelectedProjectId('');
        updateProjectsUrl('');
      }
      setDeleteProjectTarget(null);
      fetchProjects();
      fetchTableProjects();
    } catch (err) {
      handleError(err);
    } finally {
      setIsDeletingProject(false);
    }
  };

  const restoreProject = async (project: Project) => {
    if (!canArchiveProject) return;

    try {
      setIsUpdatingProject(true);
      const updatedProject = await api.workspace.projects.update(project.id, {
        projectId: project.id,
        name: project.name || '',
        description: project.description || '',
        status: 'ACTIVE',
        client_id: project.client_id ?? '',
        manager_payment_method: project.manager_payment_method ?? 'ACCRUE_ALL',
        is_internal: Boolean(project.is_internal),
        exclude_from_payroll: Boolean(project.exclude_from_payroll),
        payroll_exclusion_scope:
          project.payroll_exclusion_scope === 'SELECTED' ? 'SELECTED' : 'ALL',
        payroll_excluded_employee_ids:
          project.exclude_from_payroll && project.payroll_exclusion_scope === 'SELECTED'
            ? (project.payroll_excluded_employee_ids ?? [])
            : [],
      });
      setProjects((current) =>
        current.map((item) =>
          item.id === updatedProject.id ? { ...item, ...updatedProject } : item,
        ),
      );
      toast.success('Проект возвращен из архива.');
      await Promise.all([
        fetchProjects(),
        fetchTableProjects(),
        selectedProjectId === project.id
          ? fetchProjectDetails(project.id)
          : Promise.resolve(),
      ]);
      if (selectedProjectId === project.id) {
        setProjectFinanceRefreshKey((current) => current + 1);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsUpdatingProject(false);
    }
  };

  const pinProject = async (project: Project) => {
    const now = Date.now();
    setProjects((prev) =>
      prev.map((p) =>
        p.id === project.id ? { ...p, is_pinned: true, pinned_at: now } : p,
      ),
    );
    if (selectedProjectStats?.project?.id === project.id) {
      setSelectedProjectStats((prev) =>
        prev
          ? { ...prev, project: { ...prev.project!, is_pinned: true, pinned_at: now } }
          : prev,
      );
    }

    try {
      setIsUpdatingProject(true);
      await api.workspace.projects.pin(project.id);
      toast.success('Проект закреплен.');
      fetchProjects();
      fetchTableProjects();
      if (selectedProjectId === project.id) fetchProjectDetails(project.id);
    } catch (err) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id ? { ...p, is_pinned: false, pinned_at: undefined } : p,
        ),
      );
      if (selectedProjectStats?.project?.id === project.id) {
        setSelectedProjectStats((prev) =>
          prev
            ? {
                ...prev,
                project: { ...prev.project!, is_pinned: false, pinned_at: undefined },
              }
            : prev,
        );
      }
      handleError(err);
    } finally {
      setIsUpdatingProject(false);
    }
  };

  const unpinProject = async (project: Project) => {
    const prevPinnedAt = project.pinned_at;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === project.id ? { ...p, is_pinned: false, pinned_at: undefined } : p,
      ),
    );
    if (selectedProjectStats?.project?.id === project.id) {
      setSelectedProjectStats((prev) =>
        prev
          ? {
              ...prev,
              project: { ...prev.project!, is_pinned: false, pinned_at: undefined },
            }
          : prev,
      );
    }

    try {
      setIsUpdatingProject(true);
      await api.workspace.projects.unpin(project.id);
      toast.success('Проект откреплен.');
      fetchProjects();
      fetchTableProjects();
      if (selectedProjectId === project.id) fetchProjectDetails(project.id);
    } catch (err) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id ? { ...p, is_pinned: true, pinned_at: prevPinnedAt } : p,
        ),
      );
      if (selectedProjectStats?.project?.id === project.id) {
        setSelectedProjectStats((prev) =>
          prev
            ? {
                ...prev,
                project: { ...prev.project!, is_pinned: true, pinned_at: prevPinnedAt },
              }
            : prev,
        );
      }
      handleError(err);
    } finally {
      setIsUpdatingProject(false);
    }
  };

  const togglePinProject = (project: Project) => {
    const extProject = project as Project & { is_pinned?: boolean; isPinned?: boolean };
    if (extProject.isPinned ?? extProject.is_pinned) {
      unpinProject(project);
    } else {
      pinProject(project);
    }
  };

  const moveProjectInLeftPanel = useCallback(
    async (projectId: string, targetProjectId: string) => {
      const previousOrder = projectListOrderIds;
      const sourceIndex = previousOrder.indexOf(projectId);
      const targetIndex = previousOrder.indexOf(targetProjectId);

      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return;
      }

      const nextOrder = [...previousOrder];
      const [moved] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, moved);

      setProjectListOrderIds(nextOrder);

      try {
        await api.workspace.projects.reorderSidebar(nextOrder);
      } catch (err) {
        setProjectListOrderIds(previousOrder);
        handleError(err);
      }
    },
    [handleError, projectListOrderIds],
  );

  const onAssignEmployeeToProject = async () => {
    if (!canManageProjectMembers) return;
    if (!selectedProject || !assignProjectEmployeeId) return;
    try {
      setIsAssigningEmployeeToProject(true);
      await api.workspace.projects.assignEmployee(
        selectedProject.id,
        assignProjectEmployeeId,
      );
      setAssignProjectEmployeeId('');
      toast.success('Сотрудник назначен на проект.');
      fetchProjects();
      fetchTableProjects();
      fetchProjectDetails(selectedProject.id);
    } catch (err) {
      handleError(err);
    } finally {
      setIsAssigningEmployeeToProject(false);
    }
  };

  const onSaveTags = async (tagNames: string[]) => {
    if (!canEditProject) return;
    if (!selectedProject) return;

    try {
      setIsSavingTags(true);
      await api.workspace.tags.syncForProject(selectedProject.id, tagNames);
      toast.success('Теги обновлены.');
      fetchProjects();
      fetchTableProjects();
      fetchProjectDetails(selectedProject.id);
      fetchTags();
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsSavingTags(false);
    }
  };

  const onSaveRate = async (form: ProjectRateForm) => {
    if (!canEditProject) return;
    if (!selectedProject) return;

    try {
      setIsSavingRate(true);
      await api.workspace.projectRates.createForProject(selectedProject.id, {
        rate: form.rate,
        currency: form.currency,
        vat: form.vat,
        effective_from: form.startDate,
      });
      toast.success('Ставка проекта обновлена.');
      fetchProjects();
      fetchTableProjects();
      fetchProjectDetails(selectedProject.id);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsSavingRate(false);
    }
  };

  const saveTeamForProject = async (
    project: Project,
    memberIds: string[],
    managerIds: string[],
    pmPayrollSelection: Record<string, boolean>,
    managerPaymentMethod: string,
  ) => {
    if (!canManageProjectMembers) return;

    try {
      setIsSavingTeam(true);
      const nextMemberIds = Array.from(new Set([...memberIds, ...managerIds]));
      const currentIds = new Set(
        (project.members ?? []).map((member: ProjectMember) => member.user.id),
      );
      const nextIds = new Set(nextMemberIds);

      const toRemove = Array.from(currentIds).filter((id) => !nextIds.has(id));
      const managerIdSet = new Set(managerIds);

      await Promise.all([
        ...(canEditProject
          ? [
              api.workspace.projects.update(project.id, {
                projectId: project.id,
                name: project.name || '',
                description: project.description || '',
                status: isProjectArchived(project.status) ? 'ARCHIVED' : 'ACTIVE',
                client_id: project.client_id ?? '',
                manager_payment_method: managerPaymentMethod,
                is_internal: Boolean(project.is_internal),
                exclude_from_payroll: Boolean(project.exclude_from_payroll),
                payroll_exclusion_scope:
                  project.payroll_exclusion_scope === 'SELECTED' ? 'SELECTED' : 'ALL',
                payroll_excluded_employee_ids:
                  project.exclude_from_payroll &&
                  project.payroll_exclusion_scope === 'SELECTED'
                    ? (project.payroll_excluded_employee_ids ?? [])
                    : [],
              }),
            ]
          : []),
        ...nextMemberIds.map((id) =>
          api.workspace.projects.assignEmployee(
            project.id,
            id,
            managerIdSet.has(id),
            managerIdSet.has(id) && Boolean(pmPayrollSelection[id]),
          ),
        ),
        ...toRemove.map((id) => api.workspace.projects.removeEmployee(project.id, id)),
      ]);

      setProjectManagerIdsByProject((prev) => ({
        ...prev,
        [project.id]: managerIds,
      }));

      toast.success('Команда проекта обновлена.');
      fetchProjects();
      fetchTableProjects();
      if (selectedProject?.id === project.id) {
        fetchProjectDetails(project.id);
      }
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsSavingTeam(false);
    }
  };

  const onSaveTeam = async (
    memberIds: string[],
    managerIds: string[],
    pmPayrollSelection: Record<string, boolean>,
    managerPaymentMethod: string,
  ) => {
    if (!selectedProject) return;
    await saveTeamForProject(
      selectedProject,
      memberIds,
      managerIds,
      pmPayrollSelection,
      managerPaymentMethod,
    );
  };

  const onRemoveEmployeeFromProject = async (userId: string) => {
    if (!canManageProjectMembers) return;
    if (!selectedProject) return;
    try {
      setRemovingEmployeeIds((prev) => new Set(prev).add(userId));
      await api.workspace.projects.removeEmployee(selectedProject.id, userId);
      toast.success('Сотрудник снят с проекта.');
      fetchProjects();
      fetchTableProjects();
      fetchProjectDetails(selectedProject.id);
    } catch (err) {
      handleError(err);
    } finally {
      setRemovingEmployeeIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const onLoadImportFile = async (ext: string, file: File) => {
    if (ext === 'xlsx' || ext === 'xls') {
      const res = await parseXLSX(file);
      return res;
    }

    if (ext === 'csv') {
      const res = await parseCSV(file);
      return res;
    }
    return '';
  };

  const importProject = async (projectsData: unknown[]) => {
    try {
      setIsProjectImporting(true);

      if (!Array.isArray(projectsData) || projectsData.length === 0) {
        toast.error('Нет данных для импорта.');
        return;
      }

      console.log('Начинаем импорт:', projectsData);

      setIsAddingProject(true);
      let successCount = 0;
      let errorCount = 0;

      for (const rawData of projectsData) {
        try {
          if (typeof rawData !== 'object' || rawData === null) {
            errorCount++;
            continue;
          }

          const data = rawData as Record<string, unknown>;

          // Логируем ключи для отладки
          console.log('Ключи в строке:', Object.keys(data));

          const name = String(data['Название'] || '').trim();

          if (!name) {
            continue;
          }

          const descriptionKey = Object.keys(data).find(
            (key) =>
              key.toLowerCase().includes('описание') ||
              key.toLowerCase().includes('description'),
          );
          const description = String(data[descriptionKey || 'Описание'] || '').trim();

          const statusKey = Object.keys(data).find(
            (key) =>
              key.toLowerCase().includes('статус') ||
              key.toLowerCase().includes('status'),
          );
          const statusRaw = String(data[statusKey || 'Статус'] || '').trim();

          const statusMap: Record<string, string> = {
            активный: 'ACTIVE',
            архив: 'ARCHIVED',
            пауза: 'PAUSED',
          };
          const status = statusMap[statusRaw.toLowerCase()] || 'ACTIVE';

          // поиск клиента по названию
          const clientKey = Object.keys(data).find(
            (key) =>
              key.toLowerCase().includes('клиент') ||
              key.toLowerCase().includes('client'),
          );
          let clientId = '';
          const clientName = String(data[clientKey || 'Клиент'] || '').trim();
          if (clientName) {
            const matchedClient = clients.find(
              (c) => c.name.toLowerCase() === clientName.toLowerCase(),
            );
            clientId = matchedClient?.id || '';
          }

          const projectForm: ProjectForm = {
            name,
            description,
            status,
            client_id: clientId,
            template: '',
            rate: '',
            rate_currency: 'RUB',
            rate_vat: '',
            is_internal: false,
            exclude_from_payroll: false,
            payroll_exclusion_scope: 'ALL',
            payroll_excluded_employee_ids: [],
          };

          await api.workspace.projects.create(projectForm);
          successCount++;
        } catch (err) {
          errorCount++;
          console.error('Ошибка при создании проекта:', err);
        }
      }

      if (successCount > 0) {
        toast.success(`Импортировано проектов: ${successCount}`);
        fetchProjects();
        fetchTableProjects();
        setIsImportModalOpen(false);
      }

      if (errorCount > 0) {
        toast.error(`Ошибок при импорте: ${errorCount}`);
      }

      if (successCount === 0 && errorCount > 0) {
        return;
      }
    } catch (error) {
      console.error('Ошибка при импорте проектов', error);
      toast.error('Ошибка при импорте проектов');
    } finally {
      setIsProjectImporting(false);
      setIsAddingProject(false);
    }
  };

  if (!canOpenProjectsPage) {
    return <div>У вас недостаточно прав для доступа к разделу проектов.</div>;
  }

  if (!canViewProjects) {
    return (
      <div className='grid h-full place-items-center rounded-xl border border-[#e3e9f3] bg-white p-6 text-center text-sm font-semibold text-[#7e8fb4]'>
        У вас недостаточно прав для просмотра проектов.
      </div>
    );
  }

  const closeMobileContent = () => {
    setIsMobileContentOpen(false);
    setProjectDetailsInitialTab(undefined);
    setIsAllTasksActive(false);
    setSelectedProjectId('');
    updateProjectsUrl('');
  };

  return (
    <>
      <div className='grid h-full min-h-0 gap-2 lg:grid-cols-[260px_minmax(0,1fr)]'>
        <div className={`min-h-0 ${isMobileContentOpen ? 'hidden lg:block' : ''}`}>
          <ProjectsListPanel
            isLoading={isLoadingProjects}
            projects={panelProjects}
            projectOrderIds={projectListOrderIds}
            searchQuery={listSearchQuery}
            statusFilter={listStatusFilter}
            selectedProjectId={selectedProjectId}
            activeCount={projectCounts.active}
            archivedCount={projectCounts.archived}
            trackingProjectIds={socketData.trackingProjectIds}
            onSearchQueryChange={setListSearchQuery}
            onStatusFilterChange={setListStatusFilter}
            onSelectProject={(projectId) => {
              setIsMobileContentOpen(true);
              setProjectDetailsInitialTab(undefined);
              setIsAllTasksActive(false);
              setSelectedProjectId(projectId);
              updateProjectsUrl(projectId);
            }}
            onOpenCreateModal={() => openCreateProjectModal()}
            onTogglePinProject={togglePinProject}
            onMoveProject={moveProjectInLeftPanel}
            onArchiveProject={archiveProject}
            onRestoreProject={restoreProject}
            onOpenTemplates={() => navigate('/projects/templates')}
            canManageProject={canEditProject}
            isAllProjectsActive={!selectedProjectId && !isAllTasksActive}
            onShowAllProjects={() => {
              setIsMobileContentOpen(true);
              setProjectDetailsInitialTab(undefined);
              setIsAllTasksActive(false);
              setSelectedProjectId('');
              updateProjectsUrl('');
            }}
            isAllTasksActive={isAllTasksActive}
            onShowAllTasks={() => {
              setIsMobileContentOpen(true);
              setProjectDetailsInitialTab(undefined);
              setSelectedProjectId('');
              setIsAllTasksActive(true);
              updateProjectsUrl('');
            }}
          />
        </div>

        <div
          className={`${isMobileContentOpen ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col gap-2 lg:flex`}
        >
          <button
            type='button'
            onClick={closeMobileContent}
            className='flex min-h-11 shrink-0 items-center rounded-xl border border-[#e3e9f3] bg-white px-3 text-left text-sm font-semibold text-[#1f3565] lg:hidden'
          >
            ← К списку проектов
          </button>

          <div className='min-h-0 min-w-0 flex-1'>
            {isAllTasksActive ? (
              <AllTasksTablePanel
                onOpenTask={(task) => {
                  if (!task.project?.id) return;
                  setIsMobileContentOpen(true);
                  setProjectDetailsInitialTab(undefined);
                  setIsAllTasksActive(false);
                  setSelectedProjectId(task.project.id);
                  updateProjectsUrl(task.project.id, task.id);
                }}
              />
            ) : selectedProject ? (
              <ProjectDetailsPanel
                key={`${selectedProject.id}:${requestedNoteId ? 'notes' : (projectDetailsInitialTab ?? 'default')}`}
                selectedProject={selectedProject}
                clients={clients}
                projectDetailsForm={projectDetailsForm}
                externalFinanceRefreshKey={projectFinanceRefreshKey}
                selectedProjectStats={selectedProjectStats}
                unassignedEmployeesForSelectedProject={
                  unassignedEmployeesForSelectedProject
                }
                allActiveEmployees={activeEmployees}
                projectManagerIds={
                  projectManagerIdsByProject[selectedProject.id] ??
                  (selectedProject.members ?? [])
                    .filter((member) => member.is_pm)
                    .map((member) => member.user.id)
                }
                assignProjectEmployeeId={assignProjectEmployeeId}
                isUpdating={isUpdatingProject}
                isSavingTeam={isSavingTeam}
                isSavingRate={isSavingRate}
                isSavingTags={isSavingTags}
                availableTags={availableTags}
                requestedTaskId={requestedTaskId}
                requestedNoteId={requestedNoteId}
                initialTab={requestedNoteId ? 'notes' : projectDetailsInitialTab}
                onSelectedTaskIdChange={(taskId) =>
                  updateProjectsUrl(selectedProject.id, taskId)
                }
                removingEmployeeIds={removingEmployeeIds}
                isAssigningEmployeeToProject={isAssigningEmployeeToProject}
                isStatsLoading={isStatsLoading}
                canEditProject={canEditProject}
                canManageProjectMembers={canManageProjectMembers}
                canViewTasksTab={canViewProjectTasksTab}
                canViewNotesTab={canViewProjectNotesTab}
                canViewDocumentsTab={canViewProjectDocumentsTab}
                canViewReportsTab={canViewProjectReportsTab}
                canViewFinanceTab={canViewProjectFinanceTab}
                canManageFinance={canManageFinance}
                canViewFinanceArticles={canViewFinanceArticles}
                canViewAboutTab={canViewProjectAboutTab}
                canCreateUpdateProjectNotes={canCreateUpdateProjectNotes}
                canDeleteProjectNotes={canDeleteProjectNotes}
                canCreateUpdateProjectDocuments={canCreateUpdateProjectDocuments}
                canDeleteProjectDocuments={canDeleteProjectDocuments}
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
                onProjectFormChange={setSelectedProjectForm}
                onCreateClient={openClientCreateModal}
                onAssignProjectEmployeeIdChange={setAssignProjectEmployeeId}
                onUpdateProject={onUpdateProject}
                onUpdateProjectCreator={onUpdateProjectCreator}
                onActivityHistoryChanged={() => fetchProjectDetails(selectedProject.id)}
                onAssignEmployeeToProject={onAssignEmployeeToProject}
                onRemoveEmployeeFromProject={onRemoveEmployeeFromProject}
                onSaveTeam={onSaveTeam}
                onSaveRate={onSaveRate}
                onSaveTags={onSaveTags}
                onTogglePinProject={togglePinProject}
                onClose={() => {
                  setIsMobileContentOpen(false);
                  setProjectDetailsInitialTab(undefined);
                  setSelectedProjectId('');
                  updateProjectsUrl('');
                }}
              />
            ) : (
              <ProjectsTablePanel
                projects={tableProjects}
                searchQuery={tableSearchQuery}
                statusFilter={tableStatusFilter}
                isLoading={isLoadingTableProjects}
                activeCount={projectCounts.active}
                archivedCount={projectCounts.archived}
                sortKey={tableSortKey}
                sortDirection={tableSortDirection}
                currentPage={tablePage}
                totalPages={tableTotalPages}
                pageSize={tablePageSize}
                showPagination={hasTablePaginationMeta}
                onSearchQueryChange={(value) => {
                  resetTablePage();
                  setTableSearchQuery(value);
                }}
                onStatusFilterChange={(value) => {
                  resetTablePage();
                  setTableStatusFilter(value);
                }}
                onSortChange={(key) => {
                  resetTablePage();
                  if (tableSortKey === key) {
                    setTableSortDirection((current) =>
                      current === 'asc' ? 'desc' : 'asc',
                    );
                  } else {
                    setTableSortKey(key);
                    setTableSortDirection('asc');
                  }
                }}
                onPageChange={setTablePage}
                onPageSizeChange={onTablePageSizeChange}
                onOpenCreateModal={() => openCreateProjectModal()}
                onOpenProject={(project) => {
                  setIsMobileContentOpen(true);
                  setProjectDetailsInitialTab(undefined);
                  setSelectedProjectId(project.id);
                  updateProjectsUrl(project.id);
                }}
                onEditProject={(project) => {
                  setIsMobileContentOpen(true);
                  setProjectDetailsInitialTab('about');
                  setSelectedProjectId(project.id);
                  updateProjectsUrl(project.id);
                }}
                onArchiveProject={archiveProject}
                onRestoreProject={restoreProject}
                onDeleteProject={setDeleteProjectTarget}
                onImportProjects={() => setIsImportModalOpen(true)}
                onExportProjects={() => setIsExportModalOpen(true)}
                onTogglePinProject={togglePinProject}
                onEditTeam={(project) => setEditingTeamProjectId(project.id)}
                canManageProject={canEditProject}
                canArchiveProject={canArchiveProject}
                canManageProjectMembers={canManageProjectMembers}
              />
            )}
          </div>
        </div>
      </div>

      {canEditProject && (
        <ProjectModal
          isOpen={isProjectModalOpen}
          isAdding={isAddingProject}
          form={projectForm}
          templates={templates}
          clients={clients}
          employees={activeEmployees}
          onChange={setProjectForm}
          onClose={() => {
            setIsProjectModalOpen(false);
            if (requestedTemplateId || requestedClientId) {
              navigate(location.pathname, { replace: true });
            }
          }}
          onSubmit={onCreateProject}
          showRate={!isProjectEconomicsLocked}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteProjectTarget)}
        isProcessing={isDeletingProject}
        title='Удалить проект?'
        message={
          deleteProjectTarget ? (
            <div className='space-y-3'>
              <p>
                {(deleteProjectTarget.total_seconds ?? 0) > 0 ? (
                  <>
                    Проект "<strong>{deleteProjectTarget.name}</strong>" не может быть
                    удален.
                    <br />В проекте есть время:{' '}
                    <strong>
                      {formatDurationHms(deleteProjectTarget.total_seconds ?? 0)}
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    Проект "<strong>{deleteProjectTarget.name}</strong>" будет удален
                    безвозвратно.
                  </>
                )}
              </p>
              <p>Удалять можно только проекты из архива без отработанного времени.</p>
            </div>
          ) : (
            ''
          )
        }
        confirmLabel='Удалить'
        confirmDisabled={(deleteProjectTarget?.total_seconds ?? 0) > 0}
        onClose={() => {
          setDeleteProjectTarget(null);
        }}
        onConfirm={deleteProject}
      />

      <ExportDataModal
        isOpen={isExportModalOpen}
        title='Экспорт проектов'
        isExportDisabled={projects.length === 0}
        onClose={() => setIsExportModalOpen(false)}
        onExportXlsx={exportProjectsXlsx}
        onExportCsv={exportProjectsCsv}
      />

      <ImportDataModal
        isOpen={isImportModalOpen}
        title='Импорт проектов'
        importType='PROJECTS'
        isImportDisabled={projects.length === 0}
        acceptedFormats={['.xlsx', '.xls', '.csv']}
        tplFileName='projects_import_tpl.xlsx'
        isLoading={isProjectImporting}
        onClose={() => setIsImportModalOpen(false)}
        onImport={importProject}
        onLoadFile={onLoadImportFile}
      />

      {canEditProject && isClientModalOpen && (
        <ClientModal
          title='Новый клиент'
          submitLabel='Добавить клиента'
          isSaving={isAddingClient}
          form={clientForm}
          errors={clientErrors}
          onChange={setClientForm}
          onClose={() => {
            setIsClientModalOpen(false);
            setClientForm(emptyClientForm);
            setClientErrors({});
          }}
          onSubmit={onCreateClient}
        />
      )}

      {canManageProjectMembers && editingTeamProject && (
        <ProjectTeamModal
          isOpen={Boolean(editingTeamProject)}
          isSaving={isSavingTeam}
          members={editingTeamProject.members ?? []}
          managerIds={editingTeamProjectManagerIds}
          managerPaymentMethod={editingTeamProject.manager_payment_method ?? 'ACCRUE_ALL'}
          allActiveEmployees={activeEmployees}
          canEditManagerPaymentMethod={canEditProject}
          onClose={() => {
            if (isSavingTeam) return;
            setEditingTeamProjectId('');
          }}
          onDetails={() => {
            const projectId = editingTeamProject.id;
            setEditingTeamProjectId('');
            setIsMobileContentOpen(true);
            setIsAllTasksActive(false);
            setProjectDetailsInitialTab('team');
            setSelectedProjectId(projectId);
            updateProjectsUrl(projectId);
          }}
          onSave={async (
            memberIds,
            managerIds,
            pmPayrollSelection,
            managerPaymentMethod,
          ) => {
            try {
              await saveTeamForProject(
                editingTeamProject,
                memberIds,
                managerIds,
                pmPayrollSelection,
                managerPaymentMethod,
              );
              setEditingTeamProjectId('');
            } catch {
              // ошибка показана в saveTeamForProject — модалка остаётся открытой
            }
          }}
        />
      )}
    </>
  );
}
