import type {
  ApiMutationResponse,
  Client,
  ClientContact,
  ClientPayload,
  ClientFlowAccount,
  ClientLegalEntity,
  ClientLegalEntityBankDetail,
  DeleteTimeSegmentPayload,
  EmployeeBankDetail,
  EmployeeBankDetailPayload,
  EmployeeAbsence,
  EmployeeAbsenceCalendarPayload,
  EmployeeAbsenceFixedDailyAmountPayload,
  EmployeeAbsenceFixedDailyAmountMonths,
  EmployeeAbsenceForm,
  EmployeeAbsenceIndexPayload,
  EmployeeAbsencePayload,
  EmployeeDayTimelinePayload,
  EmployeeDocument,
  EmployeeDocumentIndexPayload,
  EmployeePayrollCalculationPayload,
  PayrollRecalculationPayload,
  EmployeePayrollSettingsPayload,
  EmployeeRate,
  EmployeeRateCurrentPayload,
  EmployeeRateEmployeesPayload,
  EmployeeRateForm,
  EmployeeRateIndexPayload,
  EmployeeRateSettingForm,
  Finance,
  FinanceArticle,
  FinanceArticlePayload,
  FinanceFilters,
  FinanceSettings,
  FinanceSummary,
  FinancePayload,
  FinanceType,
  KnowledgeBaseArticle,
  KnowledgeBaseArticleAccessPayload,
  KnowledgeBaseArticleCreatePayload,
  KnowledgeBaseArticleForm,
  KnowledgeBaseFolder,
  KnowledgeBaseFolderAccessPayload,
  KnowledgeBaseFolderCreatePayload,
  KnowledgeBaseFolderIndexPayload,
  KnowledgeBaseFolderUpdatePayload,
  KnowledgeBaseImageUploadPayload,
  KnowledgeBaseArticleIndexPayload,
  ManualTimeForm,
  MoveTimeSegmentPayload,
  PaginatedResponse,
  PlannedExpense,
  PlannedExpensePayment,
  PlannedExpensePayload,
  Project,
  ProjectDefaultEntranceArticle,
  ProjectCreatorUpdatePayload,
  ProjectDetails,
  ProjectDocument,
  ProjectDocumentIndexPayload,
  ProjectUpdatePayload,
  ProjectForm,
  ProjectNote,
  ProjectNoteForm,
  ProjectNoteIndexPayload,
  ProjectRate,
  ProjectAssignmentHistory,
  ProjectAssignmentHistoryForm,
  ProjectActivityHistory,
  ProjectActivityHistoryForm,
  Tag,
  TrackerSettings,
  ReportGroupBy,
  OverrunReportRequest,
  OverrunReportResponse,
  StaleTasksReportRequest,
  StaleTasksReportResponse,
  LimitReportRequest,
  LimitReportResponse,
  HoursChartReportRequest,
  HoursChartReportResponse,
  TaskReportPayload,
  TimeReportRequest,
  TimeReportResponse,
  Skill,
  TaskBoardResponse,
  TaskCreateForm,
  TaskComment,
  TaskClientMessage,
  TaskClientMessagesResponse,
  TaskPublicLink,
  TaskAttachment,
  TaskCommentIndexPayload,
  TaskAttachmentIndexPayload,
  TaskActivityIndexPayload,
  TaskStatusColumn,
  TaskStatusColumnForm,
  User,
  UserBoardResponse,
  Template,
  Task,
  CompanyRequisites,
  CompanySettings,
} from '../../types/app';
import { buildQuery, type QueryValue } from '../core/query';
import type {
  FinanceAnalyticsClientRow,
  FinanceAnalyticsEmployees,
  FinanceAnalyticsList,
  FinanceAnalyticsManagerRow,
  FinanceAnalyticsOverview,
  FinanceAnalyticsProjectRow,
  FinanceAnalyticsQuery,
} from '../../types/financeAnalytics';
import type {
  ManagerReportFilters,
  ManagerReportPayload,
} from '../../types/managerReport';
import type {
  PayrollPayout,
  PayrollPayoutArticle,
  PayrollPayoutCreatePayload,
  PayrollPayoutDebts,
  PayrollPayoutKind,
  PayrollPayoutReport,
  PayrollPayoutReportQuery,
  PayrollPayoutSettings,
  PayrollPayoutSheet,
} from '../../types/payrollPayouts';
import type { PayrollSummary, PayrollSummaryQuery } from '../../types/payrollSummary';
import type {
  FinancialResultsClientRow,
  FinancialResultsList,
  FinancialResultsManagerRow,
  FinancialResultsOverview,
  FinancialResultsProjectRow,
  FinancialResultsQuery,
} from '../../types/financialResults';
import type {
  TariffPlan,
  CurrentSubscription,
  InvoiceChangeResponse,
  InvoicesResponse,
  CalculateTariffResponse,
  Requisites,
  Invoice,
} from '../../types/billing';

