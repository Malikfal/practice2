import type { RateCurrency } from '../utils/currency';

export type UserRole = 'ADMIN' | 'MANAGER' | 'WORKER' | (string & {});

export type User = {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  role?: UserRole;
  role_label?: string;
  position?: string | null;
  birthday?: string | null;
  phone?: string | null;
  socials?: Record<string, string> | null;
  skills?: string | null;
  payload?: Record<string, unknown> | null;
  status?: string;
  archived_at?: string | null;
  avatar_url?: string;
  permissions?: string[];
  role_permissions?: string[];
  direct_permissions?: string[];
  created_at?: string;
  last_date_activity?: number | null;
  total_seconds_for_week?: number;
  weekly_plan_seconds?: number | null;
  total_seconds_for_day?: number;
  supervised_seconds_for_week?: number | null;
  supervised_seconds_for_day?: number | null;
  // Часы всей компании: приходят только тем, у кого задана ставка за часы всей компании.
  company_seconds_for_week?: number | null;
  company_seconds_for_day?: number | null;
  total_seconds?: number;
  denied_permissions?: string[];
  salary_finance_article_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  // Тариф компании: приходит только в профиле текущего пользователя.
  tariff?: UserTariff | null;
  locked_features?: TariffFeature[];
  // Права роли, которые отключил тариф ФРИ: там вместо раздела показываем «Доступно на ПРО».
  tariff_locked_permissions?: string[];
};

export type TariffFeature =
  | 'tracker'
  | 'finance_analytics'
  | 'payroll'
  | 'project_economics'
  | 'client_access'
  | 'advanced_reports';

export type UserTariff = {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  max_employees: number | null;
};

export type EmployeeStatus = 'ACTIVE' | 'BLOCKED';

export type RoleOption = {
  id?: number;
  role_id?: string;
  value: string;
  role_value?: string;
  label: string;
};

export type PermissionOption = {
  value: string;
  label: string;
};

export type RolePermissionMatrixRole = {
  value: string;
  display_name?: string;
  label: string;
  permissions: string[];
  available_permissions?: string[];
  is_immutable?: boolean;
};

export type RolePermissionMatrixResponse = {
  roles: RolePermissionMatrixRole[];
  permissions: PermissionOption[];
};

export type ProjectMember = {
  id: string;
  is_pm?: boolean;
  is_pm_payroll_enabled?: boolean;
  user: User;
};

export type ProjectAssignmentHistory = {
  id: string;
  project_id: string;
  user_id: string;
  is_pm: boolean;
  is_pm_payroll_enabled: boolean;
  started_on: string;
  ended_on: string | null;
  project?: { id: string; name: string } | null;
  employee?: Pick<User, 'id' | 'name' | 'last_name' | 'email' | 'first_name'> | null;
  created_at?: string;
  updated_at?: string;
};

export type ProjectAssignmentHistoryForm = {
  project_id: string;
  user_id: string;
  is_pm: boolean;
  is_pm_payroll_enabled: boolean;
  started_on: string;
  ended_on: string;
};

export type ProjectActivityHistory = {
  id: string;
  project_id: string;
  started_on: string;
  ended_on: string | null;
  is_current: boolean;
  project?: { id: string; name: string } | null;
  created_at?: string;
  updated_at?: string;
};

export type ProjectActivityHistoryForm = {
  started_on: string;
  ended_on: string;
};

export type ProjectActivityPeriod = {
  id: string;
  started_on: string;
  ended_on: string | null;
  is_current: boolean;
};

export type ProjectClient = {
  id: string;
  name: string;
};

export type ClientProject = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  status_label: string;
  client_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  budget: number | null;
  current_rate?: ClientProjectRate | null;
};

export type ClientProjectRate = {
  id: string;
  rate: number;
  vat: number | null;
  currency?: RateCurrency;
  effective_from: string | null;
};

export type ClientContact = {
  id?: string;
  client_id?: string;
  first_name: string;
  last_name?: string | null;
  middle_name?: string | null;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  comments?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ClientFlowAccount = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  all_projects: boolean;
  project_ids: string[];
  projects: string[];
  password_set: boolean;
  last_login_at: string | null;
};

