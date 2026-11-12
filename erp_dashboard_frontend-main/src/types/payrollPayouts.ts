export type PayrollPayoutKind = 'ADVANCE' | 'SETTLEMENT';

export type PayrollPayoutStatus = 'zero' | 'none' | 'part' | 'full' | 'over';

export type PayrollPayoutEmployee = {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  is_archived: boolean;
};

// Аванс или расчёт сотрудника за месяц. Суммы в копейках.
export type PayrollPayoutCell = {
  amount: number;
  auto_amount: number;
  paid: number;
  rest: number;
  over: number;
  status: PayrollPayoutStatus;
  is_fixed: boolean;
  is_manual: boolean;
};

export type PayrollPayout = {
  id: string;
  employee_id: string;
  month: string;
  kind: PayrollPayoutKind;
  amount: number;
  paid_at: string;
  article: { id: string; name: string | null };
  comment: string | null;
  created_by: { id: string; name: string } | null;
};

// Часть начисления за месяц. first_half - сколько из суммы входит в аванс.
export type PayrollPayoutAccrualPart =
  | {
      // Расчётный период ФОТ: неделя или её часть до границы месяца.
      type: 'period';
      from: string;
      to: string;
      amount: number;
      first_half: number;
      is_closed: boolean;
      // Сколько дней из семи ушло в аванс, если неделя с 15-м числом делится по дням.
      split_days: number | null;
    }
  | {
      // Расход с сотрудником, внесённый в финансах вручную или импортом.
      type: 'operation';
      date: string;
      source: string | null;
      article: string | null;
      amount: number;
      first_half: number;
    };

export type PayrollPayoutSheetRow = {
  employee: PayrollPayoutEmployee;
  carry_in: number;
  accrued: number;
  accrued_first_half: number;
  accrual_parts: PayrollPayoutAccrualPart[];
  advance: PayrollPayoutCell;
  settlement: PayrollPayoutCell;
  total_due: number;
  paid: number;
  unpaid: number;
  carry_out: number;
  payouts: PayrollPayout[];
};

export type PayrollPayoutSheet = {
  start_month: string | null;
  current_month: string;
  today: string;
  month: string;
  // Месяц зафиксирован: суммы аванса и расчёта не меняются, пока фиксацию не снимут.
  closing: {
    closed_at: string | null;
    closed_by: { id: string; name: string } | null;
  } | null;
  rows: PayrollPayoutSheetRow[];
};

export type PayrollPayoutDebtMonth = {
  month: string;
  debt_in: number;
  accrued: number;
  paid: number;
  debt_out: number;
};

export type PayrollPayoutDebtRow = {
  employee: PayrollPayoutEmployee;
  opening: number;
  accrued: number;
  paid: number;
  debt: number;
  months: PayrollPayoutDebtMonth[];
  payouts: PayrollPayout[];
};

export type PayrollPayoutDebts = {
  start_month: string | null;
  current_month: string;
  today: string;
  rows: PayrollPayoutDebtRow[];
};

export type PayrollPayoutSettings = {
  start_month: string | null;
  current_month: string;
  first_accrual_month: string | null;
};

export type PayrollPayoutArticle = {
  id: string;
  name: string;
  is_archived: boolean;
  payouts_count: number;
};

export type PayrollPayoutCreatePayload = {
  month: string;
  kind: PayrollPayoutKind;
  article_id: string;
  paid_at: string;
  comment?: string | null;
  items: Array<{ employee_id: string; amount: number }>;
};

export type PayrollPayoutReportArticle = {
  id: string;
  name: string | null;
  is_archived: boolean;
};

// Отчёт по выплатам за период по дате выплаты. Суммы в копейках.
export type PayrollPayoutReport = {
  start_month: string | null;
  today: string;
  from: string;
  to: string;
  rows: Array<PayrollPayout & { employee: PayrollPayoutEmployee | null }>;
  by_article: Array<{
    article: PayrollPayoutReportArticle;
    amount: number;
    count: number;
  }>;
  by_employee: Array<{ employee: PayrollPayoutEmployee; amount: number; count: number }>;
  total: { amount: number; count: number };
  // Сотрудники и статьи, по которым есть выплаты с начала учёта.
  filters: {
    employees: PayrollPayoutEmployee[];
    articles: PayrollPayoutReportArticle[];
  };
};

export type PayrollPayoutReportQuery = {
  from?: string;
  to?: string;
  employee_id?: string;
  article_id?: string;
};
