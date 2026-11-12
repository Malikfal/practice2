export type PayrollSummaryGroupBy = 'week' | 'month' | 'quarter' | 'year';

export type PayrollSummaryAmounts = {
  own_seconds: number;
  supervised_seconds: number;
  amount_kopecks: number;
};

export type PayrollSummaryValue = PayrollSummaryAmounts & {
  employee_id: string;
};

export type PayrollSummaryEmployee = PayrollSummaryAmounts & {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  is_archived: boolean;
};

// Расчётный период: неделя, разрезанная по границе месяца.
export type PayrollSummaryPeriod = PayrollSummaryAmounts & {
  key: string;
  group_key: string;
  from: string;
  to: string;
  employees_count: number;
  values: PayrollSummaryValue[];
};

export type PayrollSummaryGroup = PayrollSummaryAmounts & {
  key: string;
  from: string;
  to: string;
  calendar_from: string;
  calendar_to: string;
  is_current: boolean;
  periods_count: number;
  employees_count: number;
  values: PayrollSummaryValue[];
};

export type PayrollSummary = {
  requested_from: string;
  requested_to: string;
  from: string;
  to: string;
  today: string;
  group_by: PayrollSummaryGroupBy;
  available_from: string | null;
  totals: PayrollSummaryAmounts & { employees_count: number; periods_count: number };
  employees: PayrollSummaryEmployee[];
  groups: PayrollSummaryGroup[];
  periods: PayrollSummaryPeriod[];
};

export type PayrollSummaryQuery = {
  from?: string;
  to?: string;
  group_by?: PayrollSummaryGroupBy;
};
