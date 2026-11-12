import type { FinanceSource } from './app';

export type FinancialResultsGranularity = 'day' | 'week' | 'month' | 'quarter';

export type FinancialResultsFilters = {
  from: string;
  to: string;
  granularity: FinancialResultsGranularity;
  project_ids: string[];
  client_ids: string[];
  manager_ids: string[];
  finance_article_ids: string[];
  sources: FinanceSource[];
  employee_ids: string[];
};

export type FinancialResultsQuery = Partial<FinancialResultsFilters>;

export type FinancialResultsPerson = {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string | null;
  email?: string | null;
};

export type FinancialResultsEntity = {
  id: string | null;
  name: string;
  status?: string;
};

export type FinancialResultsArticle = {
  article_id: string | null;
  name: string;
  type: string;
  distribution_method?: string;
  own_amount: number;
  children_amount: number;
  amount: number;
  percent: number;
  children: FinancialResultsArticle[];
};

export type FinancialResultsHistogramItem = {
  date: string;
  label: string;
  income: number;
  expenses: number;
  profit: number;
};

export type FinancialResultsOverview = {
  filters: FinancialResultsFilters;
  summary: { income: number; expenses: number; profit: number };
  histogram: FinancialResultsHistogramItem[];
  income_articles: FinancialResultsArticle[];
  expense_articles: FinancialResultsArticle[];
};

export type FinancialResultsEmployeeExpense = {
  employee: FinancialResultsPerson;
  expenses: number;
};

export type FinancialResultsArticleExpense = {
  article: FinancialResultsEntity;
  expenses: number;
};

export type FinancialResultsArticleIncome = {
  article: FinancialResultsEntity;
  income: number;
};

export type FinancialResultsProjectRow = {
  project: FinancialResultsEntity;
  client: FinancialResultsEntity | null;
  managers: FinancialResultsPerson[];
  income: number;
  income_articles: FinancialResultsArticleIncome[];
  direct_expenses: number;
  employee_expenses: number;
  other_expenses: number;
  expenses: number;
  profit: number;
  employees: FinancialResultsEmployeeExpense[];
  expense_articles: FinancialResultsArticleExpense[];
};

export type FinancialResultsProjectSummary = {
  project: FinancialResultsEntity;
  client: FinancialResultsEntity | null;
  income: number;
  direct_expenses: number;
  expenses: number;
  profit: number;
};

export type FinancialResultsManagerRow = {
  manager: FinancialResultsPerson;
  income: number;
  expenses: number;
  profit: number;
  projects: FinancialResultsProjectSummary[];
};

export type FinancialResultsClientRow = {
  client: FinancialResultsEntity;
  income: number;
  expenses: number;
  profit: number;
};

export type FinancialResultsList<T> = {
  filters: FinancialResultsFilters;
  data: T[];
};
