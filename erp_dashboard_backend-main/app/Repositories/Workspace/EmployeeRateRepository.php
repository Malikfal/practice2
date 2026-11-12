<?php

namespace App\Repositories\Workspace;

use App\Enums\UserRole;
use App\Models\EmployeeRate;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class EmployeeRateRepository
{
    public function paginateEmployeesWithCurrentRates(
        string $companyId,
        string $search,
        int $perPage,
        ?string $sortBy = null,
        string $sortDirection = 'asc',
    ): LengthAwarePaginator {
        $query = User::query()
            ->select('users.*')
            ->where('users.company_id', $companyId)
            // Клиентские аккаунты — не сотрудники, ставок у них нет.
            ->whereDoesntHave('roleModel', static fn ($role) => $role->where('name', UserRole::CLIENT->value))
            ->when($search !== '', static function ($query) use ($search): void {
                $like = '%'.mb_strtolower($search).'%';

                $query->where(static function ($builder) use ($like): void {
                    $builder
                        ->whereRaw('LOWER(users.name) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(users.last_name) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(users.email) LIKE ?', [$like]);
                });
            })
            ->with(['roleModel:id,name', 'salaryFinanceArticle:id,name']);

        $employees = $this->applySorting($query, $sortBy, $sortDirection === 'desc' ? 'desc' : 'asc')
            ->orderBy('users.last_name')
            ->orderBy('users.name')
            ->orderBy('users.email')
            ->orderBy('users.id')
            ->paginate($perPage)
            ->withQueryString();

        $this->loadCurrentRates($employees);

        return $employees;
    }

    /**
     * Сортировка по колонкам таблицы ставок. Значения ставки берутся из действующей на сегодня записи.
     */
    private function applySorting(Builder $query, ?string $sortBy, string $direction): Builder
    {
        $rateColumns = ['effective_from', 'salary', 'hourly_rate', 'supervised_hourly_rate', 'company_hourly_rate'];

        if (in_array($sortBy, $rateColumns, true)) {
            $query->addSelect([
                'rate_sort_value' => DB::table('employee_rates')
                    ->select("employee_rates.{$sortBy}")
                    ->whereColumn('employee_rates.employee_id', 'users.id')
                    ->whereDate('employee_rates.effective_from', '<=', Carbon::now()->toDateString())
                    ->orderByDesc('employee_rates.effective_from')
                    ->orderByDesc('employee_rates.created_at')
                    ->limit(1),
            ]);

            return $query->orderByRaw("rate_sort_value {$direction} NULLS LAST");
        }

        return match ($sortBy) {
            'employee' => $query
                ->orderByRaw("LOWER(CONCAT_WS(' ', users.last_name, users.name)) {$direction}"),
            // Подзапросы вместо join: глобальный scope User фильтрует по неквалифицированному status.
            'role' => $query
                ->addSelect(['role_sort_name' => DB::table('roles')
                    ->selectRaw('LOWER(COALESCE(roles.display_name, roles.name))')
                    ->whereColumn('roles.id', 'users.role_id')
                    ->limit(1)])
                ->orderByRaw("role_sort_name {$direction} NULLS LAST"),
            'position' => $query
                ->orderByRaw("NULLIF(LOWER(TRIM(users.position)), '') {$direction} NULLS LAST"),
            'finance_article' => $query
                ->addSelect(['finance_article_sort_name' => DB::table('finance_article')
                    ->selectRaw('LOWER(finance_article.name)')
                    ->whereColumn('finance_article.id', 'users.salary_finance_article_id')
                    ->limit(1)])
                ->orderByRaw("finance_article_sort_name {$direction} NULLS LAST"),
            default => $query,
        };
    }

    private function loadCurrentRates(LengthAwarePaginator $employees): void
    {
        $employeeIds = $employees->getCollection()
            ->pluck('id')
            ->map(static fn ($id): string => (string) $id)
            ->filter()
            ->values();

        if ($employeeIds->isEmpty()) {
            return;
        }

        $ratesByEmployeeId = EmployeeRate::query()
            ->with(['changer'])
            ->whereIn('employee_id', $employeeIds)
            ->whereDate('effective_from', '<=', Carbon::now()->toDateString())
            ->orderBy('employee_id')
            ->orderByDesc('effective_from')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy(static fn (EmployeeRate $rate): string => (string) $rate->employee_id)
            ->map(static fn ($rates): EmployeeRate => $rates->first());

        $employees->getCollection()->each(static function (User $employee) use ($ratesByEmployeeId): void {
            $employee->setRelation('currentRate', $ratesByEmployeeId->get((string) $employee->id));
        });
    }
}
