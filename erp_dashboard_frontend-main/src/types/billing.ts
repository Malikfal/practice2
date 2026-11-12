export type TariffPlanKind = 'free' | 'pro';

export type TariffPlan = {
  id: string;
  name: string;
  price: number;
  max_employees: number | null;
  /** ФРИ — бесплатный бессрочный тариф, ПРО — платные тарифы по числу сотрудников. */
  plan?: TariffPlanKind;
};

export type CurrentSubscription = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  days_left: number | null;
  tariff: TariffPlan;
  pending_invoice?: Invoice | null;
  /** Активные пользователи компании: сравниваем с лимитом тарифа. */
  active_employees_count?: number;
};

export type InvoiceStatus = 'AWAITING_PAYMENT' | 'PAID' | 'CANCELLED';

export type Invoice = {
  id: string;
  number: string;
  amount: number;
  period_days: number;
  status: InvoiceStatus;
  status_label: string;
  paid_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  can_download_upd: boolean;
  tariff: TariffPlan;
};

export interface InvoiceChangeResponse {
  message: string;
  invoice?: Invoice;
}

export interface CalculateTariffResponse {
  base_amount: number;
  discount: number;
  amount_to_pay: number;
  bonus_days: number;
}

export type InvoicesResponse = {
  data: Invoice[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export interface Requisites {
  bank: string;
  checking_account: string;
  correspondent_account: string;
  bic: string;
}
