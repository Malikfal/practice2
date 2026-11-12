<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Reports;

use App\Enums\FinanceType;
use App\Models\FinanceArticle;
use App\Models\Project;
use App\Models\User;
use App\Services\Workspace\FinanceAnalyticsServices\Actual\Data\ActualAnalyticsData;
use App\Services\Workspace\FinanceAnalyticsServices\Actual\Data\AnalyticsInputData;
use App\Services\Workspace\FinanceAnalyticsServices\Actual\Data\FinanceAllocationData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\CalendarBuckets;
use App\Services\Workspace\FinanceAnalyticsServices\Planned\Data\PlannedExpensesData;
use App\Services\Workspace\FinanceAnalyticsServices\Reports\Data\AnalyticsResultData;
use Illuminate\Support\Collection;

/** Собирает представления одного расчёта. Массивы здесь являются контрактом API. */
class FinanceReportService
{
    public function __construct(
        private readonly CalendarBuckets $calendar,
        private readonly ArticleTreeBuilder $articles,
    ) {}

    /**
     * Факт и план объединяются только здесь; ни один входной результат не меняется.
     *
     * @param  Collection<int, FinanceArticle>  $articles
     */
    public function build(AnalyticsInputData $input, ActualAnalyticsData $actual, PlannedExpensesData $plannedExpenses, Collection $articles): AnalyticsResultData
    {
        /** @var Collection<int, FinanceAllocationData> $included */
        $included = $actual->allocations->filter(static fn (FinanceAllocationData $part): bool => $part->undistributed
            ? ! $input->filters->isScoped() : $input->includes($part->projectId));
        /** @var Collection<int, FinanceAllocationData> $income */
        $income = $included->filter(static fn (FinanceAllocationData $part): bool => $part->finance->type === FinanceType::ENTRANCE);
        /** @var Collection<int, FinanceAllocationData> $expenses */
        $expenses = $included->filter(static fn (FinanceAllocationData $part): bool => $part->finance->type === FinanceType::EXPENDITURE);
        $incomeTotal = $this->amount($income);
        $actualTotal = $this->amount($expenses);
        // План компании не включается в проектный срез, пока у плана нет проектного распределения.
        $plannedTotal = $input->filters->isScoped() ? 0 : $plannedExpenses->total();
        $expenseArticles = $this->articleAmounts($expenses);

        if (! $input->filters->isScoped()) {
            foreach ($plannedExpenses->articles as $id => $amount) {
                $expenseArticles->put($id, $expenseArticles->get($id, 0) + $amount);
            }
        }

        return new AnalyticsResultData(
            filters: $input->filters,
            summary: collect([
                'income' => $incomeTotal,
                'expenses' => $actualTotal + $plannedTotal,
                'profit' => $incomeTotal - $actualTotal - $plannedTotal,
                'actual_expenses' => $actualTotal,
                'planned_expenses' => $plannedTotal,
                'company_planned_expenses' => $plannedExpenses->total(),
                'planned_expenses_included' => ! $input->filters->isScoped(),
            ]),
            histogram: $this->histogram($input, $income, $expenses, $plannedExpenses),
            incomeArticles: $this->articles->build(FinanceType::ENTRANCE->value, $articles, $this->articleAmounts($income), $incomeTotal),
            expenseArticles: $this->articles->build(FinanceType::EXPENDITURE->value, $articles, $expenseArticles, $actualTotal + $plannedTotal),
            plannedArticles: $this->articles->build(FinanceType::EXPENDITURE->value, $articles, $plannedExpenses->articles, $plannedExpenses->total()),
            warnings: $actual->warnings,
            undistributedExpenses: $this->amount($actual->allocations->where('undistributed', true)),
            projects: $this->projectRows($input, $actual),
        );
    }

    /**
     * Страницы неучтённых платежей добавляются после кэша общей части.
     *
     * @param  Collection<string, array<string, mixed>>  $payments
     */
    public function overview(AnalyticsResultData $result, Collection $payments): array
    {
        return [
            'filters' => $result->filters->toArray(),
            'summary' => $result->summary->all(),
            'histogram' => $result->histogram->all(),
            'income_articles' => $result->incomeArticles->all(),
            'expense_articles' => $result->expenseArticles->all(),
            'planned_expense_articles' => $result->plannedArticles->all(),
            'distribution_warnings' => $result->warnings->all(),
            'undistributed_expenses' => $result->undistributedExpenses,
            'unaccounted_income' => $payments->get(FinanceType::ENTRANCE->value),
            'unaccounted_expenses' => $payments->get(FinanceType::EXPENDITURE->value),
        ];
    }

    /** Проекты используют тот же результат, что и сводка, без повторного распределения. */
    public function projects(AnalyticsResultData $result): array
    {
        return $this->rowsResponse($result, $result->projects);
    }