export type ClientLegalEntityBankDetail = {
  id?: string;
  client_legal_entity_id?: string;
  checking_account: string;
  bank: string;
  bik: string;
  correspondent_account: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ClientLegalEntity = {
  id?: string;
  client_id?: string;
  name: string;
  legal_address: string;
  postal_code: string;
  inn: string;
  kpp?: string | null;
  ogrn?: string | null;
  signer_last_name?: string | null;
  signer_first_name?: string | null;
  signer_middle_name?: string | null;
  signer_position?: string | null;
  phone?: string | null;
  email?: string | null;
  bank_details?: ClientLegalEntityBankDetail[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type Client = {
  id: string;
  name: string;
  description: string | null;
  // Недельный лимит, общий на все проекты клиента.
  weekly_limit_seconds?: number | null;
  contacts?: ClientContact[];
  legal_entities?: ClientLegalEntity[];
  projects?: ClientProject[];
  created_at: string | null;
  updated_at: string | null;
};

export type ClientForm = {
  name: string;
  description: string;
  // Поле ввода в часах; без него форма не показывает и не отправляет лимит.
  weekly_limit_hours?: string;
};

export type ClientPayload = ClientForm & {
  // undefined — не менять, null — лимит не задан.
  weekly_limit_seconds?: number | null;
};

export type ProjectTag = {
  id: string;
  name: string;
};

export type Tag = {
  id: string;
  company_id?: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type Skill = {
  id: string;
  company_id?: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type ProjectRate = {
  id: string;
  rate: number;
  vat: number | null;
  currency?: RateCurrency;
  effective_from?: string | null;
  created_at?: string | null;
};

export type ProjectDefaultEntranceArticle = {
  project_id: string;
  default_entrance_finance_article_id: string | null;
  default_entrance_finance_article: { id: string; name: string } | null;
};

export type Project = {
  id: string;
  name: string;
  default_entrance_finance_article_id: string | null;
  created_at?: string | null;
  description?: string;
  status?: string;
  status_label?: string;
  latest_activity_period: ProjectActivityPeriod | null;
  company_id?: string;
  created_by_id: string;
  client?: ProjectClient | null;
  client_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  budget?: number | null;
  manager_payment_method?: string;
  manager_payment_method_label?: string;
  weekly_seconds?: number;
  daily_seconds?: number;
  total_seconds?: number;
  weekly_amount?: number;
  weekly_amount_currency?: RateCurrency;
  current_rate?: ProjectRate | null;
  tracker_default_status_name?: string;
  members: ProjectMember[];
  members_count?: number;
  manager?: User | null;
  tags?: ProjectTag[];
  is_pinned?: boolean;
  pinned_at?: number;
  is_internal?: boolean;
  exclude_from_payroll: boolean;
  payroll_exclusion_scope: ProjectPayrollExclusionScope;
  payroll_excluded_employee_ids: string[];
  weekly_limit_seconds?: number | null;
  // Лимит клиента главнее лимита проекта.
  client_weekly_limit_seconds?: number | null;
};

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export type ProjectPayrollExclusionScope = 'ALL' | 'SELECTED';

export type ProjectCreatorUpdatePayload = {
  created_by_id: string;
};

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type TaskCreator = {
  id: string;
  first_name: string;
  last_name: string | null;
  name: string;
  email: string;
};

export type TaskStatusColumn = {
  id: string;
  project_id?: string;
  label: string;
  order: number;
  name?: string;
  slug?: string;
  color?: string | null;
  position?: number;
  is_default?: boolean;
  is_final?: boolean;
};

export type TaskStatusColumnForm = {
  name: string;
  slug?: string;
  color: string;
  is_default?: boolean;
  is_final?: boolean;
};

export type TaskSpentUser = {
  user_id: string;
  name?: string;
  last_name?: string;
  spent_seconds?: number;
};

export type Task = {
  id: string;
  number?: number | null;
  title: string;
  project_id: string;
  project_name?: string | null;
  parent_task_id?: string | null;
  created_by_id: string | null;
  creator: TaskCreator | null;
  description?: string | null;
  status_column_id?: string | null;
  status_label?: string;
  status?: string;
  status_color?: string | null;
  status_slug?: string | null;
  created_at?: string;
  updated_at?: string;
  position?: number;
  spent_seconds?: number;
  spent_by_users?: TaskSpentUser[];
  remaining_seconds?: number | null;
  estimation?: number | null;
  deadline?: string | null;
  // "Старт выполнения": когда задачу планируют делать.
  start_at?: string | null;
  // Метка "Есть изменения": в истории есть новое от других после последнего открытия задачи.
  has_changes?: boolean;
  last_activity_at?: string | null;
  assignee_ids?: string[];
  assignees?: User[];
  priority?: TaskPriority;
  subtasks?: Task[];
  is_draft: boolean;
  is_client_visible?: boolean;
  client_approval_status?: TaskClientApprovalStatus | null;
  published_at: string | null;
  client_public_link?: string | null;
};

export type TaskCreateForm = {
  title: string;
  description?: string;
  assignee_ids?: string[];
  priority: TaskPriority | null;
  estimation?: string;
  deadline?: string | null;
  start_at?: string | null;
  parent_task_id?: string | null;
  is_client_visible?: boolean;
};

export type TaskBoardResponse = {
  columns?: TaskStatusColumn[];
  data?: Task[];
};

export type UserBoardTask = Task & {
  project?: { id: string; name?: string } | null;
  status_column?: TaskStatusColumn | null;
};

export type UserBoardColumn = {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  label: string;
  color?: string | null;
  position?: number;
  order?: number;
  is_default?: boolean;
  is_final?: boolean;
  tasks?: UserBoardTask[];
};

export type UserBoardResponse = {
  columns?: UserBoardColumn[];
  data?: UserBoardTask[];
};

export type ProjectEmployeeStat = {
  user_id: string;
  user_name: string;
  duration_seconds: number;
};

export type ProjectDetails = {
  project?: Project;
  by_employee?: ProjectEmployeeStat[];
};

export type LoginForm = {
  email: string;
  password: string;
};

export type ProfileForm = {
  first_name: string;
  last_name: string;
  position?: string | null;
  birthday?: string | null;
  phone?: string | null;
  socials?: {
    additional_email?: string;
    additional_phone?: string;
    max_url?: string;
    vk_url?: string;
    telegram_url?: string;
  };
  skills?: string | null;
  payload?: Record<string, string> | null;
};

export type PasswordForm = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

export type EmployeeCreateForm = {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: string;
  role_id?: string;
  position: string;
  birthday: string;
  phone: string;
  socials: {
    additional_email?: string;
    additional_phone?: string;
    max_url?: string;
    vk_url?: string;
    telegram_url?: string;
  };
  skills: string;
};

export type EmployeeProfileForm = {
  employeeId: string;
  first_name: string;
  last_name: string;
  role: string;
  role_id?: string;
  position: string;
  birthday: string;
  phone: string;
  socials: {
    additional_email?: string;
    additional_phone?: string;
    max_url?: string;
    vk_url?: string;
    telegram_url?: string;
  };
  skills: string;
  payload_fields: Array<{ key: string; value: string }>;
  status: EmployeeStatus;
  archived_at: string;
  /** Недельный план в часах, как в поле ввода; пустая строка — план не задан. */
  weekly_plan_hours?: string;
};

export type EmployeePasswordForm = {
  password: string;
  password_confirmation: string;
};

export type ManualTimeForm = {
  task_id: string;
  task_title: string;
  user_id: string;
  project_id: string;
  started_at: string;
  ended_at: string;
  note: string;
};

export type EmployeeDayTimelineForm = {
  user_id: string;
  date: string;
};

export type MoveTimeSegmentForm = {
  move_from: string;
  move_to: string;
  destination_project_id: string;
  destination_task_id: string;
  new_task_title: string;
  destination_mode: 'existing' | 'new';
};

export type MoveTimeSegmentPayload = {
  move_from: string;
  move_to: string;
  destination_project_id: string;
  destination_task_id?: string;
  new_task_title?: string;
};

export type DeleteTimeSegmentPayload = {
  delete_from: string;
  delete_to: string;
};

export type ProjectForm = {
  name: string;
  description: string;
  status: string;
  client_id: string;
  template: string;
  // Начальная ставка: сумма в рублях/евро/долларах как ввели в форме.
  rate: string;
  rate_currency: RateCurrency;
  rate_vat: string;
  is_internal: boolean;
  exclude_from_payroll: boolean;
  payroll_exclusion_scope: ProjectPayrollExclusionScope;
  payroll_excluded_employee_ids: string[];
};

export type Template = {
  id: string;
  name: string;
  manager?: User | null;
  members: ProjectMember[];
  status_columns: TaskStatusColumn[];
  is_default_template?: boolean;
  is_pinned?: boolean;
  pinned_at?: number;
};

export type TemplateForm = {
  name: string;
  manager_id: string;
  member_ids: string[];
  is_default_template: boolean;
  status_columns: TaskStatusColumnForm[];
};

export type ReportGroupBy = 'day' | 'task' | 'project' | 'employee';

export type ReportProjectKind = 'commercial' | 'internal';

export type ReportForm = {
  from: string;
  to: string;
  group_by: ReportGroupBy;
  project_ids: string[];
  project_kinds: ReportProjectKind[];
  task_ids: string[];
  user_ids: string[];
  manager_ids: string[];
};

export type TimeReportRequest<TGroupBy extends ReportGroupBy = ReportGroupBy> = {
  from: string;
  to: string;
  group_by: TGroupBy;
  project_ids: string[];
  project_kinds: ReportProjectKind[];
  task_ids: string[];
  user_ids: string[];
  manager_ids: string[];
};

type TimeReportRowTime = {
  own_seconds: number;
};

export type TimeReportDayRow = TimeReportRowTime & {
  date: string;
};

export type TimeReportProjectRow = TimeReportRowTime & {
  project_id: string;
  project_name: string | null;
};

export type TimeReportTaskRow = TimeReportRowTime & {
  project_id: string;
  project_name: string | null;
  task_id: string;
  task_name: string | null;
};

export type TimeReportEmployeeRow = TimeReportRowTime & {
  user_id: string;
  user_name: string | null;
};

export type TimeReportRowsByGroup = {
  day: TimeReportDayRow;
  project: TimeReportProjectRow;
  task: TimeReportTaskRow;
  employee: TimeReportEmployeeRow;
};

export type TimeReportRow<TGroupBy extends ReportGroupBy = ReportGroupBy> =
  TimeReportRowsByGroup[TGroupBy];

type TimeReportResponseBase = {
  from: string;
  to: string;
  project_ids: string[];
  project_kinds: ReportProjectKind[];
  task_ids: string[];
  user_ids: string[];
  manager_ids: string[];
  own_seconds: number;
};

export type TimeReportResponse<TGroupBy extends ReportGroupBy = ReportGroupBy> =
  TGroupBy extends ReportGroupBy
    ? TimeReportResponseBase & {
        group_by: TGroupBy;
        rows: TimeReportRowsByGroup[TGroupBy][];
      }
    : never;

export type OverrunReportRequest = Omit<TimeReportRequest, 'group_by'>;

export type OverrunReportRow = {
  project_id: string;
  project_name: string | null;
  task_id: string;
  task_name: string | null;
  estimation_seconds: number | null;
  spent_seconds: number;
};

export type OverrunReportResponse = Omit<TimeReportResponseBase, 'own_seconds'> & {
  unestimated_task_limit_seconds: number;
  rows: OverrunReportRow[];
  spent_seconds: number;
};

// Отчёт «Лимитные проекты»: лимит клиента главнее лимита проекта и общий на его проекты.
export type LimitReportGroupBy = 'project' | 'client';

export type LimitReportRequest = Omit<TimeReportRequest, 'group_by'> & {
  group_by: LimitReportGroupBy;
};

export type HoursChartGroupBy = 'day' | 'week' | 'month';

export type HoursChartReportRequest = Omit<TimeReportRequest, 'group_by' | 'task_ids'> & {
  group_by: HoursChartGroupBy;
  client_ids: string[];
};

export type HoursChartRow = {
  // Первый день целого периода: дата дня, понедельник недели, первое число месяца.
  key: string;
  // Границы периода внутри выбранного диапазона.
  from: string;
  to: string;
  // Крайняя неделя или месяц обрезаны выбранным диапазоном.
  partial: boolean;
  seconds: number;
};

export type HoursChartReportResponse = {
  from: string;
  to: string;
  group_by: HoursChartGroupBy;
  rows: HoursChartRow[];
  total_seconds: number;
};

export type LimitReportProjectRow = {
  project_id: string;
  project_name: string | null;
  client_id: string | null;
  client_name: string | null;
  limit_source: 'client' | 'project';
  // Собственный лимит проекта; при лимите клиента не действует.
  project_weekly_limit_seconds: number | null;
  weekly_limit_seconds: number;
  // Лимит за выбранный период: недельный × дней / 7.
  limit_seconds: number;
  spent_seconds: number;
  // Время, которое расходует этот лимит: у лимита клиента — по всем его проектам в отчёте.
  limit_spent_seconds: number;
};

export type LimitReportClientRow = {
  client_id: string | null;
  client_name: string | null;
  weekly_limit_seconds: number | null;
  limit_seconds: number | null;
  spent_seconds: number;
  projects: LimitReportProjectRow[];
};

export type LimitReportResponse = Omit<TimeReportResponseBase, 'own_seconds'> & {
  period_days: number;
  spent_seconds: number;
  limit_seconds: number;
  // Сумма превышений и сумма неизрасходованных запасов; каждый лимит считается один раз.
  over_limit_seconds: number;
  remaining_seconds: number;
} & (
    | { group_by: 'project'; rows: LimitReportProjectRow[] }
    | { group_by: 'client'; rows: LimitReportClientRow[] }
  );

// Отчёт «Задачи без движения» — снимок на сегодня, периода нет.
export type StaleTasksReportRequest = Omit<
  TimeReportRequest,
  'group_by' | 'from' | 'to'
> & {
  status_names: string[];
};

export type StaleTasksReportRow = {
  project_id: string;
  project_name: string | null;
  task_id: string;
  task_name: string | null;
  status_name: string | null;
  status_color: string | null;
  spent_seconds: number;
  last_moved_at: string;
  last_moved_on: string;
  idle_days: number;
};

export type StaleTasksReportResponse = Omit<
  TimeReportResponseBase,
  'own_seconds' | 'from' | 'to'
> & {
  threshold_days: number;
  today: string;
  status_names: string[];
  available_statuses: string[];
  rows: StaleTasksReportRow[];
  spent_seconds: number;
};

export type TaskReportPayload = {
  rows?: Task[];
};

export type FinanceType = 'ENTRANCE' | 'EXPENDITURE';
export type FinanceDistributionMethod =
  | 'PROPORTIONAL_TO_EXPENSES'
  | 'BY_TERM'
  | 'BY_VOLUME';
export type FinanceDistributionPeriod =
  | 'CURRENT_DAY'
  | 'WEEK'
  | 'TWO_WEEKS'
  | 'MONTH'
  | 'QUARTER'
  | 'HALF_YEAR'
  | 'CURRENT_YEAR'
  | 'PREVIOUS_YEAR';
export type FinanceDistributionProjectMode = 'ALL' | 'SELECTED';
export type FinanceSource =
  | 'PAYROLL_DAILY'
  | 'PAYROLL_RECALCULATION'
  | 'MANUAL'
  | 'IMPORT';

export type FinanceArticle = {
  id: string;
  company_id: string;
  parent_id: string | null;
  name: string;
  type: FinanceType;
  type_label: string;
  distribution_method: FinanceDistributionMethod;
  distribution_method_label: string;
  default_distribution_period: FinanceDistributionPeriod;
  default_distribution_period_label: string;
  default_distribution_project_mode: FinanceDistributionProjectMode;
  default_distribution_project_mode_label: string;
  default_distribution_project_ids: string[];
  children: FinanceArticle[];
  created_at: string | null;
  updated_at: string | null;
};

export type FinanceArticlePayload = {
  name: string;
  type: FinanceType;
  parent_id?: string | null;
  distribution_method?: FinanceDistributionMethod;
  default_distribution_period?: FinanceDistributionPeriod;
  default_distribution_project_mode?: FinanceDistributionProjectMode;
  default_distribution_project_ids?: string[];
};

export type PlannedExpenseFormula = 'PERCENT_OF_INCOME' | 'FIXED_AMOUNT';

export type PlannedExpenseCalculationPeriod = 'MONTH' | 'QUARTER' | 'HALF_YEAR' | 'YEAR';

export type PlannedExpense = {
  id: string;
  company_id: string;
  finance_article_id: string;
  article: Pick<FinanceArticle, 'id' | 'name'>;
  formula: PlannedExpenseFormula;
  formula_label: string;
  percentage: number | null;
  fixed_amount: number | null;
  income_article_ids: string[];
  calculation_period: PlannedExpenseCalculationPeriod;
  calculation_period_label: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type PlannedExpensePayload = {
  finance_article_id: string;
  formula: PlannedExpenseFormula;
  percentage: number | null;
  fixed_amount: number | null;
  income_article_ids: string[];
  calculation_period: PlannedExpenseCalculationPeriod;
  is_active: boolean;
};

export type PlannedExpensePayment = {
  id: string;
  is_planned: true;
  planned_expense_id: string;
  type: 'EXPENDITURE';
  type_label: string;
  amount: number;
  income_amount: number | null;
  percentage: number | null;
  fixed_amount: number | null;
  formula_label: string;
  calculation_period: PlannedExpenseCalculationPeriod;
  calculation_period_label: string;
  period_from: string;
  period_to: string;
  article: Pick<FinanceArticle, 'id' | 'name'>;
};

export type FinanceClient = {
  id: string;
  name: string;
};

export type FinanceProject = {
  id: string;
  name: string;
  client: FinanceClient | null;
};

export type FinanceEmployee = {
  id: string;
  name: string;
  last_name: string | null;
  email: string;
};

export type Finance = {
  id: string;
  company_id: string;
  type: FinanceType;
  type_label: string;
  source?: FinanceSource;
  amount: number;
  comment: string | null;
  dateOfPayment: string;
  distribution_from: string;
  distribution_to: string;
  distribution_method: FinanceDistributionMethod;
  distribution_method_label: string;
  distribution_project_mode: FinanceDistributionProjectMode | null;
  distribution_project_mode_label: string | null;
  distribution_project_ids: string[];
  project: FinanceProject | null;
  article: FinanceArticle | null;
  employee: FinanceEmployee | null;
  created_at: string | null;
  updated_at: string | null;
};

export type FinanceFilters = {
  from?: string;
  to?: string;
  type?: FinanceType;
  sources?: FinanceSource[];
  finance_article_ids?: string[];
  project_ids?: string[];
  client_ids?: string[];
  employee_ids?: string[];
  amount_from?: number;
  amount_to?: number;
  per_page?: number;
  page?: number;
};

export type FinanceSummary = {
  income: number;
  expenses: number;
  profit: number;
};

export type FinancePayload = {
  project_id?: string | null;
  finance_article_id?: string | null;
  employee_id?: string | null;
  amount: number;
  type: FinanceType;
  comment?: string | null;
  dateOfPayment: string;
  distribution_from?: string;
  distribution_to?: string;
  distribution_method?: FinanceDistributionMethod;
  distribution_project_mode?: FinanceDistributionProjectMode;
  distribution_project_ids?: string[];
};

export type TimelineSegment = {
  id: string;
  task_id?: string;
  task_name?: string;
  note?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  project_id?: string;
  project_name?: string;
  started_at: number;
  ended_at: number;
  clamped_started_at: number;
  clamped_ended_at: number;
  duration_seconds: number;
};

export type EmployeeDayTimelinePayload = {
  user_id: string;
  from: string;
  to: string;
  segments?: TimelineSegment[];
  total_seconds?: number;
};

export type EmployeeDocument = {
  id: string;
  employee_id: string;
  original_name: string;
  mime_type?: string | null;
  size: number;
  author?: {
    id: string;
    name?: string;
    last_name?: string;
    email?: string;
  } | null;
  download_url?: string;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeDocumentIndexPayload = {
  data?: EmployeeDocument[];
};

export type EmployeeAbsenceType = 'VACATION' | 'DAY_OFF' | 'SICK_LEAVE' | 'WEEKEND';

export type EmployeeAbsencePaymentMode = 'DEFAULT' | 'FIXED';

export type EmployeeAbsenceActor = {
  id: string;
  name?: string;
  last_name?: string | null;
  email?: string;
};

export type EmployeeAbsence = {
  id: string;
  company_id: string;
  employee_id: string;
  type: EmployeeAbsenceType;
  date_from: string;
  date_to: string;
  payment_mode: EmployeeAbsencePaymentMode;
  fixed_daily_amount: number | null;
  coefficient: number;
  amount_kopecks: number | null;
  comment: string | null;
  created_by: EmployeeAbsenceActor | null;
  updated_by: EmployeeAbsenceActor | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeAbsenceForm = {
  type: EmployeeAbsenceType;
  date_from: string;
  date_to: string;
  payment_mode: EmployeeAbsencePaymentMode;
  fixed_daily_amount: string;
  coefficient: string;
  comment: string;
};

export type EmployeeAbsencePayload = {
  type: EmployeeAbsenceType;
  date_from: string;
  date_to: string;
  payment_mode: EmployeeAbsencePaymentMode;
  fixed_daily_amount?: number | null;
  coefficient?: number | null;
  comment?: string | null;
};

export type EmployeeAbsenceCalendarDay = {
  date: string;
  is_working_day: boolean;
  worked_seconds: number;
  absence: null | {
    id: string;
    type: EmployeeAbsenceType;
    payment_mode: EmployeeAbsencePaymentMode;
    fixed_daily_amount: number | null;
    coefficient: number;
    comment: string | null;
  };
};

export type EmployeeAbsenceCalendarPayload = {
  from: string;
  to: string;
  days: EmployeeAbsenceCalendarDay[];
  summary: Partial<Record<EmployeeAbsenceType, number>>;
};

export type EmployeeAbsenceIndexPayload = {
  data?: EmployeeAbsence[];
};

export type EmployeeAbsenceFixedDailyAmountMonths = 1 | 1.5 | 3 | 6 | 12;

export type EmployeeAbsenceFixedDailyAmountPayload = {
  data: {
    months: number;
    calculation_from: string;
    calculation_to: string;
    payroll_amount_kopecks: number;
    working_days: number;
    fixed_daily_amount: number;
  };
};

export type ProjectDocument = {
  id: string;
  project_id: string;
  original_name: string;
  mime_type?: string | null;
  size: number;
  // Внутренние документы скрыты от клиента. В клиентском кабинете поле не приходит.
  is_client_visible?: boolean;
  author?: {
    id: string;
    name?: string;
    last_name?: string;
    email?: string;
  } | null;
  download_url?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProjectDocumentIndexPayload = {
  data?: ProjectDocument[];
};

export type ProjectNote = {
  id: string;
  project_id: string;
  title?: string | null;
  content: string;
  visibility?: 'project' | 'restricted';
  visible_users?: User[];
  access?: {
    roles: RoleOption[];
    users: User[];
  } | null;
  is_pinned: boolean;
  author?: {
    id: string;
    name?: string;
    last_name?: string;
    email?: string;
  } | null;
  changed_by?: {
    id: string;
    name?: string;
    last_name?: string;
    email?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
};

export type ProjectNoteIndexPayload = {
  data?: ProjectNote[];
};

export type ProjectNoteForm = {
  title: string;
  content: string;
  visibility: 'project' | 'restricted';
  access?: {
    roles: string[];
    user_ids: string[];
  };
};

export type EmployeeRateType =
  | 'WEEKLY_SALARY'
  | 'HOURLY'
  | 'SUPERVISED_HOURLY'
  | 'COMPANY_HOURLY';

export type PayrollHoursScope = 'OWN' | 'SUPERVISED' | 'COMPANY';

export type SalaryDistributionScope = PayrollHoursScope;

export type PayrollProjectHoursType = 'ALL' | 'COMMERCIAL' | 'INTERNAL';

export type PayrollRangeCalculationMethod = 'THRESHOLD' | 'PROGRESSIVE';

export type EmployeeRateSettingRange = {
  project_hours_type: PayrollProjectHoursType;
  from_hours: number;
  to_hours: number | null;
  rate: number;
};

export type EmployeeRateProjectRate = {
  project_id: string;
  project_name?: string | null;
  rate: number;
};

export type EmployeeRateSetting = {
  rate_type: EmployeeRateType;
  is_advanced: boolean;
  default_rate: number | null;
  split_by_project_type: boolean;
  hours_scope: PayrollHoursScope;
  range_calculation_method: PayrollRangeCalculationMethod;
  ranges: EmployeeRateSettingRange[];
  project_rates?: EmployeeRateProjectRate[];
};

export type EmployeeRateSettingRangeForm = {
  project_hours_type: PayrollProjectHoursType;
  from_hours: string;
  to_hours: string;
  rate: string;
};

export type EmployeeRateProjectRateForm = {
  project_id: string;
  project_name: string;
  rate: string;
};

export type EmployeeRateSettingForm = {
  rate_type: EmployeeRateType;
  is_advanced: boolean;
  default_rate: string;
  split_by_project_type: boolean;
  hours_scope: PayrollHoursScope | '';
  range_calculation_method: PayrollRangeCalculationMethod;
  ranges: EmployeeRateSettingRangeForm[];
  has_project_rates: boolean;
  project_rates: EmployeeRateProjectRateForm[];
};

export type EmployeeRate = {
  id: string;
  employee_id: string;
  salary?: number | null;
  salary_distribution_scope: SalaryDistributionScope;
  hourly_rate?: number | null;
  supervised_hourly_rate?: number | null;
  company_hourly_rate?: number | null;
  exclude_from_supervised_hours?: boolean;
  rate_settings?: EmployeeRateSetting[];
  effective_from?: string | null;
  changed_by?: {
    id: string;
    name?: string;
    last_name?: string;
    email?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeRateForm = {
  salary: string;
  salary_distribution_scope: SalaryDistributionScope | '';
  hourly_rate: string;
  supervised_hourly_rate: string;
  company_hourly_rate: string;
  exclude_from_supervised_hours: boolean;
  effective_from: string;
  rate_settings: EmployeeRateSettingForm[];
};

export type EmployeeRateIndexPayload = {
  data?: EmployeeRate[];
};

export type EmployeeRateCurrentPayload = {
  data?: EmployeeRate | null;
};

export type EmployeeRateEmployeeRow = {
  employee: User;
  current_rate: EmployeeRate | null;
};

export type EmployeeRateEmployeesPayload = PaginatedResponse<EmployeeRateEmployeeRow>;

export type SalaryFinanceArticle = {
  id: string;
  parent_id: string | null;
  name: string;
  children: SalaryFinanceArticle[];
};

export type EmployeePayrollSettings = {
  employee_id: string;
  salary_finance_article_id: string | null;
  salary_finance_article: Pick<SalaryFinanceArticle, 'id' | 'name'> | null;
};

export type EmployeePayrollSettingsPayload = {
  data: EmployeePayrollSettings;
};

export type PayrollRecalculationStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type PayrollRecalculation = {
  id: string;
  company_id: string;
  period_from: string;
  period_to: string;
  status: PayrollRecalculationStatus;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type PayrollRecalculationPayload = {
  data: PayrollRecalculation | null;
};

export type EmployeeBankDetail = {
  id: string;
  employee_id: string;
  details: string;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeBankDetailPayload = {
  data?: EmployeeBankDetail | null;
};

export type EmployeePayrollCalculationDetail = {
  project_id: string | null;
  project_name: string | null;
  own_seconds: number;
  supervised_seconds: number;
  duration_seconds: number;
  amount_kopecks: number;
  finance_ids: string[];
};

export type PayrollFormulaRange = {
  project_hours_type: PayrollProjectHoursType;
  from_hours: number;
  to_hours: number | null;
  rate_kopecks: number;
  position: number;
  calculation_hours_seconds: number;
  is_reached: boolean;
};

export type PayrollFormulaProjectRate = {
  project_id: string;
  project_name: string;
  rate_kopecks: number;
  hours_seconds: number;
  amount_kopecks: number;
};

export type PayrollFormulaRegularLine = {
  project_hours_type: PayrollProjectHoursType;
  from_hours: number | null;
  to_hours: number | null;
  rate_kopecks: number;
  hours_seconds: number;
  amount_kopecks: number;
};

export type PayrollFormula = {
  rate_id: string | null;
  rate_effective_from: string | null;
  rate_type: EmployeeRateType;
  base_rate_kopecks: number | null;
  is_advanced: boolean;
  default_rate_kopecks: number | null;
  split_by_project_type: boolean;
  hours_scope: PayrollHoursScope;
  range_calculation_method: PayrollRangeCalculationMethod | null;
  calculation_hours_seconds: number;
  project_hours_seconds: Record<PayrollProjectHoursType, number>;
  reached_range: PayrollFormulaRange | null;
  reached_ranges: PayrollFormulaRange[];
  ranges: PayrollFormulaRange[];
  project_rates?: PayrollFormulaProjectRate[];
  regular_lines?: PayrollFormulaRegularLine[];
  regular_from?: string;
  regular_to?: string;
  previous_part?: { from: string; to: string; amount_kopecks: number } | null;
};

export type EmployeePayrollCalculationRow = {
  period_from: string;
  period_to: string;
  own_seconds: number;
  supervised_seconds: number;
  total_seconds: number;
  amount_kopecks: number;
  finance_ids: string[];
  details: EmployeePayrollCalculationDetail[];
  formulas: PayrollFormula[];
};

export type EmployeePayrollCalculationPayload = {
  from: string;
  to: string;
  data?: EmployeePayrollCalculationRow[];
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
};

export type TaskCommentAttachment = {
  id: string;
  comment_id: string;
  project_id: string;
  task_id: string;
  original_name: string;
  mime_type?: string | null;
  size_bytes?: number;
  download_url?: string;
  created_at?: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  text?: string | null;
  created_at?: string;
  updated_at?: string;
  author?: {
    id: string;
    name?: string;
    last_name?: string;
    email?: string;
  };
  attachments?: TaskCommentAttachment[];
};

export type TaskCommentIndexPayload = {
  data?: TaskComment[];
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  company_id: string;
  original_name: string;
  mime_type: string;
  size: number;
  download_url: string;
  created_at: string;
  updated_at: string;
  uploader: {
    id: string;
    name: string;
    last_name: string;
    email: string;
  } | null;
};

export type TaskAttachmentIndexPayload = {
  data: TaskAttachment[];
};
export type TaskActivityEvent =
  | 'created'
  | 'updated'
  | 'status_updated'
  | 'public_link_created'
  | 'public_link_deleted'
  | 'client_status_updated'
  | 'client_message_added'
  | string;

export type TaskActivityChangeSet = {
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  estimation?: number | string | null;
  task_status_column_name?: string | null;
  assignees?: string[];
  [key: string]: unknown;
};

export type TaskActivity = {
  id: number | string;
  event: TaskActivityEvent;
  description?: string | null;
  user?: {
    id: string;
    name: string;
  } | null;
  changes?: {
    attributes?: TaskActivityChangeSet;
    old?: TaskActivityChangeSet;
  };
  created_at?: string;
};

export type TaskActivityIndexPayload = {
  data?: TaskActivity[];
};

export type KnowledgeBaseAccessUser = {
  id: string;
  name: string;
  last_name: string | null;
  email: string;
  role: string;
  role_label: string;
  avatar_url: string | null;
  position: string | null;
};

export type KnowledgeBaseAccess = {
  roles: RoleOption[];
  users: KnowledgeBaseAccessUser[];
};

export type KnowledgeBaseArticle = {
  id: string;
  folder_id: string | null;
  folder?: {
    id: string;
    name: string;
  } | null;
  title: string;
  content: string;
  is_archive: boolean;
  is_pinned: boolean;
  is_draft: boolean;
  company_id: string;
  access: KnowledgeBaseAccess;
  author: {
    id: string;
    name: string;
    last_name: string | null;
    email: string;
    role: string;
    avatar_url: string | null;
    position: string | null;
  } | null;
  created_at: string | null;
  updated_at: string | null;
};

export type KnowledgeBaseArticleForm = {
  folder_id: string | null;
  title: string;
  content: string;
  is_archive: boolean;
  is_pinned: boolean;
};

export type KnowledgeBaseArticleCreatePayload = {
  folder_id?: string | null;
  access?: {
    roles?: string[];
    user_ids?: string[];
  };
};

export type KnowledgeBaseArticleIndexPayload = {
  data?: KnowledgeBaseArticle[];
};

export type KnowledgeBaseFolder = {
  id: string;
  name: string;
  is_archive: boolean;
  company_id: string;
  access: KnowledgeBaseAccess;
  created_at: string | null;
  updated_at: string | null;
};

export type KnowledgeBaseFolderIndexPayload = {
  data?: KnowledgeBaseFolder[];
};

export type KnowledgeBaseFolderCreatePayload = {
  name: string;
  access?: {
    roles?: string[];
    user_ids?: string[];
  };
};

export type KnowledgeBaseFolderUpdatePayload = {
  name: string | null;
  is_archive: boolean | null;
};

export type KnowledgeBaseFolderAccessPayload = {
  roles: string[];
  user_ids: string[];
};

export type KnowledgeBaseArticleAccessPayload = {
  roles: string[];
  user_ids: string[];
};

export type KnowledgeBaseImageUploadPayload = {
  url: string;
};

export type AuthPayload = {
  user: User;
};

export type ApiErrorBody = {
  message?: string;
  error?: string;
  error_code?: string;
  feature?: TariffFeature;
  email?: string;
  errors?: Record<string, string[]>;
  conflict?: {
    started_at?: number;
    ended_at?: number;
  };
};

export type ApiMutationResponse = {
  message?: string;
};

export type EmployeeUpdatePayload = {
  first_name: string;
  last_name: string;
  role: string;
  role_id?: string;
  position: string | null;
  birthday: string | null;
  phone: string | null;
  socials: Record<string, string>;
  skills: string | null;
  payload?: Record<string, unknown> | null;
  status: EmployeeStatus;
  archived_at?: string | null;
  weekly_plan_seconds?: number | null;
};

export type EmployeeBlockPayload = {
  blocked: boolean;
};

export type ProjectEditorForm = {
  projectId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  client_id: string;
  manager_payment_method: string;
  is_internal: boolean;
  exclude_from_payroll: boolean;
  payroll_exclusion_scope: ProjectPayrollExclusionScope;
  payroll_excluded_employee_ids: string[];
  // Поле ввода «Недельный лимит, ч» во вкладке «О проекте».
  weekly_limit_hours?: string;
};

export type ProjectUpdatePayload = Omit<ProjectEditorForm, 'weekly_limit_hours'> & {
  // undefined — не менять, null — лимит не задан.
  weekly_limit_seconds?: number | null;
};

export type TrackerSettings = {
  default_task_status_name: string;
  client_task_status_name: string;
  available_statuses: string[];
};

export type FinanceSettings = {
  default_salary_finance_article_id: string | null;
  default_fixed_absence_finance_article_id: string | null;
  calculate_daily_payroll: boolean;
  default_salary_finance_article?: SalaryFinanceArticle | null;
  default_fixed_absence_finance_article?: SalaryFinanceArticle | null;
};

export type PaginatedResponse<TItem> = {
  data?: TItem[];
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
    max_employees?: number;
    total_company_employees?: number;
  };
};

export type RouterLike = {
  asPath: string;
  pathname: string;
  push: (_path: string) => void;
  replace: (_path: string) => void;
};

export type AppMenuItem = {
  id: string;
  label: string;
  path: string;
};

export type CompanyRequisites = {
  legal_name?: string;
  address?: string;
  inn?: string;
  kpp?: string;
  phone?: string;
  contact_email?: string;
  ogrn?: string;
  mail_address?: string;
};

export type CompanySettings = {
  requisites: CompanyRequisites | null;
  timezone: string;
  unestimated_task_limit_seconds: number;
};

export type TaskClientMessageAttachment = {
  id: string;
  original_name: string;
  mime_type?: string | null;
  download_url?: string;
};

export type TaskClientMessage = {
  id: string;
  task_id: string;
  text?: string | null;
  is_from_client: boolean;
  created_at?: string;
  author_name?: string | null;
  author?: {
    id: string;
    name?: string;
    last_name?: string;
  } | null;
  attachments: TaskClientMessageAttachment[];
};

// Согласование запрашивается у каждой задачи; «approved» ставит только клиент.
export type TaskClientApprovalStatus = 'pending' | 'approved';

export type TaskClientMessagesResponse = {
  client_approval_status: TaskClientApprovalStatus | null;
  data: TaskClientMessage[];
};

export type TaskPublicLink = {
  id: string;
  task_id: string;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

export type PublicTaskAttachment = {
  id: string;
  original_name: string;
  mime_type?: string | null;
  size: number;
};

export type PublicTask = {
  id: string;
  title: string;
  description?: string;
  // Оценка в секундах.
  estimation?: number | null;
  deadline?: string | null;
  client_approval_status: TaskClientApprovalStatus | null;
  project_name?: string;
  // Задача архивного проекта открыта только для просмотра.
  is_read_only?: boolean;
  attachments?: PublicTaskAttachment[];
};

export type PublicTaskData = {
  data: {
    task: PublicTask;
    messages: TaskClientMessage[];
  };
};