export function createWorkspaceApi(
  request: <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>,
) {
  const employeesPrefix = '/employees';
  const projectsPrefix = '/projects';
  const clientsPrefix = '/clients';
  const clientPrefix = (clientId: string) => `${clientsPrefix}/${clientId}`;
  const clientContactsPrefix = (clientId: string) => `${clientPrefix(clientId)}/contacts`;
  const clientLegalEntitiesPrefix = (clientId: string) =>
    `${clientPrefix(clientId)}/legal-entities`;
  const clientLegalEntityPrefix = (clientId: string, legalEntityId: string) =>
    `${clientLegalEntitiesPrefix(clientId)}/${legalEntityId}`;
  const clientBankDetailsPrefix = (clientId: string, legalEntityId: string) =>
    `${clientLegalEntityPrefix(clientId, legalEntityId)}/bank-details`;
  const projectPrefix = (projectId: string) => `${projectsPrefix}/${projectId}`;
  const projectMembersPrefix = (projectId: string) =>
    `${projectPrefix(projectId)}/members`;
  const templatesPrefix = '/projects/templates';
  const templatePrefix = (templateId: string) => `${templatesPrefix}/${templateId}`;
  const reportsPrefix = '/reports';
  const financesPrefix = '/finance';
  const financeAnalyticsPrefix = `${financesPrefix}/analytics`;
  const financialResultsPrefix = `${financesPrefix}/financial-results`;
  const financePrefix = (financeId: string) => `${financesPrefix}/${financeId}`;
  const financeArticlesPrefix = '/finance-articles';
  const financeArticlePrefix = (articleId: string) =>
    `${financeArticlesPrefix}/${articleId}`;
  const plannedExpensesPrefix = '/planned-expenses';
  const assignmentHistoriesPrefix = '/project-assignment-histories';
  const activityHistoriesPrefix = '/project-activity-histories';
  const plannedExpensePrefix = (plannedExpenseId: string) =>
    `${plannedExpensesPrefix}/${plannedExpenseId}`;
  const knowledgeBasePrefix = '/knowledge-base';
  const billingPrefix = '/billing';
  const toUnixTimestamp = (value: string) => Math.floor(new Date(value).getTime() / 1000);
  const moneyInputToKopecks = (value: string): number | null => {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;

    const amount = Number(normalized);
    if (Number.isNaN(amount)) return null;

    return Math.round(amount * 100);
  };
  // Ставку из формы проекта отправляем в копейках, без ставки — без валюты и НДС.
  const projectCreatePayload = ({
    rate,
    rate_currency,
    rate_vat,
    ...rest
  }: ProjectForm) => {
    const amount = moneyInputToKopecks(rate);

    return {
      ...rest,
      rate: amount,
      ...(amount !== null
        ? { rate_currency, rate_vat: rate_vat === '' ? null : Number(rate_vat) }
        : {}),
    };
  };
  const absenceFormToPayload = (
    payload: EmployeeAbsenceForm,
  ): EmployeeAbsencePayload => ({
    type: payload.type,
    date_from: payload.date_from,
    date_to: payload.date_to,
    payment_mode: payload.payment_mode,
    fixed_daily_amount:
      payload.payment_mode === 'FIXED'
        ? moneyInputToKopecks(payload.fixed_daily_amount)
        : null,
    coefficient:
      payload.payment_mode === 'FIXED' ? numberInputOrNull(payload.coefficient) : 1,
    comment: payload.comment.trim() || null,
  });
  const numberInputOrNull = (value: string): number | null => {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;

    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
  };
  const settingHasProjectRates = (setting: EmployeeRateSettingForm) =>
    setting.rate_type !== 'WEEKLY_SALARY' &&
    setting.has_project_rates &&
    setting.project_rates.length > 0;
  const rateSettingsToPayload = (settings: EmployeeRateSettingForm[]) =>
    settings
      .filter((setting) => setting.is_advanced || settingHasProjectRates(setting))
      .map((setting) => ({
        rate_type: setting.rate_type,
        is_advanced: setting.is_advanced,
        default_rate: moneyInputToKopecks(setting.default_rate),
        split_by_project_type: setting.split_by_project_type,
        hours_scope: ['OWN', 'SUPERVISED', 'COMPANY'].includes(setting.hours_scope)
          ? setting.hours_scope
          : 'OWN',
        range_calculation_method:
          setting.rate_type === 'WEEKLY_SALARY'
            ? 'THRESHOLD'
            : setting.range_calculation_method,
        // Без расширенной формулы диапазоны не применяются и не сохраняются.
        ranges: setting.is_advanced
          ? setting.ranges.map((range) => ({
              project_hours_type: setting.split_by_project_type
                ? range.project_hours_type
                : 'ALL',
              from_hours: numberInputOrNull(range.from_hours) ?? 0,
              to_hours: numberInputOrNull(range.to_hours),
              rate: moneyInputToKopecks(range.rate),
            }))
          : [],
        project_rates: settingHasProjectRates(setting)
          ? setting.project_rates.map((projectRate) => ({
              project_id: projectRate.project_id,
              rate: moneyInputToKopecks(projectRate.rate),
            }))
          : [],
      }));
  const employeeRateFormToPayload = (payload: EmployeeRateForm) => ({
    salary: moneyInputToKopecks(payload.salary),
    salary_distribution_scope: ['OWN', 'SUPERVISED', 'COMPANY'].includes(
      payload.salary_distribution_scope,
    )
      ? payload.salary_distribution_scope
      : 'OWN',
    hourly_rate: moneyInputToKopecks(payload.hourly_rate),
    supervised_hourly_rate: moneyInputToKopecks(payload.supervised_hourly_rate),
    company_hourly_rate: moneyInputToKopecks(payload.company_hourly_rate),
    exclude_from_supervised_hours: payload.exclude_from_supervised_hours,
    effective_from: payload.effective_from,
    rate_settings: rateSettingsToPayload(payload.rate_settings),
  });
  const normalizeFinanceSettings = (settings: FinanceSettings): FinanceSettings => ({
    ...settings,
    default_salary_finance_article_id: settings.default_salary_finance_article_id ?? null,
    default_fixed_absence_finance_article_id:
      settings.default_fixed_absence_finance_article_id ?? null,
    calculate_daily_payroll: settings.calculate_daily_payroll ?? false,
  });
  const timeValueToSeconds = (value?: string): number | null => {
    if (!value) return null;
    if (!value.includes(':')) {
      value += ':00';
    }
    const trimmed = value.trim();
    if (!trimmed) return null;

    const [rawHours, rawMinutes] = trimmed.split(':');
    const hours = Number(rawHours);
    const minutes = Number(rawMinutes);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return hours * 3600 + minutes * 60;
  };

  return {
    workspace: {
      employees: {
        getMany: (params: Record<string, string | number>) =>
          request<PaginatedResponse<User>>(`${employeesPrefix}${buildQuery(params)}`),
      },

      clients: {
        getMany: (params: Record<string, QueryValue>) =>
          request<PaginatedResponse<Client>>(`${clientsPrefix}${buildQuery(params)}`),

        create: (payload: ClientPayload) =>
          request<Client>(clientsPrefix, {
            method: 'POST',
            body: JSON.stringify({
              name: payload.name,
              description: payload.description.trim() || null,
              weekly_limit_seconds: payload.weekly_limit_seconds,
            }),
          }),

        getDetails: (clientId: string) => request<Client>(clientPrefix(clientId)),

        // Без weekly_limit_seconds лимит клиента не меняется: JSON.stringify пропускает undefined.
        update: (clientId: string, payload: ClientPayload) =>
          request<Client>(clientPrefix(clientId), {
            method: 'PATCH',
            body: JSON.stringify({
              name: payload.name,
              description: payload.description.trim() || null,
              weekly_limit_seconds: payload.weekly_limit_seconds,
            }),
          }),

        delete: (clientId: string) =>
          request<ApiMutationResponse>(clientPrefix(clientId), {
            method: 'DELETE',
          }),

        flowAccounts: (clientId: string) =>
          request<{ data: ClientFlowAccount[] }>(
            `${clientPrefix(clientId)}/flow-accounts`,
          ).then((response) => response.data ?? []),
        flowProjects: (clientId: string) =>
          request<{ data: { id: string; name: string }[] }>(
            `${clientPrefix(clientId)}/flow-projects`,
          ).then((response) => response.data ?? []),
        createFlowAccount: (clientId: string, payload: Record<string, unknown>) =>
          request<{ data: ClientFlowAccount; invite_url: string }>(
            `${clientPrefix(clientId)}/flow-accounts`,
            {
              method: 'POST',
              body: JSON.stringify(payload),
            },
          ),
        updateFlowAccount: (
          clientId: string,
          accountId: string,
          payload: Record<string, unknown>,
        ) =>
          request<{ data: ClientFlowAccount }>(
            `${clientPrefix(clientId)}/flow-accounts/${accountId}`,
            { method: 'PATCH', body: JSON.stringify(payload) },
          ).then((response) => response.data),
        sendFlowPasswordLink: (clientId: string, accountId: string) =>
          request<{ invite_url: string }>(
            `${clientPrefix(clientId)}/flow-accounts/${accountId}/password-link`,
            { method: 'POST' },
          ),
      },

      clientContacts: {
        getMany: (clientId: string) =>
          request<{ data?: ClientContact[] }>(clientContactsPrefix(clientId)).then(
            (response) => response.data ?? [],
          ),

        create: (clientId: string, payload: ClientContact) =>
          request<ClientContact>(clientContactsPrefix(clientId), {
            method: 'POST',
            body: JSON.stringify(payload),
          }),

        get: (clientId: string, contactId: string) =>
          request<ClientContact>(`${clientContactsPrefix(clientId)}/${contactId}`),

        update: (clientId: string, contactId: string, payload: ClientContact) =>
          request<ClientContact>(`${clientContactsPrefix(clientId)}/${contactId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        delete: (clientId: string, contactId: string) =>
          request<ApiMutationResponse>(`${clientContactsPrefix(clientId)}/${contactId}`, {
            method: 'DELETE',
          }),
      },

      clientLegalEntities: {
        getMany: (clientId: string) =>
          request<{ data?: ClientLegalEntity[] }>(
            clientLegalEntitiesPrefix(clientId),
          ).then((response) => response.data ?? []),

        create: (clientId: string, payload: ClientLegalEntity) =>
          request<ClientLegalEntity>(clientLegalEntitiesPrefix(clientId), {
            method: 'POST',
            body: JSON.stringify(payload),
          }),

        get: (clientId: string, legalEntityId: string) =>
          request<ClientLegalEntity>(clientLegalEntityPrefix(clientId, legalEntityId)),

        update: (clientId: string, legalEntityId: string, payload: ClientLegalEntity) =>
          request<ClientLegalEntity>(clientLegalEntityPrefix(clientId, legalEntityId), {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        delete: (clientId: string, legalEntityId: string) =>
          request<ApiMutationResponse>(clientLegalEntityPrefix(clientId, legalEntityId), {
            method: 'DELETE',
          }),
      },

      clientBankDetails: {
        getMany: (clientId: string, legalEntityId: string) =>
          request<{ data?: ClientLegalEntityBankDetail[] }>(
            clientBankDetailsPrefix(clientId, legalEntityId),
          ).then((response) => response.data ?? []),

        create: (
          clientId: string,
          legalEntityId: string,
          payload: ClientLegalEntityBankDetail,
        ) =>
          request<ClientLegalEntityBankDetail>(
            clientBankDetailsPrefix(clientId, legalEntityId),
            {
              method: 'POST',
              body: JSON.stringify(payload),
            },
          ),

        get: (clientId: string, legalEntityId: string, bankDetailId: string) =>
          request<ClientLegalEntityBankDetail>(
            `${clientBankDetailsPrefix(clientId, legalEntityId)}/${bankDetailId}`,
          ),

        update: (
          clientId: string,
          legalEntityId: string,
          bankDetailId: string,
          payload: ClientLegalEntityBankDetail,
        ) =>
          request<ClientLegalEntityBankDetail>(
            `${clientBankDetailsPrefix(clientId, legalEntityId)}/${bankDetailId}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          ),

        delete: (clientId: string, legalEntityId: string, bankDetailId: string) =>
          request<ApiMutationResponse>(
            `${clientBankDetailsPrefix(clientId, legalEntityId)}/${bankDetailId}`,
            {
              method: 'DELETE',
            },
          ),
      },

      employeeDocuments: {
        getForEmployee: (employeeId: string) =>
          request<EmployeeDocumentIndexPayload>(
            `${employeesPrefix}/${employeeId}/documents`,
          ).then((response) => response.data ?? []),

        uploadForEmployee: (employeeId: string, file: File) => {
          const formData = new FormData();
          formData.append('document', file);

          return request<EmployeeDocument>(`${employeesPrefix}/${employeeId}/documents`, {
            method: 'POST',
            body: formData,
          });
        },

        delete: (documentId: string) =>
          request<void>(`/employee-documents/${documentId}`, {
            method: 'DELETE',
          }),
      },

      employeeAbsences: {
        getForEmployee: (employeeId: string, params: Record<string, QueryValue> = {}) =>
          request<EmployeeAbsenceIndexPayload>(
            `${employeesPrefix}/${employeeId}/absences${buildQuery(params)}`,
          ).then((response) => response.data ?? []),

        getCalendarForEmployee: (
          employeeId: string,
          params: Record<string, QueryValue> = {},
        ) =>
          request<EmployeeAbsenceCalendarPayload>(
            `${employeesPrefix}/${employeeId}/absences/calendar${buildQuery(params)}`,
          ),

        createForEmployee: (employeeId: string, payload: EmployeeAbsenceForm) =>
          request<EmployeeAbsence>(`${employeesPrefix}/${employeeId}/absences`, {
            method: 'POST',
            body: JSON.stringify(absenceFormToPayload(payload)),
          }),

        update: (absenceId: string, payload: EmployeeAbsenceForm) =>
          request<EmployeeAbsence>(`/employee-absences/${absenceId}`, {
            method: 'PATCH',
            body: JSON.stringify(absenceFormToPayload(payload)),
          }),

        delete: (absenceId: string) =>
          request<void>(`/employee-absences/${absenceId}`, {
            method: 'DELETE',
          }),

        calculateFixedDailyAmount: (
          employeeId: string,
          payload: { date_from: string; months?: EmployeeAbsenceFixedDailyAmountMonths },
        ) =>
          request<EmployeeAbsenceFixedDailyAmountPayload>(
            `${employeesPrefix}/${employeeId}/absences/calculate-fixed-daily-amount`,
            {
              method: 'POST',
              body: JSON.stringify(payload),
            },
          ).then((response) => response.data),
      },

      employeeRates: {
        getMany: (params: Record<string, QueryValue> = {}) =>
          request<EmployeeRateEmployeesPayload>(
            `/employee-rates${buildQuery(params)}`,
          ).then((response) => ({
            data: response.data ?? [],
            meta: response.meta,
          })),

        getForEmployee: (employeeId: string) =>
          request<EmployeeRateIndexPayload>(
            `${employeesPrefix}/${employeeId}/rates`,
          ).then((response) => response.data ?? []),

        getCurrentForEmployee: (employeeId: string) =>
          request<EmployeeRateCurrentPayload>(
            `${employeesPrefix}/${employeeId}/rates/current`,
          ).then((response) => response.data ?? null),

        createForEmployee: (employeeId: string, payload: EmployeeRateForm) =>
          request<EmployeeRate>(`${employeesPrefix}/${employeeId}/rates`, {
            method: 'POST',
            body: JSON.stringify(employeeRateFormToPayload(payload)),
          }),

        update: (rateId: string, payload: EmployeeRateForm) =>
          request<EmployeeRate>(`/employee-rates/${rateId}`, {
            method: 'PATCH',
            body: JSON.stringify(employeeRateFormToPayload(payload)),
          }),

        delete: (rateId: string) =>
          request<void>(`/employee-rates/${rateId}`, {
            method: 'DELETE',
          }),
      },

      employeeBankDetails: {
        getForEmployee: (employeeId: string) =>
          request<EmployeeBankDetailPayload>(
            `${employeesPrefix}/${employeeId}/bank-details`,
          ).then((response) => response.data ?? null),

        saveForEmployee: (employeeId: string, details: string) =>
          request<EmployeeBankDetailPayload>(
            `${employeesPrefix}/${employeeId}/bank-details`,
            {
              method: 'POST',
              body: JSON.stringify({ details }),
            },
          ).then((response) => response.data as EmployeeBankDetail),
      },

      employeePayrollCalculations: {
        getForEmployee: (employeeId: string, params: Record<string, QueryValue> = {}) =>
          request<EmployeePayrollCalculationPayload>(
            `${employeesPrefix}/${employeeId}/payroll-calculations${buildQuery(params)}`,
          ).then((response) => ({
            ...response,
            data: response.data ?? [],
          })),
      },

      companyPayrollSummary: {
        get: (query: PayrollSummaryQuery = {}) =>
          request<PayrollSummary>(
            `${employeesPrefix}/payroll-summary${buildQuery(query)}`,
          ),
      },

      employeePayrollSettings: {
        getForEmployee: (employeeId: string) =>
          request<EmployeePayrollSettingsPayload>(
            `${employeesPrefix}/${employeeId}/payroll-settings`,
          ).then((response) => response.data),

        updateForEmployee: (employeeId: string, salaryFinanceArticleId: string | null) =>
          request<EmployeePayrollSettingsPayload>(
            `${employeesPrefix}/${employeeId}/payroll-settings`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                salary_finance_article_id: salaryFinanceArticleId,
              }),
            },
          ).then((response) => response.data),
      },

      payrollRecalculations: {
        getForPeriod: (periodFrom: string, periodTo: string) =>
          request<PayrollRecalculationPayload>(
            `/payroll-recalculations${buildQuery({ period_from: periodFrom, period_to: periodTo })}`,
          ).then((response) => response.data ?? null),

        startForPeriod: (periodFrom: string, periodTo: string) =>
          request<PayrollRecalculationPayload>('/payroll-recalculations', {
            method: 'POST',
            body: JSON.stringify({
              period_from: periodFrom,
              period_to: periodTo,
            }),
          }).then((response) => response.data),
      },

      payrollPayouts: {
        getSettings: () => request<PayrollPayoutSettings>('/payroll-payouts/settings'),

        updateSettings: (startMonth: string) =>
          request<PayrollPayoutSettings>('/payroll-payouts/settings', {
            method: 'PUT',
            body: JSON.stringify({ start_month: startMonth }),
          }),

        getSheet: (month?: string | null) =>
          request<PayrollPayoutSheet>(
            `/payroll-payouts/sheet${buildQuery({ month: month ?? undefined })}`,
          ),

        getDebts: () => request<PayrollPayoutDebts>('/payroll-payouts/debts'),

        getReport: (query: PayrollPayoutReportQuery) =>
          request<PayrollPayoutReport>(`/payroll-payouts/report${buildQuery(query)}`),

        create: (payload: PayrollPayoutCreatePayload) =>
          request<{ data: PayrollPayout[] }>('/payroll-payouts', {
            method: 'POST',
            body: JSON.stringify(payload),
          }).then((response) => response.data ?? []),

        delete: (payoutId: string) =>
          request<void>(`/payroll-payouts/${payoutId}`, { method: 'DELETE' }),

        // amount = null возвращает расчётную сумму.
        updatePlan: (payload: {
          employee_id: string;
          month: string;
          kind: PayrollPayoutKind;
          amount: number | null;
        }) =>
          request<void>('/payroll-payouts/plan', {
            method: 'PUT',
            body: JSON.stringify(payload),
          }),

        closeMonth: (month: string) =>
          request<void>('/payroll-payouts/close', {
            method: 'POST',
            body: JSON.stringify({ month }),
          }),

        reopenMonth: (month: string) =>
          request<void>('/payroll-payouts/reopen', {
            method: 'POST',
            body: JSON.stringify({ month }),
          }),

        updateOpening: (employeeId: string, amount: number) =>
          request<void>('/payroll-payouts/opening', {
            method: 'PUT',
            body: JSON.stringify({ employee_id: employeeId, amount }),
          }),
      },

      payrollPayoutArticles: {
        getMany: () =>
          request<{ data?: PayrollPayoutArticle[] }>('/payroll-payout-articles').then(
            (response) => response.data ?? [],
          ),

        create: (name: string) =>
          request<PayrollPayoutArticle>('/payroll-payout-articles', {
            method: 'POST',
            body: JSON.stringify({ name }),
          }),

        update: (articleId: string, name: string) =>
          request<PayrollPayoutArticle>(`/payroll-payout-articles/${articleId}`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
          }),

        // Статья с выплатами не удаляется, а уходит в архив: тогда в ответе её новое состояние.
        delete: (articleId: string) =>
          request<{ data: PayrollPayoutArticle | null }>(
            `/payroll-payout-articles/${articleId}`,
            { method: 'DELETE' },
          ).then((response) => response.data ?? null),

        restore: (articleId: string) =>
          request<PayrollPayoutArticle>(`/payroll-payout-articles/${articleId}/restore`, {
            method: 'POST',
          }),
      },

      projects: {
        getMany: (params?: Record<string, string | number>) =>
          request<PaginatedResponse<Project>>(`${projectsPrefix}${buildQuery(params)}`),

        getDefaultEntranceArticle: (projectId: string) =>
          request<{ data: ProjectDefaultEntranceArticle }>(
            `${projectPrefix(projectId)}/default-entrance-article`,
          ).then((response) => response.data),

        updateDefaultEntranceArticle: (projectId: string, articleId: string | null) =>
          request<{ data: ProjectDefaultEntranceArticle }>(
            `${projectPrefix(projectId)}/default-entrance-article`,
            {
              method: 'PATCH',
              body: JSON.stringify({ default_entrance_finance_article_id: articleId }),
            },
          ).then((response) => response.data),

        getDefaultEntranceArticles: (projectIds: string[]) => {
          const uniqueIds = [...new Set(projectIds)];
          if (uniqueIds.length < 1 || uniqueIds.length > 100) {
            throw new Error('Передайте от 1 до 100 уникальных проектов.');
          }
          const query = new URLSearchParams();
          uniqueIds.forEach((id) => query.append('project_ids[]', id));
          return request<{ data: ProjectDefaultEntranceArticle[] }>(
            `${projectsPrefix}/default-entrance-articles?${query.toString()}`,
          ).then((response) => response.data);
        },

        getDetails: (projectId: string) =>
          request<ProjectDetails>(projectPrefix(projectId)),

        getBoard: (projectId: string) =>
          request<TaskBoardResponse>(`${projectPrefix(projectId)}/tasks`).then(
            (response) => ({
              columns: response.columns ?? [],
              data: response.data ?? [],
            }),
          ),

        getTasks: (projectId: string) =>
          request<TaskBoardResponse>(`${projectPrefix(projectId)}/tasks`).then(
            (response) => response.data ?? [],
          ),

        getTask: (projectId: string, taskId: string) =>
          request<Task>(`${projectPrefix(projectId)}/tasks/${taskId}`),

        getForUser: (projectId: string, userId: string) =>
          request<TaskBoardResponse>(`/projects/${projectId}/user/${userId}/tasks`).then(
            (response) => response.data ?? [],
          ),

        createTask: (
          projectId: string,
          payload: Partial<TaskCreateForm> & {
            status_column_id?: string | null;
            parent_task_id?: string | null;
          },
        ) =>
          request<Task>(`${projectPrefix(projectId)}/tasks`, {
            method: 'POST',
            body: JSON.stringify({
              ...payload,
              priority: payload.priority || null,
              estimation: timeValueToSeconds(payload.estimation),
              status_column_id: payload.status_column_id ?? null,
              parent_task_id: payload.parent_task_id ?? null,
            }),
          }),

        updateTask: (
          projectId: string,
          taskId: string,
          payload: Partial<TaskCreateForm> & { parent_task_id?: string | null },
        ) =>
          request<Task>(`${projectPrefix(projectId)}/tasks/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              ...payload,
              priority: payload.priority || null,
              estimation: timeValueToSeconds(payload.estimation),
              parent_task_id: payload.parent_task_id ?? null,
            }),
          }),

        deleteTask: (projectId: string, taskId: string) =>
          request<void>(`${projectPrefix(projectId)}/tasks/${taskId}`, {
            method: 'DELETE',
          }),

        uploadTaskDescriptionImage: (projectId: string, taskId: string, file: File) => {
          const formData = new FormData();
          formData.append('image', file);

          return request<{ url: string }>(
            `${projectPrefix(projectId)}/tasks/${taskId}/description-images`,
            {
              method: 'POST',
              body: formData,
            },
          );
        },

        importTaskDescriptionImage: (projectId: string, taskId: string, url: string) =>
          request<{ url: string }>(
            `${projectPrefix(projectId)}/tasks/${taskId}/description-images`,
            {
              method: 'POST',
              body: JSON.stringify({ url }),
            },
          ),

        moveTask: (
          projectId: string,
          taskId: string,
          payload: { status_column_id: string; destination_index: number },
        ) =>
          request<TaskBoardResponse>(`${projectPrefix(projectId)}/tasks/${taskId}/move`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }).then((response) => ({
            columns: response.columns ?? [],
            data: response.data ?? [],
          })),

        create: (payload: ProjectForm) =>
          request<Project>(projectsPrefix, {
            method: 'POST',
            body: JSON.stringify(projectCreatePayload(payload)),
          }),

        createFromTemplate: (templateId: string, payload: ProjectForm) =>
          request<Project>(`${projectsPrefix}/from-template/${templateId}`, {
            method: 'POST',
            body: JSON.stringify(projectCreatePayload(payload)),
          }),

        update: (projectId: string, payload: ProjectUpdatePayload) =>
          request<Project>(projectPrefix(projectId), {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        updateProjectCreator: (projectId: string, payload: ProjectCreatorUpdatePayload) =>
          request<Project>(`${projectPrefix(projectId)}/creator`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        delete: (projectId: string) =>
          request<ApiMutationResponse>(projectPrefix(projectId), {
            method: 'DELETE',
          }),

        assignEmployee: (
          projectId: string,
          userId: string,
          isPm = false,
          isPmPayrollEnabled = false,
        ) =>
          request<Project>(projectMembersPrefix(projectId), {
            method: 'POST',
            body: JSON.stringify({
              user_id: userId,
              is_pm: isPm,
              is_pm_payroll_enabled: isPm ? isPmPayrollEnabled : false,
            }),
          }),

        removeEmployee: (projectId: string, userId: string) =>
          request<Project>(`${projectMembersPrefix(projectId)}/${userId}`, {
            method: 'DELETE',
          }),

        getPinned: () =>
          request<unknown>('/profile/pinned-projects').then((response) => {
            const res = response as { data?: unknown } | null;
            const data = res?.data ?? response ?? [];
            const items = Array.isArray(data) ? data : [];
            return items.map((item: unknown) => {
              if (typeof item === 'string' || typeof item === 'number') {
                return String(item);
              }
              const obj = item as Record<string, unknown> | null;
              const id = obj?.project_id ?? obj?.id;
              return id != null ? String(id) : String(item);
            });
          }),

        getSidebarOrder: () =>
          request<unknown>('/profile/project-sidebar-order').then((response) => {
            const res = response as { data?: unknown } | null;
            const data = res?.data ?? response ?? [];
            return Array.isArray(data) ? data.map((item) => String(item)) : [];
          }),

        reorderSidebar: (projectIds: string[]) =>
          request<{ data?: string[] }>('/profile/project-sidebar-order', {
            method: 'PUT',
            body: JSON.stringify({ project_ids: projectIds }),
          }).then((response) => response.data ?? []),

        pin: (projectId: string) =>
          request<ApiMutationResponse>(`/profile/pinned-projects/${projectId}`, {
            method: 'POST',
          }),

        unpin: (projectId: string) =>
          request<ApiMutationResponse>(`/profile/pinned-projects/${projectId}`, {
            method: 'DELETE',
          }),
      },

      taskDirect: {
        getDirectTask: (taskId: string) => request<Task>(`/tasks/direct/${taskId}`),
        updateDirectTask: (
          taskId: string,
          payload: Partial<TaskCreateForm> & { parent_task_id?: string | null },
        ) =>
          request<Task>(`/tasks/direct/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              ...payload,
              priority: payload.priority || null,
              estimation: timeValueToSeconds(payload.estimation),
              parent_task_id: payload.parent_task_id ?? null,
            }),
          }),
      },

      tags: {
        getMany: (params: { search?: string } = {}) =>
          request<{ data?: Tag[] }>(`${projectsPrefix}/tags${buildQuery(params)}`).then(
            (response) => response.data ?? [],
          ),

        syncForProject: (projectId: string, tags: string[]) =>
          request<Project>(`${projectPrefix(projectId)}/tags`, {
            method: 'PUT',
            body: JSON.stringify({ tags }),
          }),
      },

      skills: {
        getMany: (params: { search?: string } = {}) =>
          request<{ data?: Skill[] }>(`/skills${buildQuery(params)}`).then(
            (response) => response.data ?? [],
          ),
      },

      projectDocuments: {
        getForProject: (projectId: string) =>
          request<ProjectDocumentIndexPayload>(
            `${projectPrefix(projectId)}/documents`,
          ).then((response) => response.data ?? []),

        uploadForProject: (projectId: string, file: File, isClientVisible = true) => {
          const formData = new FormData();
          formData.append('document', file);
          formData.append('is_client_visible', isClientVisible ? '1' : '0');

          return request<ProjectDocument>(`${projectPrefix(projectId)}/documents`, {
            method: 'POST',
            body: formData,
          });
        },

        updateClientVisibility: (documentId: string, isClientVisible: boolean) =>
          request<ProjectDocument>(`/project-documents/${documentId}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_client_visible: isClientVisible }),
          }),

        delete: (documentId: string) =>
          request<void>(`/project-documents/${documentId}`, {
            method: 'DELETE',
          }),
      },

      projectTaskStatusColumns: {
        getForProject: (projectId: string) =>
          request<{ data?: TaskStatusColumn[] }>(
            `${projectPrefix(projectId)}/task-status-columns`,
          ).then((response) => response.data ?? []),

        create: (projectId: string, payload: TaskStatusColumnForm) =>
          request<TaskStatusColumn>(`${projectPrefix(projectId)}/task-status-columns`, {
            method: 'POST',
            body: JSON.stringify({
              name: payload.name,
              slug: payload.slug,
              color: payload.color || null,
              is_default: payload.is_default ?? false,
              is_final: payload.is_final ?? false,
            }),
          }),

        update: (projectId: string, columnId: string, payload: TaskStatusColumnForm) =>
          request<TaskStatusColumn>(
            `${projectPrefix(projectId)}/task-status-columns/${columnId}`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                name: payload.name,
                color: payload.color || null,
                is_default: payload.is_default ?? false,
                is_final: payload.is_final ?? false,
              }),
            },
          ),

        delete: (projectId: string, columnId: string) =>
          request<void>(`${projectPrefix(projectId)}/task-status-columns/${columnId}`, {
            method: 'DELETE',
          }),

        reorder: (projectId: string, columns: Array<{ id: string; position: number }>) =>
          request<{ data?: TaskStatusColumn[] }>(
            `${projectPrefix(projectId)}/task-status-columns/reorder`,
            {
              method: 'PATCH',
              body: JSON.stringify({ columns }),
            },
          ).then((response) => response.data ?? []),
      },

      settings: {
        getTracker: () => request<TrackerSettings>('/settings/tracker'),

        updateTracker: (
          payload: Partial<
            Pick<TrackerSettings, 'default_task_status_name' | 'client_task_status_name'>
          >,
        ) =>
          request<TrackerSettings>('/settings/tracker', {
            method: 'PUT',
            body: JSON.stringify(payload),
          }),

        getFinance: () =>
          request<FinanceSettings>('/settings/finance').then(normalizeFinanceSettings),

        updateFinance: (payload: FinanceSettings) =>
          request<FinanceSettings>('/settings/finance', {
            method: 'PUT',
            body: JSON.stringify({
              default_salary_finance_article_id:
                payload.default_salary_finance_article_id,
              default_fixed_absence_finance_article_id:
                payload.default_fixed_absence_finance_article_id,
              calculate_daily_payroll: payload.calculate_daily_payroll,
            }),
          }).then(normalizeFinanceSettings),

        getCompany: () => request<CompanySettings>('/settings/company'),
        getCompanyRequisites: () =>
          request<CompanySettings>('/settings/company').then((res) => res.requisites),
        updateCompanyRequisites: (requisites: CompanyRequisites) =>
          request<CompanySettings>('/settings/company', {
            method: 'PUT',
            body: JSON.stringify({ requisites }),
          }).then((res) => res.requisites),
        updateCompanyTimezone: (timezone: string) =>
          request<CompanySettings>('/settings/company/timezone', {
            method: 'PUT',
            body: JSON.stringify({ timezone }),
          }),
        updateCompanyUnestimatedTaskLimit: (seconds: number) =>
          request<CompanySettings>('/settings/company/unestimated-task-limit', {
            method: 'PUT',
            body: JSON.stringify({ unestimated_task_limit_seconds: seconds }),
          }),
      },

      projectNotes: {
        getForProject: (projectId: string) =>
          request<ProjectNoteIndexPayload>(`${projectPrefix(projectId)}/notes`).then(
            (response) => response.data ?? [],
          ),

        createForProject: (projectId: string, payload: ProjectNoteForm) =>
          request<ProjectNote>(`${projectPrefix(projectId)}/notes`, {
            method: 'POST',
            body: JSON.stringify({
              title: payload.title.trim() === '' ? null : payload.title.trim(),
              content: payload.content,
              visibility: payload.visibility,
              ...(payload.access
                ? {
                    access: {
                      roles: payload.access.roles,
                      user_ids: payload.access.user_ids,
                    },
                  }
                : {}),
            }),
          }),

        update: (noteId: string, payload: ProjectNoteForm) =>
          request<ProjectNote>(`/project-notes/${noteId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              title: payload.title.trim() === '' ? null : payload.title.trim(),
              content: payload.content,
              visibility: payload.visibility,
              ...(payload.access
                ? {
                    access: {
                      roles: payload.access.roles,
                      user_ids: payload.access.user_ids,
                    },
                  }
                : {}),
            }),
          }),

        delete: (noteId: string) =>
          request<void>(`/project-notes/${noteId}`, {
            method: 'DELETE',
          }),

        pin: (noteId: string) =>
          request<ProjectNote>(`/project-notes/${noteId}/pin`, {
            method: 'POST',
          }),

        unpin: (noteId: string) =>
          request<void>(`/project-notes/${noteId}/pin`, {
            method: 'DELETE',
          }),

        uploadImage: (noteId: string, file: File) => {
          const formData = new FormData();
          formData.append('image', file);

          return request<{ url: string }>(`/project-notes/${noteId}/images`, {
            method: 'POST',
            body: formData,
          });
        },

        importImage: (noteId: string, url: string) =>
          request<{ url: string }>(`/project-notes/${noteId}/images`, {
            method: 'POST',
            body: JSON.stringify({ url }),
          }),
      },

      projectRates: {
        getForProject: (projectId: string) =>
          request<{ data?: ProjectRate[] }>(`${projectPrefix(projectId)}/rates`).then(
            (response) => response.data ?? [],
          ),

        getCurrentForProject: (projectId: string) =>
          request<{ data?: ProjectRate | null }>(
            `${projectPrefix(projectId)}/rates/current`,
          ).then((response) => response.data ?? null),

        createForProject: (
          projectId: string,
          payload: {
            rate: string;
            currency: string;
            vat: string;
            effective_from: string;
          },
        ) =>
          request<ProjectRate>(`${projectPrefix(projectId)}/rates`, {
            method: 'POST',
            body: JSON.stringify({
              rate: moneyInputToKopecks(payload.rate),
              currency: payload.currency,
              vat: payload.vat.trim() === '' ? null : Number(payload.vat),
              effective_from: payload.effective_from,
            }),
          }),
      },

      templates: {
        getMany: (params: Record<string, string | number>) =>
          request<PaginatedResponse<Template>>(`${templatesPrefix}${buildQuery(params)}`),

        getDetails: (templateId: string) => request<Template>(templatePrefix(templateId)),

        create: (payload: Record<string, unknown>) =>
          request<Template>(templatesPrefix, {
            method: 'POST',
            body: JSON.stringify(payload),
          }),

        update: (templateId: string, payload: Record<string, unknown>) =>
          request<Template>(templatePrefix(templateId), {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        delete: (templateId: string) =>
          request<ApiMutationResponse>(templatePrefix(templateId), {
            method: 'DELETE',
          }),

        getPinned: () =>
          request<unknown>(`${projectsPrefix}/pinned-templates`).then((response) => {
            const res = response as { data?: unknown } | null;
            const data = res?.data ?? response ?? [];
            const items = Array.isArray(data) ? data : [];
            return items.map((item: unknown) => {
              if (typeof item === 'string' || typeof item === 'number') {
                return String(item);
              }
              const obj = item as Record<string, unknown> | null;
              const id = obj?.template_id ?? obj?.id;
              return id != null ? String(id) : String(item);
            });
          }),

        pin: (templateId: string) =>
          request<ApiMutationResponse>(
            `${projectsPrefix}/pinned-templates/${templateId}`,
            { method: 'POST' },
          ),

        unpin: (templateId: string) =>
          request<ApiMutationResponse>(
            `${projectsPrefix}/pinned-templates/${templateId}`,
            { method: 'DELETE' },
          ),
      },

      employeeProjects: {
        assign: (projectId: string, userId: string) =>
          request<Project>(projectMembersPrefix(projectId), {
            method: 'POST',
            body: JSON.stringify({ user_id: userId }),
          }),

        remove: (projectId: string, userId: string) =>
          request<Project>(`${projectMembersPrefix(projectId)}/${userId}`, {
            method: 'DELETE',
          }),
      },

      projectAssignmentHistories: {
        getByProject: (projectId: string, employeeIds: string[] = []) =>
          request<{ data?: ProjectAssignmentHistory[] }>(
            `${assignmentHistoriesPrefix}/by-project/${projectId}${buildQuery({ employee_ids: employeeIds })}`,
          ).then((response) => response.data ?? []),

        getByUser: (userId: string, projectIds: string[] = []) =>
          request<{ data?: ProjectAssignmentHistory[] }>(
            `${assignmentHistoriesPrefix}/by-user/${userId}${buildQuery({ project_ids: projectIds })}`,
          ).then((response) => response.data ?? []),

        create: (payload: ProjectAssignmentHistoryForm) =>
          request<ProjectAssignmentHistory>(assignmentHistoriesPrefix, {
            method: 'POST',
            body: JSON.stringify(payload),
          }),

        update: (
          historyId: string,
          payload: Omit<ProjectAssignmentHistoryForm, 'project_id' | 'user_id'>,
        ) =>
          request<ProjectAssignmentHistory>(`${assignmentHistoriesPrefix}/${historyId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        delete: (historyId: string) =>
          request<void>(`${assignmentHistoriesPrefix}/${historyId}`, {
            method: 'DELETE',
          }),
      },

      projectActivityHistories: {
        getByProject: (projectId: string) =>
          request<{ data?: ProjectActivityHistory[] }>(
            `${activityHistoriesPrefix}/by-project/${projectId}`,
          ).then((response) => response.data ?? []),

        create: (projectId: string, payload: ProjectActivityHistoryForm) =>
          request<ProjectActivityHistory>(activityHistoriesPrefix, {
            method: 'POST',
            body: JSON.stringify({ project_id: projectId, ...payload }),
          }),

        update: (activityId: string, payload: Partial<ProjectActivityHistoryForm>) =>
          request<ProjectActivityHistory>(`${activityHistoriesPrefix}/${activityId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        delete: (activityId: string) =>
          request<void>(`${activityHistoriesPrefix}/${activityId}`, {
            method: 'DELETE',
          }),
      },

      lists: {
        getAll: () =>
          Promise.all([
            request<PaginatedResponse<User>>(
              '/employees?status=active&per_page=1000',
            ).then((response) => response.data ?? []),
            request<PaginatedResponse<Project>>('/projects?status=all').then(
              (response) => response.data ?? [],
            ),
          ]),
      },

      timeEntries: {
        create: (payload: ManualTimeForm) => {
          const normalizedTaskId = payload.task_id.trim();
          const normalizedTaskTitle = payload.task_title.trim();

          return request<ApiMutationResponse>('/time-entries', {
            method: 'POST',
            body: JSON.stringify({
              ...payload,
              task_id: normalizedTaskId,
              ...(normalizedTaskId === '' && normalizedTaskTitle !== ''
                ? { task_title: normalizedTaskTitle }
                : {}),
              started_at: toUnixTimestamp(payload.started_at),
              ended_at: toUnixTimestamp(payload.ended_at),
            }),
          });
        },
        move: (segmentId: string, payload: MoveTimeSegmentPayload) =>
          request<ApiMutationResponse>(`/time-entries/${segmentId}/move`, {
            method: 'PATCH',
            body: JSON.stringify({
              ...payload,
              move_from: toUnixTimestamp(payload.move_from),
              move_to: toUnixTimestamp(payload.move_to),
            }),
          }),

        deleteInterval: (segmentId: string, payload: DeleteTimeSegmentPayload) =>
          request<ApiMutationResponse>(`/time-entries/${segmentId}/delete-interval`, {
            method: 'PATCH',
            body: JSON.stringify({
              delete_from: toUnixTimestamp(payload.delete_from),
              delete_to: toUnixTimestamp(payload.delete_to),
            }),
          }),
      },

      reports: {
        getTime: <TGroupBy extends ReportGroupBy>(params: TimeReportRequest<TGroupBy>) =>
          request<TimeReportResponse<TGroupBy>>(
            `${reportsPrefix}/time${buildQuery({ ...params })}`,
          ),

        getTasks: (params: Record<string, QueryValue>) =>
          request<TaskReportPayload>(`${reportsPrefix}/tasks${buildQuery(params)}`),

        getDayTimeline: (params: Record<string, string>) =>
          request<EmployeeDayTimelinePayload>(
            `${reportsPrefix}/day-timeline${buildQuery(params)}`,
          ),

        getManagers: (params: ManagerReportFilters) =>
          request<ManagerReportPayload>(
            `${reportsPrefix}/managers${buildQuery({ ...params })}`,
          ),

        getOverrun: (params: OverrunReportRequest) =>
          request<OverrunReportResponse>(
            `${reportsPrefix}/overrun${buildQuery({ ...params })}`,
          ),

        getStaleTasks: (params: StaleTasksReportRequest) =>
          request<StaleTasksReportResponse>(
            `${reportsPrefix}/stale-tasks${buildQuery({ ...params })}`,
          ),

        getLimits: (params: LimitReportRequest) =>
          request<LimitReportResponse>(
            `${reportsPrefix}/limits${buildQuery({ ...params })}`,
          ),

        getHoursChart: (params: HoursChartReportRequest) =>
          request<HoursChartReportResponse>(
            `${reportsPrefix}/hours-chart${buildQuery({ ...params })}`,
          ),
      },

      finances: {
        getMany: (params: FinanceFilters = {}) =>
          request<PaginatedResponse<Finance>>(`${financesPrefix}${buildQuery(params)}`),

        getSummary: (params: FinanceFilters = {}) =>
          request<{ data: FinanceSummary }>(
            `${financesPrefix}/summary${buildQuery(params)}`,
          ).then((response) => response.data),

        export: (format: 'csv' | 'xlsx', params: FinanceFilters = {}) =>
          request<Blob>(`${financesPrefix}/export${buildQuery({ ...params, format })}`),

        get: (financeId: string) => request<Finance>(financePrefix(financeId)),

        create: (payload: FinancePayload) =>
          request<Finance>(financesPrefix, {
            method: 'POST',
            body: JSON.stringify(payload),
          }),

        update: (financeId: string, payload: FinancePayload) =>
          request<Finance>(financePrefix(financeId), {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        delete: (financeId: string) =>
          request<void>(financePrefix(financeId), {
            method: 'DELETE',
          }),
      },

      financeAnalytics: {
        getOverview: (params: FinanceAnalyticsQuery = {}) =>
          request<{ data: FinanceAnalyticsOverview }>(
            `${financeAnalyticsPrefix}/overview${buildQuery(params)}`,
          ).then((response) => response.data),

        getProjects: (params: FinanceAnalyticsQuery = {}) =>
          request<{ data: FinanceAnalyticsList<FinanceAnalyticsProjectRow> }>(
            `${financeAnalyticsPrefix}/projects${buildQuery(params)}`,
          ).then((response) => response.data),

        getManagers: (params: FinanceAnalyticsQuery = {}) =>
          request<{ data: FinanceAnalyticsList<FinanceAnalyticsManagerRow> }>(
            `${financeAnalyticsPrefix}/managers${buildQuery(params)}`,
          ).then((response) => response.data),

        getClients: (params: FinanceAnalyticsQuery = {}) =>
          request<{ data: FinanceAnalyticsList<FinanceAnalyticsClientRow> }>(
            `${financeAnalyticsPrefix}/clients${buildQuery(params)}`,
          ).then((response) => response.data),

        getEmployees: (params: FinanceAnalyticsQuery = {}) =>
          request<{ data: FinanceAnalyticsEmployees }>(
            `${financeAnalyticsPrefix}/employees${buildQuery(params)}`,
          ).then((response) => response.data),
      },

      financialResults: {
        getOverview: (params: FinancialResultsQuery = {}) =>
          request<{ data: FinancialResultsOverview }>(
            `${financialResultsPrefix}/overview${buildQuery(params)}`,
          ).then((response) => response.data),

        getProjects: (params: FinancialResultsQuery = {}) =>
          request<{ data: FinancialResultsList<FinancialResultsProjectRow> }>(
            `${financialResultsPrefix}/projects${buildQuery(params)}`,
          ).then((response) => response.data),

        getManagers: (params: FinancialResultsQuery = {}) =>
          request<{ data: FinancialResultsList<FinancialResultsManagerRow> }>(
            `${financialResultsPrefix}/managers${buildQuery(params)}`,
          ).then((response) => response.data),

        getClients: (params: FinancialResultsQuery = {}) =>
          request<{ data: FinancialResultsList<FinancialResultsClientRow> }>(
            `${financialResultsPrefix}/clients${buildQuery(params)}`,
          ).then((response) => response.data),
      },

      financeArticles: {
        getMany: (params: { type?: FinanceType } = {}) =>
          request<{ data?: FinanceArticle[] }>(
            `${financeArticlesPrefix}${buildQuery(params)}`,
          ).then((response) => response.data ?? []),

        create: (payload: FinanceArticlePayload) =>
          request<FinanceArticle>(financeArticlesPrefix, {
            method: 'POST',
            body: JSON.stringify(payload),
          }),

        get: (articleId: string) =>
          request<FinanceArticle>(financeArticlePrefix(articleId)),

        update: (articleId: string, payload: FinanceArticlePayload) =>
          request<FinanceArticle>(financeArticlePrefix(articleId), {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        delete: (articleId: string) =>
          request<void>(financeArticlePrefix(articleId), {
            method: 'DELETE',
          }),
      },

      plannedExpenses: {
        getMany: () =>
          request<{ data?: PlannedExpense[] }>(plannedExpensesPrefix).then(
            (response) => response.data ?? [],
          ),

        getPayments: (params: FinanceFilters = {}) =>
          request<{ data?: PlannedExpensePayment[] }>(
            `${plannedExpensesPrefix}/payments${buildQuery(params)}`,
          ).then((response) => response.data ?? []),

        create: (payload: PlannedExpensePayload) =>
          request<PlannedExpense>(plannedExpensesPrefix, {
            method: 'POST',
            body: JSON.stringify(payload),
          }),

        update: (plannedExpenseId: string, payload: PlannedExpensePayload) =>
          request<PlannedExpense>(plannedExpensePrefix(plannedExpenseId), {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        delete: (plannedExpenseId: string) =>
          request<void>(plannedExpensePrefix(plannedExpenseId), {
            method: 'DELETE',
          }),
      },

      knowledgeBase: {
        getMany: () => request<KnowledgeBaseArticleIndexPayload>(knowledgeBasePrefix),

        folders: {
          getMany: () =>
            request<KnowledgeBaseFolderIndexPayload>(
              `${knowledgeBasePrefix}/folders`,
            ).then((response) => response.data ?? []),

          create: (payload: KnowledgeBaseFolderCreatePayload) =>
            request<KnowledgeBaseFolder>(`${knowledgeBasePrefix}/folders`, {
              method: 'POST',
              body: JSON.stringify(payload),
            }),

          update: (folderId: string, payload: KnowledgeBaseFolderUpdatePayload) =>
            request<KnowledgeBaseFolder>(`${knowledgeBasePrefix}/folders/${folderId}`, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            }),

          updateAccesses: (folderId: string, payload: KnowledgeBaseFolderAccessPayload) =>
            request<KnowledgeBaseFolder>(
              `${knowledgeBasePrefix}/folders/${folderId}/accesses`,
              {
                method: 'PATCH',
                body: JSON.stringify(payload),
              },
            ),

          delete: (folderId: string) =>
            request<void>(`${knowledgeBasePrefix}/folders/${folderId}`, {
              method: 'DELETE',
            }),
        },

        create: (payload: KnowledgeBaseArticleCreatePayload | string | null = null) => {
          const body =
            typeof payload === 'string' || payload === null
              ? { folder_id: payload }
              : payload;

          return request<KnowledgeBaseArticle>(knowledgeBasePrefix, {
            method: 'POST',
            body: JSON.stringify(body),
          });
        },

        updateAccesses: (articleId: string, payload: KnowledgeBaseArticleAccessPayload) =>
          request<KnowledgeBaseArticle>(`${knowledgeBasePrefix}/${articleId}/accesses`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),

        update: (
          articleId: string,
          payload: Partial<KnowledgeBaseArticleForm>,
          options?: Pick<RequestInit, 'signal'>,
        ) =>
          request<KnowledgeBaseArticle>(`${knowledgeBasePrefix}/${articleId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
            ...options,
          }),

        publish: (articleId: string) =>
          request<KnowledgeBaseArticle>(`${knowledgeBasePrefix}/${articleId}/publish`, {
            method: 'POST',
          }),

        delete: (articleId: string) =>
          request<void>(`${knowledgeBasePrefix}/${articleId}`, {
            method: 'DELETE',
          }),

        uploadImage: (articleId: string, file: File) => {
          const formData = new FormData();
          formData.append('image', file);

          return request<KnowledgeBaseImageUploadPayload>(
            `${knowledgeBasePrefix}/${articleId}/images`,
            {
              method: 'POST',
              body: formData,
            },
          );
        },

        importImage: (articleId: string, url: string) =>
          request<KnowledgeBaseImageUploadPayload>(
            `${knowledgeBasePrefix}/${articleId}/images`,
            {
              method: 'POST',
              body: JSON.stringify({ url }),
            },
          ),
      },

      taskComments: {
        getForTask: (taskId: string) =>
          request<TaskCommentIndexPayload>(`/tasks/${taskId}/comments`).then(
            (response) => response.data ?? [],
          ),

        createForTask: (taskId: string, payload: { text?: string; files?: File[] }) => {
          const formData = new FormData();

          if (payload.text && payload.text.trim() !== '') {
            formData.append('text', payload.text.trim());
          }

          for (const file of payload.files ?? []) {
            formData.append('files[]', file);
          }

          return request<TaskComment>(`/tasks/${taskId}/comments`, {
            method: 'POST',
            body: formData,
          });
        },

        deleteForTask: (taskId: string, commentId: string) =>
          request<void>(`/tasks/${taskId}/comments/${commentId}`, {
            method: 'DELETE',
          }),
      },

      taskAttachments: {
        getForTask: (taskId: string) =>
          request<TaskAttachmentIndexPayload>(`/tasks/${taskId}/attachments`).then(
            (response) => response.data ?? [],
          ),

        uploadForTask: (taskId: string, file: File) => {
          const formData = new FormData();
          formData.append('file', file);

          return request<TaskAttachment>(`/tasks/${taskId}/attachments`, {
            method: 'POST',
            body: formData,
          });
        },

        deleteForTask: (taskId: string, attachmentId: string) =>
          request<void>(`/tasks/${taskId}/attachments/${attachmentId}`, {
            method: 'DELETE',
          }),
      },

      taskActivity: {
        getForTask: (taskId: string) =>
          request<TaskActivityIndexPayload>(`/tasks/${taskId}/activity`).then(
            (response) => response.data ?? [],
          ),
      },

      taskClientMessages: {
        getMessages: (taskId: string) =>
          request<TaskClientMessagesResponse>(`/tasks/${taskId}/client-messages`),

        sendMessage: (taskId: string, payload: { text?: string; files?: File[] }) => {
          const formData = new FormData();
          if (payload.text?.trim()) {
            formData.append('text', payload.text.trim());
          }
          for (const file of payload.files ?? []) {
            formData.append('files[]', file);
          }
          return request<{ data: TaskClientMessage }>(
            `/tasks/${taskId}/client-messages`,
            {
              method: 'POST',
              body: formData,
            },
          ).then((response) => response.data);
        },

        createPublicLink: (taskId: string) =>
          request<{ data: TaskPublicLink }>(
            `/tasks/${taskId}/client-messages/public-link`,
            {
              method: 'POST',
            },
          ).then((response) => response.data),

        deletePublicLink: (taskId: string) =>
          request<void>(`/tasks/${taskId}/client-messages/public-link`, {
            method: 'DELETE',
          }),
      },

      userTaskBoard: {
        get: async (params: { search?: string } = {}) => {
          const query = buildQuery({ search: params.search ?? '' });
          const { columns, data } = await request<UserBoardResponse>(
            `/tasks/board${query}`,
          );
          return { columns: columns ?? [], data: data ?? [] };
        },
        move: async (
          taskId: string,
          payload: {
            status_slug: string;
            destination_index: number;
            search?: string;
          },
        ) => {
          const { columns, data } = await request<UserBoardResponse>(
            `/tasks/board/${taskId}/move`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          );
          return { columns: columns ?? [], data: data ?? [] };
        },
      },

      billing: {
        getTariffs: () =>
          request<{ data: TariffPlan[] }>(`${billingPrefix}/tariffs`).then(
            (response) => response.data ?? [],
          ),
        getSubscription: () =>
          request<{
            data: {
              subscription: CurrentSubscription;
              active_employees_count: number;
              pending_invoice?: Invoice | null;
            };
          }>(`${billingPrefix}/subscription`).then((response) => {
            const sub = response.data?.subscription;
            if (sub) {
              sub.pending_invoice = response.data?.pending_invoice || null;
              sub.active_employees_count = response.data?.active_employees_count;
            }
            return sub || null;
          }),
        getInvoices: (params: Record<string, QueryValue> = {}) =>
          request<InvoicesResponse>(`${billingPrefix}/invoices${buildQuery(params)}`),
        calculateTariffChange: (tariffId: string, periodMonths: number) =>
          request<{ data: CalculateTariffResponse }>(
            `${billingPrefix}/tariffs/calculate`,
            {
              method: 'POST',
              body: JSON.stringify({
                tariff_id: tariffId,
                period_months: periodMonths,
              }),
            },
          ).then((res) => res.data),
        changeTariff: (tariffId: string, periodMonths: number) =>
          request<{ data?: InvoiceChangeResponse } & InvoiceChangeResponse>(
            `${billingPrefix}/tariffs/change`,
            {
              method: 'POST',
              body: JSON.stringify({
                tariff_id: tariffId,
                period_months: periodMonths,
              }),
            },
          ).then((res) => res.data || res),
        // ФРИ включается сразу, без счёта и периода; оплаченные дни ПРО не сохраняются.
        switchToFreeTariff: (tariffId: string) =>
          request<{ message: string; data?: { switched_to_free?: boolean } }>(
            `${billingPrefix}/tariffs/change`,
            {
              method: 'POST',
              body: JSON.stringify({ tariff_id: tariffId }),
            },
          ).then((res) => ({
            message: res.message,
            switched_to_free: Boolean(res.data?.switched_to_free),
          })),
        requestIndividualTariff: (
          desiredEmployeesCount: number | null,
          desiredPeriodMonths: number | null = null,
        ) =>
          request<{ message: string }>(`${billingPrefix}/tariffs/individual-request`, {
            method: 'POST',
            body: JSON.stringify({
              ...(desiredEmployeesCount !== null
                ? { desired_employees_count: desiredEmployeesCount }
                : {}),
              ...(desiredPeriodMonths !== null
                ? { desired_period_months: desiredPeriodMonths }
                : {}),
            }),
          }),
        getRequisites: () =>
          request<{ data: Requisites }>(`${billingPrefix}/requisites`).then(
            (response) => response.data,
          ),
        downloadUpd: (invoiceId: string) =>
          request<Blob>(`${billingPrefix}/invoices/${invoiceId}/download-upd`, {
            headers: { Accept: 'application/pdf' },
          }),
        downloadInvoice: (invoiceId: string) =>
          request<Blob>(`${billingPrefix}/invoices/${invoiceId}/download`, {
            headers: { Accept: 'application/pdf' },
          }),
        cancelInvoice: (invoiceId: string) =>
          request<{ data: Invoice }>(`${billingPrefix}/invoices/${invoiceId}/cancel`, {
            method: 'PATCH',
          }).then((res) => res.data),
      },
    },
  };
}
