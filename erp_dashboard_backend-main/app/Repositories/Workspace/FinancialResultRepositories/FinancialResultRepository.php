<?php

namespace App\Repositories\Workspace\FinancialResultRepositories;

use App\Models\Company;
use App\Models\Finance;
use App\Models\FinanceArticle;
use App\Models\Project;
use App\Services\Workspace\FinancialResultServices\Data\FinancialResultFiltersData;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/** Выбирает операции компании по фактической дате платежа. */
class FinancialResultRepository
{
    public function timezoneForCompany(string $companyId): string
    {
        return Company::query()->findOrFail($companyId)->payrollTimezone();
    }

    /**
     * Период по умолчанию охватывает все операции компании, в том числе без проекта.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public function periodBounds(string $companyId, string $timezone): array
    {
        $bounds = Finance::query()
            ->where('company_id', $companyId)
            ->selectRaw('MIN("dateOfPayment") AS first_date, MAX("dateOfPayment") AS last_date')
            ->toBase()
            ->first();

        return [
            $bounds?->first_date ? Carbon::parse($bounds->first_date, $timezone) : now($timezone),
            $bounds?->last_date ? Carbon::parse($bounds->last_date, $timezone) : now($timezone),
        ];
    }

    /**
     * @return Collection<string, Project>
     */
    public function projects(string $companyId, FinancialResultFiltersData $filters): Collection
    {
        return Project::query()
            ->where('company_id', $companyId)
            ->when($filters->projectIds->isNotEmpty(), fn (Builder $query) => $query->whereIn('id', $filters->projectIds))
            ->when($filters->clientIds->isNotEmpty(), fn (Builder $query) => $query->whereIn('client_id', $filters->clientIds))
            ->when($filters->managerIds->isNotEmpty(), fn (Builder $query) => $query->whereHas(
                'members',
                fn (Builder $members) => $members->where('is_pm', true)->whereIn('user_id', $filters->managerIds),
            ))
            ->with([
                'client:id,name',
                'members' => fn ($query) => $query->where('is_pm', true)->with('user:id,name,last_name,email'),
            ])
            ->orderBy('name')
            ->get(['id', 'name', 'status', 'client_id', 'company_id'])
            ->keyBy('id');
    }

    /**
     * Фильтр статей намеренно точный: выбор родителя не включает его дочерние статьи.
     * Поля распределения не читаются, поскольку этот отчёт всегда использует всю сумму в dateOfPayment.
     *
     * @param  Collection<int, string>  $projectIds
     * @return Collection<int, Finance>
     */
    public function finances(string $companyId, FinancialResultFiltersData $filters, Collection $projectIds): Collection
    {
        $hasProjectFilter = $filters->projectIds->isNotEmpty()
            || $filters->clientIds->isNotEmpty()
            || $filters->managerIds->isNotEmpty();

        if ($hasProjectFilter && $projectIds->isEmpty()) {
            return collect();
        }

        return Finance::query()
            ->where('company_id', $companyId)
            ->when($hasProjectFilter, fn (Builder $query) => $query->whereIn('project_id', $projectIds))
            ->whereDate('dateOfPayment', '>=', $filters->from->toDateString())
            ->whereDate('dateOfPayment', '<=', $filters->to->toDateString())
            ->when($filters->articleIds->isNotEmpty(), fn (Builder $query) => $query->whereIn('finance_article_id', $filters->articleIds))
            ->when($filters->sources->isNotEmpty(), fn (Builder $query) => $query->whereIn('source', $filters->sources))
            ->when($filters->employeeIds->isNotEmpty(), fn (Builder $query) => $query->whereIn('employee_id', $filters->employeeIds))
            ->with([
                'article:id,name',
                'employee' => fn ($query) => $query->withBlocked()->select('id', 'name', 'last_name', 'email'),
            ])
            ->orderBy('dateOfPayment')
            ->get([
                'id', 'project_id', 'finance_article_id', 'employee_id', 'amount', 'type', 'source',
                'dateOfPayment',
            ]);
    }

    /** @return Collection<int, FinanceArticle> */
    public function articles(string $companyId): Collection
    {
        return FinanceArticle::query()
            ->where('company_id', $companyId)
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name', 'type', 'distribution_method']);
    }
}