    /** Группировка меняет только представление уже рассчитанных проектных сумм. */
    public function clients(AnalyticsResultData $result): array
    {
        /** @var Collection<string, array<string, mixed>> $rows */
        $rows = $result->projects->groupBy(static fn (array $project): string => $project['client']['id'] ?? 'without_client')
            ->map(static fn (Collection $projects): array => [
                'client' => $projects->first()['client'] ?? ['id' => null, 'name' => 'Без клиента'],
                'income' => (int) $projects->sum('income'),
                'expenses' => (int) $projects->sum('expenses'),
                'profit' => (int) $projects->sum('profit'),
                'projects' => $projects->values()->all(),
            ])->sortBy('client.name', SORT_STRING);

        return $this->rowsResponse($result, $rows);
    }

    /** Каждый менеджер видит полные показатели своих проектов, а не поделённую между менеджерами сумму. */
    public function managers(AnalyticsResultData $result): array
    {
        $managerIds = $result->filters->managerIds;
        /** @var Collection<string, array<string, mixed>> $managers */
        $managers = $result->projects->flatMap(static fn (array $project): array => $project['managers'])->keyBy('id');
        $managers->put('without_manager', [
            'id' => 'without_manager',
            'name' => 'Не назначен',
            'first_name' => 'Не назначен',
            'last_name' => '',
            'email' => null,
        ]);
        /** @var Collection<string, Collection<int, array<string, mixed>>> $groups */
        $groups = $result->projects->groupBy(static function (array $project) use ($managerIds): array {
            /** @var Collection<int, string> $ids */
            $ids = collect($project['managers'])->pluck('id');
            if ($ids->isEmpty() && $managerIds->isEmpty()) {
                return ['without_manager'];
            }

            return $ids->filter(static fn (string $id): bool => $managerIds->isEmpty() || $managerIds->contains($id))->all();
        });
        /** @var Collection<string, array<string, mixed>> $rows */
        $rows = $groups->map(static fn (Collection $projects, string $id): array => [
            'manager' => $managers->get($id),
            'income' => (int) $projects->sum('income'),
            'expenses' => (int) $projects->sum('expenses'),
            'profit' => (int) $projects->sum('profit'),
            'projects' => $projects->map(static fn (array $project): array => collect($project)
                ->only(['project', 'client', 'income', 'direct_expenses', 'allocated_expenses', 'expenses', 'profit'])->all())->values()->all(),
        ]);

        return $this->rowsResponse($result, $rows->sortBy('manager.name', SORT_STRING));
    }

    /**
     * Единая оболочка сохраняет формат всех проектных разрезов.
     *
     * @param  Collection<int|string, array<string, mixed>>  $rows
     */
    private function rowsResponse(AnalyticsResultData $result, Collection $rows): array
    {
        return [
            'filters' => $result->filters->toArray(),
            'undistributed_expenses' => $result->undistributedExpenses,
            'data' => $rows->values()->all(),
        ];
    }

    /**
     * Нулевые интервалы нужны графику даже тогда, когда операций в них не было.
     *
     * @param  Collection<int, FinanceAllocationData>  $income
     * @param  Collection<int, FinanceAllocationData>  $expenses
     * @return Collection<int, array<string, int|string>>
     */
    private function histogram(AnalyticsInputData $input, Collection $income, Collection $expenses, PlannedExpensesData $plannedExpenses): Collection
    {
        $incomeDays = $this->bucketAmounts($income);
        $expenseDays = $this->bucketAmounts($expenses);

        return $this->calendar->emptyHistogram($input->filters->from, $input->filters->to, $input->filters->granularity)
            ->map(static function (array $bucket, string $date) use ($input, $incomeDays, $expenseDays, $plannedExpenses): array {
                $income = $incomeDays->get($date, 0);
                $actual = $expenseDays->get($date, 0);
                $plan = $input->filters->isScoped() ? 0 : $plannedExpenses->buckets->get($date, 0);

                return [
                    'date' => $date,
                    'label' => $bucket['label'],
                    'income' => $income,
                    'expenses' => $actual + $plan,
                    'profit' => $income - $actual - $plan,
                    'actual_expenses' => $actual,
                    'planned_expenses' => $plan,
                ];
            })->values();
    }

    /**
     * Локальная карта сумм заменяет изменение гистограммы внутри каждого распределения.
     *
     * @param  Collection<int, FinanceAllocationData>  $parts
     * @return Collection<string, int>
     */
    private function bucketAmounts(Collection $parts): Collection
    {
        return $parts->reduce(static function (Collection $days, FinanceAllocationData $part): Collection {
            foreach ($part->buckets as $date => $amount) {
                $days->put($date, $days->get($date, 0) + $amount);
            }

            return $days;
        }, collect());
    }

    /**
     * Отсутствующая статья остаётся отдельной группой и не теряется из общего итога.
     *
     * @param  Collection<int, FinanceAllocationData>  $parts
     * @return Collection<string, int>
     */
    private function articleAmounts(Collection $parts): Collection
    {
        return $parts->groupBy(static fn (FinanceAllocationData $part): string => $part->finance->finance_article_id ?: 'without_article')
            ->map(fn (Collection $parts): int => $this->amount($parts));
    }

