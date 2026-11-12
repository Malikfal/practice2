<?php

namespace App\Repositories\Workspace\PayrollRepositories;

use App\Enums\FinanceType;
use App\Models\Finance;
use App\Models\PayrollPayout;
use App\Models\PayrollPayoutClosing;
use App\Models\PayrollPayoutOpening;
use App\Models\PayrollPayoutPlan;
use App\Models\PayrollPayoutSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

class PayrollPayoutRepository
{
    public function setting(string $companyId): ?PayrollPayoutSetting
    {
        return PayrollPayoutSetting::query()->where('company_id', $companyId)->first();
    }

    /**
     * Начисления сотрудникам по дням, источникам и статьям. Начислением считается любой расход
     * с сотрудником по дате платежа, как в отчете "Расчёт ФОТ".
     *
     * @param  list<string>|null  $employeeIds
     * @return Collection<int, object>
     */
    public function accrualRows(string $companyId, string $fromDate, string $toDate, ?array $employeeIds = null): Collection
    {
        return Finance::query()
            ->leftJoin('finance_article', 'finance_article.id', '=', 'finance.finance_article_id')
            ->where('finance.company_id', $companyId)
            ->where('finance.type', FinanceType::EXPENDITURE->value)
            ->whereNotNull('finance.employee_id')
            ->when($employeeIds !== null, fn ($query) => $query->whereIn('finance.employee_id', $employeeIds))
            ->whereDate('finance.dateOfPayment', '>=', $fromDate)
            ->whereDate('finance.dateOfPayment', '<=', $toDate)
            ->selectRaw('finance.employee_id, finance."dateOfPayment" as paid_on, finance.source, finance.finance_article_id as article_id, MAX(finance_article.name) as article_name, SUM(finance.amount) as amount')
            ->groupBy('finance.employee_id', 'finance.dateOfPayment', 'finance.source', 'finance.finance_article_id')
            ->toBase()
            ->get();
    }

    /** Возвращает месяц первого начисления сотрудникам компании в формате ГГГГ-ММ. */
    public function firstAccrualMonth(string $companyId): ?string
    {
        $date = Finance::query()
            ->where('company_id', $companyId)
            ->where('type', FinanceType::EXPENDITURE->value)
            ->whereNotNull('employee_id')
            ->min('dateOfPayment');

        return $date ? substr((string) $date, 0, 7) : null;
    }

    /**
     * Зафиксированные месяцы ведомости за период.
     *
     * @return EloquentCollection<int, PayrollPayoutClosing>
     */
    public function closings(string $companyId, string $fromMonth, string $toMonth): EloquentCollection
    {
        return PayrollPayoutClosing::query()
            ->with('closer')
            ->where('company_id', $companyId)
            ->where('period_month', '>=', $fromMonth)
            ->where('period_month', '<=', $toMonth)
            ->get();
    }

    /**
     * @param  list<string>|null  $employeeIds
     * @return EloquentCollection<int, PayrollPayout>
     */
    public function payouts(string $companyId, string $fromMonth, string $toMonth, ?array $employeeIds = null): EloquentCollection
    {
        return PayrollPayout::query()
            ->with(['article', 'creator'])
            ->where('company_id', $companyId)
            ->where('period_month', '>=', $fromMonth)
            ->where('period_month', '<=', $toMonth)
            ->when($employeeIds !== null, fn ($query) => $query->whereIn('employee_id', $employeeIds))
            ->orderByDesc('paid_at')
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * Выплаты по дате выплаты для отчета. Выплаты за месяцы до начала учета не берутся,
     * как в ведомости и задолженности.
     *
     * @return EloquentCollection<int, PayrollPayout>
     */
    public function paidBetween(
        string $companyId,
        string $startMonth,
        string $fromDate,
        string $toDate,
        ?string $employeeId = null,
        ?string $articleId = null,
    ): EloquentCollection {
        return PayrollPayout::query()
            ->with(['article', 'creator'])
            ->where('company_id', $companyId)
            ->where('period_month', '>=', $startMonth)
            ->whereDate('paid_at', '>=', $fromDate)
            ->whereDate('paid_at', '<=', $toDate)
            ->when($employeeId !== null, fn ($query) => $query->where('employee_id', $employeeId))
            ->when($articleId !== null, fn ($query) => $query->where('payroll_payout_article_id', $articleId))
            ->orderByDesc('paid_at')
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * Сотрудники и статьи, по которым есть выплаты с начала учета: варианты фильтров отчета.
     *
     * @return array{employee_ids:list<string>, article_ids:list<string>}
     */
    public function payoutFilterIds(string $companyId, string $startMonth): array
    {
        $query = PayrollPayout::query()
            ->where('company_id', $companyId)
            ->where('period_month', '>=', $startMonth);

        return [
            'employee_ids' => (clone $query)->distinct()->pluck('employee_id')->map('strval')->all(),
            'article_ids' => (clone $query)->distinct()->pluck('payroll_payout_article_id')->map('strval')->all(),
        ];
    }

    /**
     * @param  list<string>|null  $employeeIds
     * @return EloquentCollection<int, PayrollPayoutPlan>
     */
    public function plans(string $companyId, string $fromMonth, string $toMonth, ?array $employeeIds = null): EloquentCollection
    {
        return PayrollPayoutPlan::query()
            ->where('company_id', $companyId)
            ->where('period_month', '>=', $fromMonth)
            ->where('period_month', '<=', $toMonth)
            ->when($employeeIds !== null, fn ($query) => $query->whereIn('employee_id', $employeeIds))
            ->get();
    }

    /**
     * @param  list<string>|null  $employeeIds
     * @return array<string, int> сотрудник => остаток на начало учета
     */
    public function openings(string $companyId, ?array $employeeIds = null): array
    {
        return PayrollPayoutOpening::query()
            ->where('company_id', $companyId)
            ->when($employeeIds !== null, fn ($query) => $query->whereIn('employee_id', $employeeIds))
            ->get()
            ->mapWithKeys(static fn (PayrollPayoutOpening $opening): array => [
                (string) $opening->employee_id => (int) $opening->amount,
            ])
            ->all();
    }

    /**
     * Сотрудники ведомости вместе с заблокированными: у уволенного может оставаться остаток.
     *
     * @param  list<string>  $ids
     * @return EloquentCollection<int, User>
     */
    public function employees(string $companyId, array $ids): EloquentCollection
    {
        return User::withBlocked()
            ->where('company_id', $companyId)
            ->whereIn('id', $ids)
            ->orderBy('last_name')
            ->orderBy('name')
            ->get();
    }
}
