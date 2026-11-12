<?php

namespace App\Services\Workspace\FinancialResultServices\Reports;

use App\Enums\FinanceType;
use App\Models\Finance;
use App\Models\Project;
use App\Models\User;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\CalendarBuckets;
use App\Services\Workspace\FinanceAnalyticsServices\Reports\ArticleTreeBuilder;
use App\Services\Workspace\FinancialResultServices\Data\FinancialResultData;
use App\Services\Workspace\FinancialResultServices\Data\FinancialResultInputData;
use Illuminate\Support\Collection;

/** Собирает API-представления из всех операций компании. */
class FinancialResultReportService
{
    public function __construct(
        private readonly CalendarBuckets $calendar,
        private readonly ArticleTreeBuilder $articleTree,
    ) {}

    public function build(FinancialResultInputData $input): FinancialResultData
    {
        /** @var Collection<int, Finance> $income */
        $income = $input->finances->where('type', FinanceType::ENTRANCE);
        /** @var Collection<int, Finance> $expenses */
        $expenses = $input->finances->where('type', FinanceType::EXPENDITURE);
        $incomeTotal = $this->amount($income);
        $expenseTotal = $this->amount($expenses);

        return new FinancialResultData(
            filters: $input->filters,
            summary: collect([
                'income' => $incomeTotal,
                'expenses' => $expenseTotal,
                'profit' => $incomeTotal - $expenseTotal,
            ]),
            histogram: $this->histogram($input, $income, $expenses),
            incomeArticles: $this->articleTree->build(
                FinanceType::ENTRANCE->value,
                $input->articles,
                $this->articleAmounts($income),
                $incomeTotal,
            ),
            expenseArticles: $this->articleTree->build(
                FinanceType::EXPENDITURE->value,
                $input->articles,
                $this->articleAmounts($expenses),
                $expenseTotal,
            ),
            projects: $this->projectRows($input),
        );
    }

    public function overview(FinancialResultData $result): array
    {
        return [
            'filters' => $result->filters->toArray(),
            'summary' => $result->summary->all(),
            'histogram' => $result->histogram->all(),
            'income_articles' => $result->incomeArticles->all(),
            'expense_articles' => $result->expenseArticles->all(),
        ];
    }

    public function projects(FinancialResultData $result): array
    {
        return $this->rowsResponse($result, $result->projects);
    }

    /** Менеджеру относится полная сумма каждого его проекта; между несколькими менеджерами она не делится. */
    public function managers(FinancialResultData $result): array
    {
        $selectedManagerIds = $result->filters->managerIds;
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
        $groups = $result->projects->groupBy(static function (array $project) use ($selectedManagerIds): array {
            $ids = collect($project['managers'])->pluck('id');

            if ($ids->isEmpty() && $selectedManagerIds->isEmpty()) {
                return ['without_manager'];
            }

            return $ids
                ->filter(static fn (string $id): bool => $selectedManagerIds->isEmpty() || $selectedManagerIds->contains($id))
                ->all();
        });

        $rows = $groups->map(static fn (Collection $projects, string $id): array => [
            'manager' => $managers->get($id),
            'income' => (int) $projects->sum('income'),
            'expenses' => (int) $projects->sum('expenses'),
            'profit' => (int) $projects->sum('profit'),
            'projects' => $projects->map(static fn (array $project): array => collect($project)
                ->only(['project', 'client', 'income', 'direct_expenses', 'expenses', 'profit'])
                ->all())->values()->all(),
        ])->sortBy('manager.name', SORT_STRING);

        return $this->rowsResponse($result, $rows);
    }

    /** Клиентский разрез содержит только агрегат его проектов, без вложенного раскрытия. */
    public function clients(FinancialResultData $result): array
    {
        $rows = $result->projects
            ->groupBy(static fn (array $project): string => $project['client']['id'] ?? 'without_client')
            ->map(static fn (Collection $projects): array => [
                'client' => $projects->first()['client'] ?? ['id' => null, 'name' => 'Без клиента'],
                'income' => (int) $projects->sum('income'),
                'expenses' => (int) $projects->sum('expenses'),
                'profit' => (int) $projects->sum('profit'),
            ])
            ->sortBy('client.name', SORT_STRING);

        return $this->rowsResponse($result, $rows);
    }

    /**
     * @param  Collection<int|string, array<string, mixed>>  $rows
     * @return array{filters: array<string, mixed>, data: list<array<string, mixed>>}
     */
    private function rowsResponse(FinancialResultData $result, Collection $rows): array
    {
        return [
            'filters' => $result->filters->toArray(),
            'data' => $rows->values()->all(),
        ];
    }

    /**
     * @param  Collection<int, Finance>  $income
     * @param  Collection<int, Finance>  $expenses
     * @return Collection<int, array<string, int|string>>
     */
    private function histogram(FinancialResultInputData $input, Collection $income, Collection $expenses): Collection
    {
        $incomeBuckets = $this->bucketAmounts($income, $input);
        $expenseBuckets = $this->bucketAmounts($expenses, $input);

        return $this->calendar
            ->emptyHistogram($input->filters->from, $input->filters->to, $input->filters->granularity)
            ->map(static function (array $bucket, string $date) use ($incomeBuckets, $expenseBuckets): array {
                $income = (int) $incomeBuckets->get($date, 0);
                $expenses = (int) $expenseBuckets->get($date, 0);

                return [
                    'date' => $date,
                    'label' => $bucket['label'],
                    'income' => $income,
                    'expenses' => $expenses,
                    'profit' => $income - $expenses,
                ];
            })
            ->values();
    }

