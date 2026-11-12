export type FinanceAnalyticsGranularity = 'day' | 'week' | 'month' | 'quarter';

export type FinanceAnalyticsFilters = {
  from: string;
  to: string;
  granularity: FinanceAnalyticsGranularity;
  project_ids: string[];
  client_ids: string[];
  manager_ids: string[];
};

export type FinanceAnalyticsQuery = Partial<FinanceAnalyticsFilters> & {
  unaccounted_income_page?: number;
  unaccounted_expenses_page?: number;
  unaccounted_per_page?: number;
};

export type FinanceAnalyticsPerson = {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string | null;
  email?: string;
};

export type FinanceAnalyticsEntity = {
  id: string | null;
  name: string;
  status?: string;
};

export type FinanceAnalyticsArticle = {
  article_id: string | null;
  name: string;
  type: string;
  distribution_method?: string;
  own_amount: number;
  children_amount: number;
  amount: number;
  percent: number;
  children: FinanceAnalyticsArticle[];
};

export type FinanceAnalyticsHistogramItem = {
  date: string;
  label: string;
  income: number;
  actual_expenses: number;
  planned_expenses: number;
  expenses: number;
  profit: number;
};

export type FinanceAnalyticsUnaccountedPayment = {
  id: string;
  category: string;
  description: string;
  amount: number;
};

export type FinanceAnalyticsUnaccountedPayments = {
  items: FinanceAnalyticsUnaccountedPayment[];
  total: number;
  total_count?: number;
  page?: number;
  per_page?: number;
  total_pages?: number;
};

export type FinanceAnalyticsDistributionWarning = {
  finance_id: string;
  article_id: string | null;
  article_name: string | null;
  distribution_method: 'PROPORTIONAL_TO_EXPENSES' | 'BY_VOLUME';
  reason: 'NO_EXPENSES' | 'NO_WORK_HOURS';
};

export type FinanceAnalyticsOverview = {
  filters: FinanceAnalyticsFilters;
  summary: {
    income: number;
    actual_expenses: number;
    planned_expenses: number;
    company_planned_expenses: number;
    planned_expenses_included: boolean;
    expenses: number;
    profit: number;
  };
  histogram: FinanceAnalyticsHistogramItem[];
  income_articles: FinanceAnalyticsArticle[];
  expense_articles: FinanceAnalyticsArticle[];
  planned_expense_articles: FinanceAnalyticsArticle[];
  distribution_warnings: FinanceAnalyticsDistributionWarning[];
  undistributed_expenses: number;
  unaccounted_income: FinanceAnalyticsUnaccountedPayments;
  unaccounted_expenses: FinanceAnalyticsUnaccountedPayments;
};

export type FinanceAnalyticsExpenseBreakdown = {
  employee?: FinanceAnalyticsPerson;
  article?: FinanceAnalyticsArticle | null;
  article_id?: string | null;
  name?: string;
  expenses?: number;
  amount?: number;
  percent?: number;
};

export type FinanceAnalyticsProjectRow = {
  project: FinanceAnalyticsEntity;
  client: FinanceAnalyticsEntity | null;
  managers: FinanceAnalyticsPerson[];
  income: number;
  direct_expenses: number;
  allocated_expenses: number;
  employee_expenses: number;
  other_expenses: number;
  undistributed_expenses: number;
  expenses: number;
  profit: number;
  employees: FinanceAnalyticsExpenseBreakdown[];
  expense_articles: FinanceAnalyticsExpenseBreakdown[];
  allocated_articles: FinanceAnalyticsExpenseBreakdown[];
  undistributed_articles: FinanceAnalyticsExpenseBreakdown[];
};

export type FinanceAnalyticsProjectSummary = Partial<FinanceAnalyticsProjectRow> & {
  project: FinanceAnalyticsEntity;
  income: number;
  expenses: number;
  profit: number;
};

export type FinanceAnalyticsManagerRow = {
  manager: FinanceAnalyticsPerson;
  income: number;
  expenses: number;
  profit: number;
  projects: FinanceAnalyticsProjectSummary[];
};

export type FinanceAnalyticsClientRow = {
  client: FinanceAnalyticsEntity;
  income: number;
  expenses: number;
  profit: number;
  projects: FinanceAnalyticsProjectRow[];
};

export type FinanceAnalyticsEmployees = {
  filters: FinanceAnalyticsFilters;
  summary: {
    expenses: number;
  };
  data: Array<{
    employee: FinanceAnalyticsPerson;
    expenses: number;
    own_seconds: number;
    supervised_seconds: number;
    percent: number;
  }>;
};

export type FinanceAnalyticsList<T> = {
  filters: FinanceAnalyticsFilters;
  undistributed_expenses?: number;
  data: T[];
};
