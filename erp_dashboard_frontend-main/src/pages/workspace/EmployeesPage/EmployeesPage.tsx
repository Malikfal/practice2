import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../api/api';
import EmployeeDetailsPanel from '../../../components/page-elements/workspace/employees/EmployeeDetailsPanel';
import EmployeesListPanel from '../../../components/page-elements/workspace/employees/EmployeesListPanel';
import EmployeesTablePanel from '../../../components/page-elements/workspace/employees/EmployeesTablePanel';
import type { EmployeeSortKey } from '../../../components/page-elements/workspace/employees/EmployeesTablePanel/EmployeesTablePanel';
import EmployeeModal from '../../../components/modals/EmployeeModal';
import ExportDataModal from '../../../components/modals/ExportDataModal';
import Button from '../../../components/ui/Button';
import { useServerPagination } from '../../../components/ui/Pagination';
import { useAppControllerContext } from '../../../context/AppControllerContext';
import { createInitialEmployeeForm } from '../../../hooks/formFactories';
import {
  formatName,
  formatDateLocal,
  formatDurationHms,
  formatHoursCompact,
  formatTimeLocal,
  parseHoursInput,
  isEmployeeBlocked,
  isProjectArchived,
  isValidPhone,
  formatPhoneForApi,
  formatBirthdayForApi,
} from '../../../utils/formatters';
import {
  downloadCsv,
  downloadExportXlsx,
  type ExportTableData,
} from '../../../utils/exportFiles';
import {
  arePayloadsEqual,
  fieldsToPayload,
  payloadToFields,
} from '../../../utils/employeePayloadFields';
import type { EmployeeTab } from '../../../components/page-elements/workspace/employees/EmployeeDetailsPanel/types';
import type {
  EmployeeCreateForm,
  EmployeeProfileForm,
  EmployeeStatus,
  EmployeeUpdatePayload,
  Project,
  ProjectMember,
  RoleOption,
  User,
} from '../../../types/app';

import DialogShell from './components/DialogShell';
import ImportDataModal from '../../../components/modals/ImportDataModal';
import { parseCSV, parseXLSX } from '../../../utils/importFiles';

function generateEmployeePasswordValue() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';

  return Array.from(
    { length: 12 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}

function createEmptyEmployeeProfileForm(): EmployeeProfileForm {
  return {
    employeeId: '',
    first_name: '',
    last_name: '',
    role: '',
    role_id: '',
    position: '',
    birthday: '',
    phone: '',
    socials: {
      additional_email: '',
      additional_phone: '',
      max_url: '',
      vk_url: '',
      telegram_url: '',
    },
    skills: '',
    payload_fields: [],
    status: 'ACTIVE',
    archived_at: '',
    weekly_plan_hours: '',
  };
}

function createEmployeeProfileForm(
  employee: User,
  roleOptions: RoleOption[],
): EmployeeProfileForm {
  const selectedRoleOption = roleOptions.find(
    (option) => option.role_value === employee.role || option.value === employee.role,
  );

  return {
    employeeId: employee.id,
    first_name: employee.first_name || '',
    last_name: employee.last_name || '',
    role: selectedRoleOption?.role_id || selectedRoleOption?.value || employee.role || '',
    role_id: selectedRoleOption?.role_id || '',
    position: employee.position || '',
    birthday: employee.birthday || '',
    phone: employee.phone || '',
    socials: {
      additional_email: employee.socials?.additional_email || '',
      additional_phone: employee.socials?.additional_phone || '',
      max_url: employee.socials?.max_url || '',
      vk_url: employee.socials?.vk_url || '',
      telegram_url: employee.socials?.telegram_url || '',
    },
    skills: employee.skills || '',
    payload_fields: payloadToFields(employee.payload),
    status: isEmployeeBlocked(employee.status) ? 'BLOCKED' : 'ACTIVE',
    archived_at: employee.archived_at || '',
    weekly_plan_hours: formatHoursCompact(employee.weekly_plan_seconds),
  };
}

function employeeStatusUpdatePayload(
  employee: User,
  status: EmployeeStatus,
  archivedAt?: string | null,
): EmployeeUpdatePayload {
  return {
    first_name: employee.first_name || '',
    last_name: employee.last_name || '',
    role: employee.role || '',
    position: employee.position || null,
    birthday: employee.birthday || null,
    phone: employee.phone || null,
    socials: employee.socials ?? {},
    skills: employee.skills || null,
    payload: employee.payload,
    status,
    ...(status === 'ACTIVE'
      ? { archived_at: null }
      : archivedAt
        ? { archived_at: archivedAt }
        : {}),
  };
}

const MAX_WEEKLY_PLAN_HOURS = 168;

function buildSocialsPayload(socials: EmployeeProfileForm['socials']) {
  return Object.fromEntries(
    Object.entries(socials)
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : ''])
      .filter(([, value]) => value),
  ) as EmployeeCreateForm['socials'];
}

function formatEmployeeDateTime(value: string | number | null | undefined) {
  if (!value) return 'Не указано';

  const date = new Date(typeof value === 'number' ? value * 1000 : String(value));
  if (Number.isNaN(date.getTime())) return 'Не указано';

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) return `Сегодня в ${formatTimeLocal(date)}`;
  return `${formatDateLocal(date)} в ${formatTimeLocal(date)}`;
}

function getEmployeeLastName(employee: User) {
  const parts = formatName(employee).split(' ');
  return employee.last_name || parts[1] || parts[0] || '';
}

function getEmployeeFirstName(employee: User) {
  const parts = formatName(employee).split(' ');
  return employee.first_name || parts[0] || '';
}

