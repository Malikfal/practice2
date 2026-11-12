<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Employees;

use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsOperationRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsProjectRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsWorkTimeRepository;
use App\Services\Workspace\FinanceAnalyticsServices\Data\FinanceAnalyticsFiltersData;
use Illuminate\Support\Collection;

/** Независимый отчёт сотрудников: расходы и часы не требуют проектной финансовой сводки. */
class EmployeeAnalyticsService
{
    public function __construct(
        private readonly FinanceAnalyticsOperationRepository $operations,
        private readonly FinanceAnalyticsProjectRepository $projects,
        private readonly FinanceAnalyticsWorkTimeRepository $workTime,
    ) {}

    /**
     * Объединяет расходы, собственные и подконтрольные часы по ID сотрудника.
     * Расход целиком относится к дате платежа, как в финансовом результате; распределение не учитывается.
     * Часы добавляются независимо от финансов, чтобы работник без начисленного ФОТ не исчезал из отчёта.
     */
    public function build(FinanceAnalyticsFiltersData $filters, string $companyId): array
    {
        $projectIds = $this->projects->projectIds($companyId, $filters->projectIds, $filters->clientIds, $filters->managerIds);
        $selectedProjects = $projectIds->flip();
        $finances = $this->operations->employeeExpenseFinances($companyId, $filters->from, $filters->to);
        /** @var Collection<string, array<string, mixed>> $rows */
        $rows = collect();
        foreach ($finances as $finance) {
            if ($finance->project_id ? ! $selectedProjects->has((string) $finance->project_id) : $filters->isScoped()) {
                continue;
            }
            $amount = (int) $finance->amount;
            if ($amount <= 0) {
                continue;
            }
            $id = (string) $finance->employee_id;
            $row = $rows->get($id, fn (): array => $this->row($id, $finance->employee));
            $row['expenses'] += $amount;
            $rows->put($id, $row);
        }

        $hoursProjects = $filters->isScoped() ? $projectIds : collect();
        // В пустой отфильтрованной выборке нельзя передавать [] как «все проекты».
        if (! $filters->isScoped() || $hoursProjects->isNotEmpty()) {
            $this->addHours($rows, $this->workTime->employeeWorkedSeconds($companyId, $filters->from, $filters->to, $hoursProjects), 'own_seconds');
            $this->addHours($rows, $this->workTime->supervisedSeconds($companyId, $filters->from, $filters->to, $hoursProjects), 'supervised_seconds');
        }
        $total = (int) $rows->sum('expenses');
        $rows = $rows->map(static function (array $row) use ($total): array {
            $row['percent'] = $total > 0 ? round($row['expenses'] * 100 / $total, 2) : 0.0;

            return $row;
        })->sortBy('employee.name', SORT_STRING)->values();

        return [
            'filters' => collect($filters->toArray())->except('granularity')->all(),
            'summary' => ['expenses' => $total],
            'data' => $rows->all(),
        ];
    }

    /**
     * Добавляет один вид часов к уже найденному сотруднику или создаёт строку, если финансов у него не было.
     *
     * @param  Collection<string, array<string, mixed>>  $rows
     * @param  Collection<int, object{user_id: string, duration_seconds: int|string}>  $hours
     */
    private function addHours(Collection $rows, Collection $hours, string $column): void
    {
        foreach ($hours as $worked) {
            $id = (string) $worked->user_id;
            $row = $rows->get($id, fn (): array => $this->row($id, $worked));
            $row[$column] += (int) $worked->duration_seconds;
            $rows->put($id, $row);
        }
    }

    /** Удалённая связь не обнуляет расход; сведения о человеке остаются пустыми. */
    private function row(string $id, ?object $person): array
    {
        return [
            'employee' => [
                'id' => $id,
                'name' => trim(trim((string) $person?->name).' '.trim((string) $person?->last_name)),
                'first_name' => (string) $person?->name,
                'last_name' => (string) $person?->last_name,
                'email' => $person?->email,
            ],
            'expenses' => 0,
            'own_seconds' => 0,
            'supervised_seconds' => 0,
            'percent' => 0.0,
        ];
    }
}