    /**
     * Вся сумма относится к одному интервалу по dateOfPayment; даты аналитического распределения не используются.
     *
     * @param  Collection<int, Finance>  $finances
     * @return Collection<string, int>
     */
    private function bucketAmounts(Collection $finances, FinancialResultInputData $input): Collection
    {
        return $finances->reduce(function (Collection $amounts, Finance $finance) use ($input): Collection {
            $key = $this->calendar->key($finance->dateOfPayment, $input->filters->granularity);
            $amounts->put($key, $amounts->get($key, 0) + $finance->amount);

            return $amounts;
        }, collect());
    }

    /** @param  Collection<int, Finance>  $finances */
    private function articleAmounts(Collection $finances): Collection
    {
        return $finances
            ->groupBy(static fn (Finance $finance): string => $finance->finance_article_id ?: 'without_article')
            ->map(fn (Collection $rows): int => $this->amount($rows));
    }

    /** @param  Collection<int, Finance>  $finances */
    private function amount(Collection $finances): int
    {
        return (int) $finances->sum('amount');
    }

    /** @return Collection<string, array<string, mixed>> */
    private function projectRows(FinancialResultInputData $input): Collection
    {
        /** @var Collection<string, Collection<int, Finance>> $byProject */
        $byProject = $input->finances->groupBy('project_id');
        $knownProjectIds = $input->projects->keys()->map(static fn (mixed $id): string => (string) $id);
        $withoutProject = $input->finances->filter(
            static fn (Finance $finance): bool => ! $finance->project_id
                || ! $knownProjectIds->contains((string) $finance->project_id),
        );

        $rows = $input->projects
            ->map(fn (Project $project): array => $this->projectRow($project, $byProject->get((string) $project->id, collect())))
            ->filter(static fn (array $row): bool => $input->filters->projectIds->isNotEmpty()
                || $row['income'] !== 0 || $row['expenses'] !== 0)
            ->sortBy('project.name', SORT_STRING);

        if ($withoutProject->isNotEmpty()) {
            $rows->put('without_project', $this->projectRow(null, $withoutProject));
        }

        return $rows;
    }

    /**
     * Как и в аналитике, расходы сотрудника раскрываются в employees, а статьи содержат только остальные расходы.
     *
     * @param  Collection<int, Finance>  $finances
     * @return array<string, mixed>
     */
    private function projectRow(?Project $project, Collection $finances): array
    {
        /** @var Collection<int, Finance> $expenses */
        $expenses = $finances->where('type', FinanceType::EXPENDITURE);
        /** @var Collection<int, Finance> $employeeExpenses */
        $employeeExpenses = $expenses->filter(static fn (Finance $finance): bool => (bool) $finance->employee_id);
        /** @var Collection<int, Finance> $otherExpenses */
        $otherExpenses = $expenses->reject(static fn (Finance $finance): bool => (bool) $finance->employee_id);
        /** @var Collection<int, Finance> $incomeFinances */
        $incomeFinances = $finances->where('type', FinanceType::ENTRANCE);
        $income = $this->amount($incomeFinances);
        $expenseTotal = $this->amount($expenses);

        return [
            'project' => [
                'id' => $project ? (string) $project->id : null,
                'name' => $project?->name ?? 'Без проекта',
                'status' => $project?->status->value,
            ],
            'client' => $project?->client
                ? ['id' => (string) $project->client->id, 'name' => $project->client->name]
                : null,
            'managers' => ($project?->members ?? collect())->pluck('user')->filter()
                ->sortBy(static fn (User $user): string => trim($user->name.' '.$user->last_name), SORT_STRING)
                ->map(fn (User $user): array => $this->person($user, (string) $user->id))
                ->values()
                ->all(),
            'income' => $income,
            'direct_expenses' => $expenseTotal,
            'employee_expenses' => $this->amount($employeeExpenses),
            'other_expenses' => $this->amount($otherExpenses),
            'expenses' => $expenseTotal,
            'profit' => $income - $expenseTotal,
            'employees' => $employeeExpenses
                ->groupBy('employee_id')
                ->map(fn (Collection $rows, string $id): array => [
                    'employee' => $this->person($rows->first()->employee, $id),
                    'expenses' => $this->amount($rows),
                ])
                ->values()
                ->all(),
            'income_articles' => $incomeFinances
                ->groupBy(static fn (Finance $finance): string => $finance->finance_article_id ?: 'without_article')
                ->map(fn (Collection $rows): array => [
                    'article' => [
                        'id' => $rows->first()->finance_article_id ?: null,
                        'name' => $rows->first()->article?->name ?: 'Без статьи',
                    ],
                    'income' => $this->amount($rows),
                ])
                ->values()
                ->all(),
            'expense_articles' => $otherExpenses
                ->groupBy(static fn (Finance $finance): string => $finance->finance_article_id ?: 'without_article')
                ->map(fn (Collection $rows): array => [
                    'article' => [
                        'id' => $rows->first()->finance_article_id ?: null,
                        'name' => $rows->first()->article?->name ?: 'Без статьи',
                    ],
                    'expenses' => $this->amount($rows),
                ])
                ->values()
                ->all(),
        ];
    }

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