function getEmployeeProjectStats(employee: User, projects: Project[]) {
  const employeeProjects = projects.filter((project) =>
    project.members.some((member: ProjectMember) => member.user.id === employee.id),
  );
  const activeProjects = employeeProjects.filter(
    (project) => !isProjectArchived(project.status),
  );

  return {
    total: employeeProjects.length,
    active: activeProjects.length,
  };
}

function employeeHasTrackedTime(employee: User) {
  return (employee.total_seconds ?? 0) > 0;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function EmployeesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { socketData, user } = useAppControllerContext();
  const userPermissions = user?.permissions ?? [];
  const canViewEmployees = userPermissions.includes('employees.view_list');
  const canCreateUpdateEmployee = userPermissions.includes('employees.create_update');
  const canDeleteEmployee = userPermissions.includes('employees.delete');
  const canResetEmployeePassword = userPermissions.includes('employees.password.reset');
  const canViewEmployeeDay = userPermissions.includes('employees.tabs.day.view');
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isUpdatingEmployee, setIsUpdatingEmployee] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isArchivingEmployee, setIsArchivingEmployee] = useState(false);
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);
  const [isResettingEmployeePassword, setIsResettingEmployeePassword] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportingEmployees, setIsImportingEmployees] = useState<boolean>(false);
  const [employees, setEmployees] = useState<User[]>([]);
  const [employeeCountSource, setEmployeeCountSource] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listStatusFilter, setListStatusFilter] = useState('ACTIVE');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState('ACTIVE');
  const [tariffLimits, setTariffLimits] = useState<{
    maxEmployees: number | null;
    totalEmployees: number;
  }>({ maxEmployees: null, totalEmployees: 0 });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployeeInitialTab, setSelectedEmployeeInitialTab] =
    useState<EmployeeTab>('Общие данные');
  const [selectedEmployeeProfileForm, setSelectedEmployeeProfileForm] =
    useState<EmployeeProfileForm>(createEmptyEmployeeProfileForm);
  const [employeeForm, setEmployeeForm] = useState<EmployeeCreateForm>(
    createInitialEmployeeForm,
  );
  const [archiveCandidate, setArchiveCandidate] = useState<User | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<User | null>(null);
  const [resetPasswordCandidate, setResetPasswordCandidate] = useState<User | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{
    employee: User;
    password: string;
  } | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [tableSortKey, setTableSortKey] = useState<EmployeeSortKey>('last_name');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');
  const {
    currentPage,
    pageSize,
    totalPages,
    setCurrentPage,
    resetPage,
    onPageSizeChange,
    applyMeta,
  } = useServerPagination(10);
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const requestedUserId = queryParams.get('user_id') ?? '';
  // Ссылка из уведомления об изменении времени: ?user_id=…&tab=day&date=YYYY-MM-DD.
  const requestedDayDate =
    queryParams.get('tab') === 'day' ? (queryParams.get('date') ?? '') : '';

  useEffect(() => {
    if (!requestedUserId) return;
    if (tableStatusFilter === 'ALL') return;

    setTableStatusFilter('ALL');
    resetPage();
  }, [requestedUserId, resetPage, tableStatusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(tableSearchQuery.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [tableSearchQuery]);

  const activeSelectedEmployeeId = useMemo(() => {
    if (!selectedEmployeeId) return '';
    const existsInCurrentPage = employees.some(
      (employee) => employee.id === selectedEmployeeId,
    );
    const existsInFullList = employeeCountSource.some(
      (employee) => employee.id === selectedEmployeeId,
    );
    return existsInCurrentPage || existsInFullList ? selectedEmployeeId : '';
  }, [employees, employeeCountSource, selectedEmployeeId]);

  // Повторный переход по ссылке на «День сотрудника» (список уже загружен) открывает карточку сам.
  const [handledLinkKey, setHandledLinkKey] = useState(location.key);
  if (handledLinkKey !== location.key) {
    setHandledLinkKey(location.key);
    if (requestedDayDate !== '') setSelectedEmployeeId(requestedUserId);
  }

  const isRequestedDayOpen =
    requestedDayDate !== '' && activeSelectedEmployeeId === requestedUserId;

  const selectedEmployee = useMemo(
    () =>
      employees.find((employee) => employee.id === activeSelectedEmployeeId) ??
      employeeCountSource.find((employee) => employee.id === activeSelectedEmployeeId) ??
      null,
    [activeSelectedEmployeeId, employees, employeeCountSource],
  );

  const positionSuggestions = useMemo(() => {
    const positions = new Set<string>();
    for (const source of [employeeCountSource, employees]) {
      for (const employee of source) {
        const value = employee.position?.trim();
        if (value) positions.add(value);
      }
    }
    return [...positions].sort((left, right) => left.localeCompare(right, 'ru'));
  }, [employeeCountSource, employees]);

  const employeeCounts = useMemo(() => {
    const active = employeeCountSource.filter(
      (employee) => !isEmployeeBlocked(employee.status),
    ).length;

    return {
      active,
      archived: employeeCountSource.length - active,
    };
  }, [employeeCountSource]);

  const panelEmployees = useMemo(() => {
    const query = listSearchQuery.trim().toLowerCase();
    return employeeCountSource.filter((employee) => {
      const blocked = isEmployeeBlocked(employee.status);
      if (listStatusFilter === 'ACTIVE' && blocked) return false;
      if (listStatusFilter === 'BLOCKED' && !blocked) return false;

      if (!query) return true;
      const haystack = [
        employee.first_name,
        employee.last_name,
        employee.name,
        employee.email,
        employee.position,
        employee.role,
        employee.role_label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [employeeCountSource, listStatusFilter, listSearchQuery]);

  const employeeExportData = useMemo<ExportTableData>(
    () => ({
      headers: [
        'Фамилия',
        'Имя',
        'Email',
        'Роль',
        'Должность',
        'Дата добавления',
        'Дата последней активности',
        'Проектов/активных',
        'Время за неделю',
        'Недельный план, ч',
        'Статус',
      ],
      rows: employees.map((employee) => {
        const stats = getEmployeeProjectStats(employee, projects);

        return [
          getEmployeeLastName(employee),
          getEmployeeFirstName(employee),
          employee.email || '',
          employee.role_label || employee.role || '',
          employee.position || 'Не указано',
          formatEmployeeDateTime(employee.created_at),
          formatEmployeeDateTime(employee.last_date_activity),
          `${stats.total}/${stats.active}`,
          employee.total_seconds_for_week == null
            ? ''
            : formatDurationHms(employee.total_seconds_for_week),
          // Числом, чтобы план можно было посчитать в таблице.
          employee.weekly_plan_seconds == null
            ? ''
            : Math.round(employee.weekly_plan_seconds / 36) / 100,
          isEmployeeBlocked(employee.status) ? 'Архив' : 'Активный',
        ];
      }),
      fileName: 'employees',
      sheetName: 'Сотрудники',
    }),
    [employees, projects],
  );

  const profileForm = useMemo(() => {
    if (!selectedEmployee) {
      return createEmptyEmployeeProfileForm();
    }

    if (selectedEmployeeProfileForm.employeeId === selectedEmployee.id) {
      return selectedEmployeeProfileForm;
    }

    return createEmployeeProfileForm(selectedEmployee, roleOptions);
  }, [roleOptions, selectedEmployee, selectedEmployeeProfileForm]);

  const resolveRoleValueByOptionId = useCallback(
    (roleOptionId: string): string => {
      const roleOption = roleOptions.find((option) => option.role_id === roleOptionId);
      return roleOption?.role_value || roleOption?.value || roleOptionId;
    },
    [roleOptions],
  );

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  /* const showImportStub = () => {
    toast.message('Импорт пока недоступен.');
  }; */

  const exportEmployeesXlsx = async () => {
    await downloadExportXlsx(employeeExportData);
    setIsExportModalOpen(false);
    toast.success('XLSX сохранен.');
  };

  const exportEmployeesCsv = () => {
    downloadCsv(employeeExportData);
    setIsExportModalOpen(false);
    toast.success('CSV сохранен.');
  };

  const fetchEmployees = useCallback(async () => {
    try {
      setIsLoadingEmployees(true);
      const statusParam =
        tableStatusFilter === 'BLOCKED'
          ? 'blocked'
          : tableStatusFilter === 'ALL'
            ? 'all'
            : 'active';

      const response = await api.workspace.employees.getMany({
        status: statusParam,
        search: debouncedSearchQuery,
        page: requestedUserId ? 1 : currentPage,
        per_page: requestedUserId ? 1000 : pageSize,
        sort_by: tableSortKey,
        sort_direction: tableSortDirection,
      });

      const employeeList = Array.isArray(response.data) ? response.data : [];

      setEmployees(employeeList);
      applyMeta(response.meta);

      setTariffLimits({
        maxEmployees: response.meta?.max_employees ?? null,
        totalEmployees: response.meta?.total_company_employees ?? 0,
      });
      setSelectedEmployeeId((prev) => {
        if (
          requestedUserId &&
          employeeList.some((employee) => employee.id === requestedUserId)
        ) {
          return requestedUserId;
        }
        return prev;
      });
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingEmployees(false);
    }
  }, [
    applyMeta,
    currentPage,
    debouncedSearchQuery,
    handleError,
    pageSize,
    requestedUserId,
    tableStatusFilter,
    tableSortKey,
    tableSortDirection,
  ]);

  const fetchEmployeeCounts = useCallback(async () => {
    try {
      const response = await api.workspace.employees.getMany({
        status: 'all',
        per_page: 1000,
      });

      setEmployeeCountSource(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const fetchRoleOptions = useCallback(async () => {
    if (!canCreateUpdateEmployee) return;
    try {
      const data = await api.getRoleOptions();
      const options = Array.isArray(data) ? data : [];
      setRoleOptions(options);

      const allowedRoles = new Set(options.map((item) => item.role_id || item.value));
      setEmployeeForm((prev) => {
        if (allowedRoles.has(prev.role)) return prev;
        return { ...prev, role: options[0]?.role_id || options[0]?.value || '' };
      });
    } catch (err) {
      handleError(err);
    }
  }, [canCreateUpdateEmployee, handleError]);

  const fetchProjects = useCallback(async () => {
    try {
      const projectList = await api.workspace.projects.getMany({
        status: 'all',
      });
      setProjects(Array.isArray(projectList.data) ? projectList.data : []);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchEmployees]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployeeCounts();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchEmployeeCounts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoleOptions();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRoleOptions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProjects]);

  const onCreateEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (employeeForm.phone.trim() && !isValidPhone(employeeForm.phone)) {
      toast.error('Введите корректный номер телефона.');
      return;
    }
    if (
      employeeForm.socials.additional_phone?.trim() &&
      !isValidPhone(employeeForm.socials.additional_phone)
    ) {
      toast.error('Введите корректный дополнительный номер телефона.');
      return;
    }
    try {
      setIsAddingEmployee(true);
      await api.admin.employees.create({
        ...employeeForm,
        role_id: employeeForm.role,
        role: resolveRoleValueByOptionId(employeeForm.role),
        email: employeeForm.email.trim(),
        first_name: employeeForm.first_name.trim(),
        last_name: employeeForm.last_name.trim(),
        position: employeeForm.position.trim(),
        birthday: employeeForm.birthday.trim(),
        phone: employeeForm.phone.trim(),
        socials: buildSocialsPayload(employeeForm.socials),
        skills: employeeForm.skills.trim(),
      });
      setEmployeeForm(
        createInitialEmployeeForm(
          roleOptions.find((role) => role.role_value === 'WORKER')?.role_id ??
            roleOptions[0]?.role_id ??
            roleOptions[0]?.value ??
            'WORKER',
        ),
      );
      setIsEmployeeModalOpen(false);
      toast.success('Сотрудник добавлен.');
      fetchEmployees();
      fetchEmployeeCounts();
      fetchProjects();
    } catch (err) {
      handleError(err);
    } finally {
      setIsAddingEmployee(false);
    }
  };

  const onUpdateEmployee = async () => {
    if (!selectedEmployee) return;
    if (profileForm.phone.trim() && !isValidPhone(profileForm.phone)) {
      toast.error('Введите корректный номер телефона.');
      return;
    }
    if (
      profileForm.socials.additional_phone?.trim() &&
      !isValidPhone(profileForm.socials.additional_phone)
    ) {
      toast.error('Введите корректный дополнительный номер телефона.');
      return;
    }
    if (
      profileForm.socials.additional_email?.trim() &&
      !isValidEmail(profileForm.socials.additional_email)
    ) {
      toast.error('Введите корректную дополнительную почту.');
      return;
    }
    const payloadResult = fieldsToPayload(profileForm.payload_fields);
    if (payloadResult.hasMissingKeys) {
      toast.error('Укажите название для каждого дополнительного поля.');
      return;
    }
    const weeklyPlanSeconds = parseHoursInput(
      profileForm.weekly_plan_hours ?? '',
      MAX_WEEKLY_PLAN_HOURS,
    );
    if (weeklyPlanSeconds === undefined) {
      toast.error(
        `Недельный план: укажите число часов от 0 до ${MAX_WEEKLY_PLAN_HOURS}, например 37,5.`,
      );
      return;
    }
    try {
      setIsUpdatingEmployee(true);
      const hasChanges =
        profileForm.first_name !== (selectedEmployee.first_name || '') ||
        profileForm.last_name !== (selectedEmployee.last_name || '') ||
        resolveRoleValueByOptionId(profileForm.role) !== selectedEmployee.role ||
        profileForm.position !== (selectedEmployee.position || '') ||
        profileForm.birthday !== (selectedEmployee.birthday || '') ||
        profileForm.phone !== (selectedEmployee.phone || '') ||
        profileForm.socials.additional_email !==
          (selectedEmployee.socials?.additional_email || '') ||
        profileForm.socials.additional_phone !==
          (selectedEmployee.socials?.additional_phone || '') ||
        profileForm.socials.max_url !== (selectedEmployee.socials?.max_url || '') ||
        profileForm.socials.vk_url !== (selectedEmployee.socials?.vk_url || '') ||
        profileForm.socials.telegram_url !==
          (selectedEmployee.socials?.telegram_url || '') ||
        profileForm.skills !== (selectedEmployee.skills || '') ||
        profileForm.status !==
          (isEmployeeBlocked(selectedEmployee.status) ? 'BLOCKED' : 'ACTIVE') ||
        profileForm.archived_at !== (selectedEmployee.archived_at || '') ||
        weeklyPlanSeconds !== (selectedEmployee.weekly_plan_seconds ?? null) ||
        !arePayloadsEqual(payloadResult.payload, selectedEmployee.payload);

      if (!hasChanges) {
        toast.message('Нет изменений для сохранения.');
        return;
      }

      await api.admin.employees.updateProfile(selectedEmployee.id, {
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        role_id: profileForm.role,
        role: resolveRoleValueByOptionId(profileForm.role),
        position: profileForm.position.trim() || null,
        birthday: profileForm.birthday.trim() || null,
        phone: profileForm.phone.trim() || null,
        socials: {
          ...buildSocialsPayload(profileForm.socials),
        },
        skills: profileForm.skills.trim() || null,
        payload: payloadResult.payload,
        status: profileForm.status,
        ...(profileForm.status === 'ACTIVE'
          ? { archived_at: null }
          : profileForm.archived_at
            ? { archived_at: profileForm.archived_at }
            : {}),
        weekly_plan_seconds: weeklyPlanSeconds,
      });

      toast.success('Сотрудник обновлён.');
      fetchEmployees();
      fetchEmployeeCounts();
      fetchProjects();
    } catch (err) {
      handleError(err);
    } finally {
      setIsUpdatingEmployee(false);
    }
  };

  const onGenerateNewEmployeePassword = () => {
    setEmployeeForm((prev) => ({
      ...prev,
      password: generateEmployeePasswordValue(),
    }));
  };

  const openCreateEmployeeModal = () => {
    setEmployeeForm((prev) => ({
      ...prev,
      password: prev.password || generateEmployeePasswordValue(),
    }));
    setIsEmployeeModalOpen(true);
  };

  const openResetPasswordConfirmation = (employee: User) => {
    if (employee.id === user?.id) {
      toast.error('Свой пароль меняется в настройках профиля.');
      return;
    }

    setResetPasswordCandidate(employee);
  };

  const openEmployeeDay = (employee: User) => {
    setSelectedEmployeeInitialTab('День сотрудника');
    setSelectedEmployeeId(employee.id);
  };

  const openEmployeeFromTable = (employee: User) => {
    setSelectedEmployeeInitialTab('Общие данные');
    setSelectedEmployeeId(employee.id);
  };

  const closeEmployeeDetails = () => {
    setSelectedEmployeeId('');
    setSelectedEmployeeInitialTab('Общие данные');
    setSelectedEmployeeProfileForm(createEmptyEmployeeProfileForm());
    // Ссылка на «День сотрудника» больше не действует: карточка из таблицы откроется на «Общих данных»,
    // а повторный переход по той же ссылке снова откроет нужный день.
    if (queryParams.has('tab') || queryParams.has('date')) {
      const nextParams = new URLSearchParams(queryParams);
      nextParams.delete('tab');
      nextParams.delete('date');
      const search = nextParams.toString();
      navigate({ search: search ? `?${search}` : '' }, { replace: true });
    }
  };

  const resetEmployeePassword = async () => {
    if (!resetPasswordCandidate) return;

    const nextPassword = generateEmployeePasswordValue();

    try {
      setIsResettingEmployeePassword(true);
      await api.admin.employees.changePassword(resetPasswordCandidate.id, {
        password: nextPassword,
        password_confirmation: nextPassword,
      });
      setResetPasswordResult({
        employee: resetPasswordCandidate,
        password: nextPassword,
      });
      setResetPasswordCandidate(null);
      toast.success('Пароль сотрудника сброшен.');
    } catch (err) {
      handleError(err);
    } finally {
      setIsResettingEmployeePassword(false);
    }
  };

  const archiveEmployee = async () => {
    if (!archiveCandidate) return;

    try {
      setIsArchivingEmployee(true);
      await api.admin.employees.updateProfile(
        archiveCandidate.id,
        employeeStatusUpdatePayload(archiveCandidate, 'BLOCKED'),
      );
      toast.success('Сотрудник перемещён в архив.');
      setArchiveCandidate(null);
      await Promise.all([fetchEmployees(), fetchEmployeeCounts(), fetchProjects()]);
    } catch (err) {
      handleError(err);
    } finally {
      setIsArchivingEmployee(false);
    }
  };

  const restoreEmployee = async (employee: User) => {
    try {
      setIsArchivingEmployee(true);
      await api.admin.employees.updateProfile(
        employee.id,
        employeeStatusUpdatePayload(employee, 'ACTIVE', null),
      );
      toast.success(
        'Сотрудник возвращён из архива. PM-права и ставки при необходимости настройте заново.',
      );
      await Promise.all([fetchEmployees(), fetchEmployeeCounts(), fetchProjects()]);
    } catch (err) {
      handleError(err);
    } finally {
      setIsArchivingEmployee(false);
    }
  };

  const deleteEmployee = async () => {
    if (!deleteCandidate) return;

    try {
      setIsDeletingEmployee(true);
      await api.admin.employees.delete(deleteCandidate.id);
      toast.success('Сотрудник удалён.');
      if (selectedEmployeeId === deleteCandidate.id) {
        closeEmployeeDetails();
      }
      setDeleteCandidate(null);
      fetchEmployees();
      fetchEmployeeCounts();
      fetchProjects();
    } catch (err) {
      handleError(err);
    } finally {
      setIsDeletingEmployee(false);
    }
  };

  const archiveCandidateProjects = archiveCandidate
    ? projects.filter((project) =>
        project.members.some(
          (member: ProjectMember) => member.user.id === archiveCandidate.id,
        ),
      )
    : [];
  const archiveCandidateActiveProjectCount = archiveCandidateProjects.filter(
    (project) => !isProjectArchived(project.status),
  ).length;

  const requestDeleteEmployee = (employee: User) => {
    setDeleteCandidate(employee);
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

  const findRoleIdByName = (roleName: string): string | null => {
    if (!roleName) return null;
    const normalizedName = roleName.trim().toUpperCase();
    const role = roleOptions.find(
      (opt) =>
        opt.role_value?.toUpperCase() === normalizedName ||
        opt.label?.toUpperCase() === normalizedName ||
        opt.value?.toUpperCase() === normalizedName,
    );
    return role?.role_id || role?.value || null;
  };

  const validateEmployeeRow = (
    data: Record<string, unknown>,
  ): { valid: boolean; errors: string[]; employee?: EmployeeCreateForm } => {
    const errors: string[] = [];

    const findKeyByWord = (keywords: string[]): string | undefined => {
      return Object.keys(data).find((key) => {
        const lowerKey = key.toLowerCase();
        return keywords.some(
          (kw) => lowerKey === kw || lowerKey.match(new RegExp(`\\b${kw}\\b`)),
        );
      });
    };

    const firstNameKey = findKeyByWord(['имя']);
    const lastNameKey = findKeyByWord(['фамилия']);
    const emailKey = findKeyByWord(['email', 'почта']);
    const roleKey = findKeyByWord(['роль']);
    const positionKey = findKeyByWord(['должность']);
    const birthdayKey = findKeyByWord(['дата рождения']);
    const phoneKey = findKeyByWord(['телефон']);
    const passwordKey = findKeyByWord(['пароль']);
    const skillsKey = findKeyByWord(['компетенции']);
    const additionalEmailKey = Object.keys(data).find(
      (key) => key.toLowerCase().includes('доп') && key.toLowerCase().includes('почта'),
    );
    const additionalPhoneKey = Object.keys(data).find(
      (key) => key.toLowerCase().includes('доп') && key.toLowerCase().includes('телефон'),
    );
    const telegramKey = findKeyByWord(['телеграм', 'telegram']);
    const vkKey = findKeyByWord(['вконтакте', 'vk']);
    const maxKey = findKeyByWord(['max']);

    const firstName = String(data[firstNameKey || 'Имя'] || '').trim();
    const lastName = String(data[lastNameKey || 'Фамилия'] || '').trim();
    const email = String(data[emailKey || 'Email'] || '').trim();
    const roleName = String(data[roleKey || 'Роль'] || '').trim();

    if (!firstName) errors.push('Отсутствует имя');
    if (!lastName) errors.push('Отсутствует фамилия');
    if (!email) errors.push('Отсутствует email');
    if (!roleName) errors.push('Отсутствует роль');

    const roleId = findRoleIdByName(roleName);
    if (roleName && !roleId) errors.push(`Роль "${roleName}" не найдена`);

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const position = String(data[positionKey || 'Должность'] || '').trim();
    const birthday = formatBirthdayForApi(
      data[birthdayKey || 'Дата рождения'] as string | number,
    );
    const phone = formatPhoneForApi(String(data[phoneKey || 'Телефон'] || '').trim());
    const password =
      String(data[passwordKey || 'Пароль'] || '').trim() ||
      generateEmployeePasswordValue();
    const skills = String(data[skillsKey || 'Компетенции'] || '').trim();
    const additionalEmail = String(data[additionalEmailKey || 'Доп. Почта'] || '').trim();
    const additionalPhone = formatPhoneForApi(
      String(data[additionalPhoneKey || 'Доп. Телефон'] || '').trim(),
    );
    const telegram = String(data[telegramKey || 'Телеграм'] || '').trim();
    const vk = String(data[vkKey || 'Вконтакте'] || '').trim();
    const max = String(data[maxKey || 'Max'] || '').trim();

    const rawSocials = {
      additional_email: additionalEmail,
      additional_phone: additionalPhone,
      telegram_url: telegram,
      vk_url: vk,
      max_url: max,
    };
    const socials = buildSocialsPayload(rawSocials as EmployeeProfileForm['socials']);

    const employee: EmployeeCreateForm = {
      email,
      first_name: firstName,
      last_name: lastName,
      password,
      role: roleId || roleName,
      role_id: roleId || '',
      position: position || '',
      birthday: birthday || '',
      phone: phone || '',
      socials,
      skills: skills || '',
    };

    return { valid: true, errors: [], employee };
  };

  const importEmployees = async (employeesData: unknown[]) => {
    try {
      setIsImportingEmployees(true);

      if (!Array.isArray(employeesData) || employeesData.length === 0) {
        toast.error('Нет данных для импорта.');
        return;
      }

      console.log('Начинаем импорт сотрудников:', employeesData);

      let successCount = 0;
      const errorDetails: { row: number; errors: string[] }[] = [];

      for (let i = 0; i < employeesData.length; i++) {
        const rawData = employeesData[i];

        try {
          if (typeof rawData !== 'object' || rawData === null) {
            errorDetails.push({
              row: i + 2,
              errors: ['Некорректный формат данные'],
            });
            continue;
          }

          const data = rawData as Record<string, unknown>;
          const validation = validateEmployeeRow(data);

          if (!validation.valid) {
            errorDetails.push({
              row: i + 2,
              errors: validation.errors,
            });
            continue;
          }

          if (!validation.employee) {
            errorDetails.push({
              row: i + 2,
              errors: ['Ошибка обработки данных'],
            });
            continue;
          }

          console.log(`Создаём сотрудника ${i + 1}:`, validation.employee);

          const employeeToCreate = {
            ...validation.employee,
            role: resolveRoleValueByOptionId(validation.employee.role),
          };

          await api.admin.employees.create(employeeToCreate);
          successCount++;
        } catch (err) {
          errorDetails.push({
            row: i + 2,
            errors: [err instanceof Error ? err.message : 'Неизвестная ошибка'],
          });
          console.error(`Ошибка при создании сотрудника ${i + 1}:`, err);
        }
      }

      if (successCount > 0) {
        toast.success(`Импортировано сотрудников: ${successCount}`);
        fetchEmployees();
        fetchEmployeeCounts();
        fetchProjects();
        setIsImportModalOpen(false);
      }

      if (errorDetails.length > 0) {
        const errorSummary = errorDetails
          .slice(0, 3)
          .map((e) => `Строка ${e.row}: ${e.errors.join(', ')}`)
          .join('\n');
        const moreErrors =
          errorDetails.length > 3 ? `\n... и ещё ${errorDetails.length - 3} ошибок` : '';
        toast.error(`Ошибки при импорте:\n${errorSummary}${moreErrors}`);
      }

      if (successCount === 0) {
        return;
      }
    } catch (error) {
      console.error('Ошибка при импорте сотрудников', error);
      toast.error('Ошибка при импорте сотрудников');
    } finally {
      setIsImportingEmployees(false);
    }
  };

  if (!canViewEmployees) {
    return (
      <div className='rounded-xl border border-[#e3e9f3] bg-white p-4 text-sm text-[#7e8fb4]'>
        У вас нет доступа к списку сотрудников.
      </div>
    );
  }

  return (
    <>
      <div className='grid h-full min-h-0 gap-2 lg:grid-cols-[240px_minmax(0,1fr)]'>
        <div className='hidden h-full min-h-0 lg:block'>
          <EmployeesListPanel
            employees={panelEmployees}
            isLoading={isLoadingEmployees}
            tariffLimits={tariffLimits}
            // Рядом с таблицей подсказку о лимите уже показывает она сама.
            showLimitNotice={Boolean(selectedEmployee)}
            searchQuery={listSearchQuery}
            statusFilter={listStatusFilter}
            activeSelectedEmployeeId={activeSelectedEmployeeId}
            activeCount={employeeCounts.active}
            archivedCount={employeeCounts.archived}
            trackingUserIds={socketData.trackingUserIds}
            onlineUserIds={socketData.onlineUserIds}
            onSearchQueryChange={setListSearchQuery}
            onStatusFilterChange={setListStatusFilter}
            onSelectEmployee={(employeeId) => {
              setSelectedEmployeeInitialTab('День сотрудника');
              setSelectedEmployeeId(employeeId);
            }}
            onOpenCreateModal={openCreateEmployeeModal}
            onArchiveEmployee={setArchiveCandidate}
            onRestoreEmployee={restoreEmployee}
            onDeleteEmployee={requestDeleteEmployee}
            canCreateEmployee={canCreateUpdateEmployee}
            canManageEmployee={canCreateUpdateEmployee}
            canDeleteEmployee={canDeleteEmployee}
          />
        </div>

        {selectedEmployee ? (
          <EmployeeDetailsPanel
            // Новая ссылка открывает карточку заново на «Дне сотрудника» нужной даты.
            key={
              isRequestedDayOpen
                ? `day:${requestedUserId}:${requestedDayDate}`
                : 'employee'
            }
            selectedEmployee={selectedEmployee}
            profileForm={profileForm}
            roleOptions={roleOptions}
            projects={projects}
            isUpdating={isUpdatingEmployee}
            initialTab={
              isRequestedDayOpen ? 'День сотрудника' : selectedEmployeeInitialTab
            }
            initialDayDate={isRequestedDayOpen ? requestedDayDate : undefined}
            positionSuggestions={positionSuggestions}
            onProfileFormChange={setSelectedEmployeeProfileForm}
            onUpdateEmployee={onUpdateEmployee}
            onRequestPasswordReset={openResetPasswordConfirmation}
            onCloseEmployee={closeEmployeeDetails}
            canEditProfile={canCreateUpdateEmployee}
          />
        ) : (
          <EmployeesTablePanel
            employees={employees}
            projects={projects}
            isLoading={isLoadingEmployees}
            tariffLimits={tariffLimits}
            searchQuery={tableSearchQuery}
            statusFilter={tableStatusFilter}
            activeCount={employeeCounts.active}
            archivedCount={employeeCounts.archived}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            sortKey={tableSortKey}
            sortDirection={tableSortDirection}
            onSearchQueryChange={(value) => {
              setTableSearchQuery(value);
              resetPage();
            }}
            onStatusFilterChange={(value) => {
              setTableStatusFilter(value);
              resetPage();
            }}
            onPageChange={setCurrentPage}
            onPageSizeChange={onPageSizeChange}
            onSortChange={(key) => {
              resetPage();
              if (tableSortKey === key) {
                setTableSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
              } else {
                setTableSortKey(key);
                setTableSortDirection('asc');
              }
            }}
            onOpenCreateModal={openCreateEmployeeModal}
            onOpenEmployeeDay={openEmployeeDay}
            onEditEmployee={openEmployeeFromTable}
            onResetEmployeePassword={openResetPasswordConfirmation}
            onArchiveEmployee={setArchiveCandidate}
            onRestoreEmployee={restoreEmployee}
            onDeleteEmployee={requestDeleteEmployee}
            onImportEmployees={() => setIsImportModalOpen(true)}
            onExportEmployees={() => setIsExportModalOpen(true)}
            canManageEmployee={canCreateUpdateEmployee}
            canDeleteEmployee={canDeleteEmployee}
            canCreateEmployee={canCreateUpdateEmployee}
            canEditEmployee={canCreateUpdateEmployee}
            canResetEmployeePassword={canResetEmployeePassword}
            canViewEmployeeDay={canViewEmployeeDay}
          />
        )}
      </div>

      {canCreateUpdateEmployee ? (
        <EmployeeModal
          isAdding={isAddingEmployee}
          isOpen={isEmployeeModalOpen}
          form={employeeForm}
          onChange={setEmployeeForm}
          onClose={() => setIsEmployeeModalOpen(false)}
          onSubmit={onCreateEmployee}
          onGeneratePassword={onGenerateNewEmployeePassword}
          roleOptions={roleOptions}
          positionSuggestions={positionSuggestions}
        />
      ) : null}

      <ExportDataModal
        isOpen={isExportModalOpen}
        title='Экспорт сотрудников'
        isExportDisabled={employees.length === 0}
        onClose={() => setIsExportModalOpen(false)}
        onExportXlsx={exportEmployeesXlsx}
        onExportCsv={exportEmployeesCsv}
      />

      <ImportDataModal
        isOpen={isImportModalOpen}
        title='Импорт сотрудников'
        importType='EMPLOYEES'
        isImportDisabled={false}
        acceptedFormats={['.xlsx', '.xls', '.csv']}
        tplFileName='employees_import_tpl.xlsx'
        isLoading={isImportingEmployees}
        onClose={() => setIsImportModalOpen(false)}
        onImport={importEmployees}
        onLoadFile={onLoadImportFile}
      />

      {archiveCandidate ? (
        <DialogShell
          maxWidthClassName='max-w-[560px]'
          onClose={() => setArchiveCandidate(null)}
        >
          <h2 className='mb-4 text-xl leading-tight font-semibold sm:mb-5 sm:text-[24px] sm:leading-none'>
            Архивировать сотрудника?
          </h2>
          <p className='text-sm leading-snug text-[#1f3565] sm:text-[16px] sm:leading-tight'>
            Сотрудник будет перемещен в архив.{' '}
            <strong>
              Активных проектов у него: {archiveCandidateActiveProjectCount}.
            </strong>
            <br />
            Незавершенные задачи останутся без исполнителя.
            <br />
            <strong>
              Будет обнуление ставок с сегодняшнего дня, проверьте ставки сотрудника.
            </strong>{' '}
            <br />
            Сотрудник удалится из проектов, но останется в истории назначения. Информацию
            можно узнать на вкладке Команда в деталях проекта и на вкладке Назначения
            самого сотрудника.
          </p>

          <div className='mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:flex sm:justify-end sm:gap-3'>
            <Button
              type='button'
              variant='secondary'
              className='h-10 rounded-xl border-[#e3e9f3] bg-white px-4 text-[13px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
              onClick={() => setArchiveCandidate(null)}
            >
              Отмена
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={isArchivingEmployee}
              className='h-10 rounded-xl border-transparent! bg-[#2d6ff7]! px-5 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! disabled:bg-[#2d6ff7]! disabled:text-white! disabled:opacity-80'
              onClick={archiveEmployee}
            >
              {isArchivingEmployee ? 'Архивация...' : 'Архивировать'}
            </Button>
          </div>
        </DialogShell>
      ) : null}

      {deleteCandidate ? (
        <DialogShell
          maxWidthClassName='max-w-[560px]'
          onClose={() => setDeleteCandidate(null)}
        >
          <h2 className='mb-4 text-xl leading-tight font-semibold sm:mb-5 sm:text-[24px] sm:leading-none'>
            Удалить сотрудника?
          </h2>
          <p className='text-sm leading-snug text-[#1f3565] sm:text-[16px] sm:leading-tight'>
            {(deleteCandidate.total_seconds ?? 0) > 0 ? (
              <>
                Сотрудник <strong>{formatName(deleteCandidate)}</strong> не может быть
                удален.
                <br />У сотрудника есть время:{' '}
                <strong>{formatDurationHms(deleteCandidate.total_seconds ?? 0)}</strong>.
                <br />
              </>
            ) : (
              <>
                Сотрудник <strong>{formatName(deleteCandidate)}</strong> будет удален
                безвозвратно.
                <br />
              </>
            )}
            Удалять сотрудников можно только из архива без отработанного времени.
          </p>

          <div className='mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:flex sm:justify-end sm:gap-3'>
            <Button
              type='button'
              variant='secondary'
              className='h-10 rounded-xl border-[#e3e9f3] bg-white px-4 text-[13px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
              onClick={() => setDeleteCandidate(null)}
            >
              Отмена
            </Button>
            <Button
              type='button'
              variant='danger'
              disabled={isDeletingEmployee || employeeHasTrackedTime(deleteCandidate)}
              className='h-10 rounded-xl px-5 text-[13px] font-semibold'
              onClick={deleteEmployee}
            >
              {isDeletingEmployee ? 'Удаление...' : 'Удалить'}
            </Button>
          </div>
        </DialogShell>
      ) : null}

      {resetPasswordCandidate ? (
        <DialogShell
          maxWidthClassName='max-w-[520px]'
          onClose={() => setResetPasswordCandidate(null)}
        >
          <h2 className='mb-4 text-xl leading-tight font-semibold sm:text-[24px] sm:leading-none'>
            Сбросить пароль?
          </h2>
          <p className='text-sm leading-snug text-[#1f3565] sm:text-[16px] sm:leading-tight'>
            Вы точно уверены, что нужно сбросить пароль сотруднику{' '}
            <strong>{formatName(resetPasswordCandidate)}</strong>?
            <br />
            После сброса текущий пароль перестанет работать.
          </p>

          <div className='mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:flex sm:justify-end sm:gap-3'>
            <Button
              type='button'
              variant='secondary'
              className='h-10 rounded-xl border-[#e3e9f3] bg-white px-4 text-[13px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
              onClick={() => setResetPasswordCandidate(null)}
            >
              Отмена
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={isResettingEmployeePassword}
              className='h-10 rounded-xl border-transparent! bg-[#2d6ff7]! px-5 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! disabled:bg-[#2d6ff7]! disabled:text-white! disabled:opacity-80'
              onClick={resetEmployeePassword}
            >
              {isResettingEmployeePassword ? 'Сброс...' : 'Сбросить пароль'}
            </Button>
          </div>
        </DialogShell>
      ) : null}

      {resetPasswordResult ? (
        <DialogShell
          maxWidthClassName='max-w-[430px]'
          onClose={() => setResetPasswordResult(null)}
        >
          <h2 className='mb-4 text-[22px] leading-tight font-semibold'>Пароль сброшен</h2>
          <p className='mb-5 text-[15px] leading-tight text-[#1f3565]'>
            Новый пароль для сотрудника {formatName(resetPasswordResult.employee)}:
          </p>

          <div className='grid justify-items-center rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-4 text-center'>
            <strong className='break-all text-[20px] leading-tight text-[#10275a]'>
              {resetPasswordResult.password}
            </strong>
            <Button
              type='button'
              variant='secondary'
              className='mt-4 h-10 rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]!'
              onClick={async () => {
                const text = resetPasswordResult.password;
                try {
                  if (navigator.clipboard?.writeText && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                  } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.setAttribute('readonly', '');
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    const ok = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    if (!ok) throw new Error('execCommand copy failed');
                  }
                  toast.success('Пароль скопирован.');
                } catch {
                  toast.error('Не удалось скопировать пароль.');
                }
              }}
            >
              Скопировать пароль
            </Button>
          </div>

          <div className='mt-5 flex justify-end'>
            <Button
              type='button'
              variant='secondary'
              className='h-10 rounded-xl border-[#e3e9f3] bg-white px-4 text-[13px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
              onClick={() => setResetPasswordResult(null)}
            >
              Закрыть
            </Button>
          </div>
        </DialogShell>
      ) : null}
    </>
  );
}
