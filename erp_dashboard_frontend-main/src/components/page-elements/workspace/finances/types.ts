import type {
  FinanceDistributionMethod,
  FinanceDistributionProjectMode,
  FinanceSource,
  FinanceType,
} from '../../../../types/app';

export type FinanceForm = {
  type: FinanceType;
  amount: string;
  dateOfPayment: string;
  distribution_from: string;
  distribution_to: string;
  distribution_method: FinanceDistributionMethod;
  distribution_project_mode: FinanceDistributionProjectMode | null;
  distribution_project_ids: string[];
  finance_article_id: string;
  project_id: string;
  employee_id: string;
  comment: string;
};

export type FinanceFilterState = {
  from: string;
  to: string;
  amount_from: string;
  amount_to: string;
  type: string;
  sources: FinanceSource[];
  finance_article_ids: string[];
  project_ids: string[];
  client_ids: string[];
  employee_ids: string[];
};