    /** @param  Collection<int, FinanceAllocationData>  $parts */
    private function amount(Collection $parts): int
    {
        return (int) $parts->sum(static fn (FinanceAllocationData $part): int => $part->amount());
    }

    /**
     * Группируем один раз, чтобы не обходить все операции для каждого проекта.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function projectRows(AnalyticsInputData $input, ActualAnalyticsData $actual): Collection
    {
        /** @var Collection<string, Collection<int, FinanceAllocationData>> $byProject */
        $byProject = $actual->allocations->groupBy('projectId');

        return $input->projects->map(fn (Project $project): array => $this->projectRow($project, $byProject->get((string) $project->id, collect())))
            ->filter(static fn (array $row): bool => $input->filters->projectIds->isNotEmpty()
                || $row['income'] !== 0 || $row['expenses'] !== 0 || $row['undistributed_expenses'] !== 0)
            ->sortBy('project.name', SORT_STRING);
    }

    /**
     * Модель даёт сведения о проекте; расчёт хранит лишь суммы, без копий сущностей в DTO.
     *
     * @param  Collection<int, FinanceAllocationData>  $parts
     * @return array<string, mixed>
     */
    private function projectRow(Project $project, Collection $parts): array
    {
        /** @var Collection<int, FinanceAllocationData> $expenses */
        $expenses = $parts->filter(static fn (FinanceAllocationData $part): bool => $part->finance->type === FinanceType::EXPENDITURE);
        /** @var Collection<int, FinanceAllocationData> $direct */
        $direct = $expenses->filter(static fn (FinanceAllocationData $part): bool => ! $part->allocated && ! $part->undistributed);
        /** @var Collection<int, FinanceAllocationData> $allocated */
        $allocated = $expenses->where('allocated', true);
        /** @var Collection<int, FinanceAllocationData> $undistributed */
        $undistributed = $expenses->where('undistributed', true);
        /** @var Collection<int, FinanceAllocationData> $employees */
        $employees = $direct->filter(static fn (FinanceAllocationData $part): bool => (bool) $part->finance->employee_id);
        /** @var Collection<int, FinanceAllocationData> $other */
        $other = $direct->reject(static fn (FinanceAllocationData $part): bool => (bool) $part->finance->employee_id);
        $income = $this->amount($parts->filter(static fn (FinanceAllocationData $part): bool => $part->finance->type === FinanceType::ENTRANCE));
        $directAmount = $this->amount($direct);
        $allocatedAmount = $this->amount($allocated);

        return [
            'project' => ['id' => (string) $project->id, 'name' => $project->name, 'status' => $project->status->value],
            'client' => $project->client ? ['id' => (string) $project->client->id, 'name' => $project->client->name] : null,
            'managers' => $project->members->pluck('user')->filter()->sortBy(static fn (User $user): string => trim($user->name.' '.$user->last_name), SORT_STRING)
                ->map(fn (User $user): array => $this->person($user, (string) $user->id))->values()->all(),
            'income' => $income,
            'direct_expenses' => $directAmount,
            'allocated_expenses' => $allocatedAmount,
            'employee_expenses' => $this->amount($employees),
            'other_expenses' => $this->amount($other) + $allocatedAmount,
            'undistributed_expenses' => $this->amount($undistributed),
            'expenses' => $directAmount + $allocatedAmount,
            'profit' => $income - $directAmount - $allocatedAmount,
            'employees' => $employees->groupBy('finance.employee_id')->map(fn (Collection $parts, string $id): array => [
                'employee' => $this->person($parts->first()->finance->employee, $id),
                'expenses' => $this->amount($parts),
            ])->values()->all(),
            'expense_articles' => $this->expenseArticles($other, false)->all(),
            'allocated_articles' => $this->expenseArticles($allocated, true)->all(),
            'undistributed_articles' => $this->expenseArticles($undistributed, true)->all(),
        ];
    }

    /**
     * Название берётся из первой операции группы, как и метод её распределения.
     *
     * @param  Collection<int, FinanceAllocationData>  $parts
     * @return Collection<int, array<string, mixed>>
     */
    private function expenseArticles(Collection $parts, bool $withMethod): Collection
    {
        return $parts->groupBy(static fn (FinanceAllocationData $part): string => $part->finance->finance_article_id ?: 'without_article')
            ->map(function (Collection $parts) use ($withMethod): array {
                $finance = $parts->first()->finance;
                $row = ['article' => ['id' => $finance->finance_article_id ?: null, 'name' => $finance->article?->name ?: 'Без статьи']];
                if ($withMethod) {
                    $row['distribution_method'] = $finance->distributionMethod()->value;
                }
                $row['expenses'] = $this->amount($parts);

                return $row;
            })->values();
    }

    /** Неполная связь не удаляет расходы заблокированного или отсутствующего сотрудника. */
    private function person(?User $user, string $id): array
    {
        return [
            'id' => $id,
            'name' => trim(trim((string) $user?->name).' '.trim((string) $user?->last_name)),
            'first_name' => (string) $user?->name,
            'last_name' => (string) $user?->last_name,
            'email' => $user?->email,
        ];
    }
}
