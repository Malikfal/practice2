export type ManagerReportGranularity = 'week' | 'month' | 'quarter' | 'year';

export type ManagerReportFilters = {
  from: string;
  to: string;
  granularity: ManagerReportGranularity;
  manager_ids: string[];
};

export type ManagerReportPerson = {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

/**
 * Суммы в копейках, часы в секундах, стоимость часа в копейках, доли в процентах.
 * Доли менеджера считаются от всей компании, доли проекта - от его менеджера.
 */
export type ManagerReportMetrics = {
  projects_count: number;
  /** Часы разработчиков: роли "Сотрудник" и "Тимлид", без PM проекта. */
  developer_seconds: number;
  supervised_seconds: number;
  /** Все часы проектов: участники без PM и собственное время менеджера. */
  total_seconds: number;
  /** null, если у пользователя нет доступа к финансам. */
  manager_cost: number | null;
  developer_cost: number | null;
  total_cost: number | null;
  supervised_hour_cost: number | null;
  /** Общая стоимость часа разработки: все начисления на все часы. */
  total_hour_cost: number | null;
  /** Стоимость часа разработчика. */
  developer_hour_cost: number | null;
};

export type ManagerReportShares = {
  hours_share: number;
  money_share: number | null;
};

export type ManagerReportBucket = {
  key: string;
  from: string;
  to: string;
  label: string;
};

export type ManagerReportSeriesPoint = ManagerReportMetrics & { key: string };

export type ManagerReportProjectRow = ManagerReportMetrics &
  ManagerReportShares & {
    project: { id: string; name: string; is_internal: boolean };
  };

export type ManagerReportManagerRow = ManagerReportMetrics &
  ManagerReportShares & {
    manager: ManagerReportPerson;
    series: ManagerReportSeriesPoint[];
    projects: ManagerReportProjectRow[];
  };

export type ManagerReportSummary = ManagerReportMetrics &
  ManagerReportShares & { managers_count: number };

/** Вся компания без фильтра по менеджерам. */
export type ManagerReportCompany = ManagerReportMetrics & {
  series: ManagerReportSeriesPoint[];
};

export type ManagerReportPayload = {
  from: string;
  to: string;
  granularity: ManagerReportGranularity;
  can_view_finance: boolean;
  collected_at: string | null;
  buckets: ManagerReportBucket[];
  summary: ManagerReportSummary;
  company: ManagerReportCompany;
  managers: ManagerReportManagerRow[];
  manager_options: ManagerReportPerson[];
};
