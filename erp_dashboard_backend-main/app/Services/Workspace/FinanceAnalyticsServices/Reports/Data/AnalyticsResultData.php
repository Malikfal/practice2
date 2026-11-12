<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Reports\Data;

use App\Services\Workspace\FinanceAnalyticsServices\Data\FinanceAnalyticsFiltersData;
use Illuminate\Support\Collection;

/** Готовые представления отчёта; только этот результат хранится в общем кэше. */
final readonly class AnalyticsResultData
{
    /** Коллекции содержат уже подготовленные поля API, а не рабочее состояние расчёта.
     * @param  Collection<string, int|bool>  $summary
     * @param  Collection<int, array<string, int|string>>  $histogram
     * @param  Collection<int, array<string, mixed>>  $incomeArticles
     * @param  Collection<int, array<string, mixed>>  $expenseArticles
     * @param  Collection<int, array<string, mixed>>  $plannedArticles
     * @param  Collection<int, array<string, string|null>>  $warnings
     * @param  Collection<string, array<string, mixed>>  $projects
     */
    public function __construct(
        public FinanceAnalyticsFiltersData $filters,
        public Collection $summary,
        public Collection $histogram,
        public Collection $incomeArticles,
        public Collection $expenseArticles,
        public Collection $plannedArticles,
        public Collection $warnings,
        public int $undistributedExpenses,
        public Collection $projects,
    ) {}

    /**
     * Кэш хранит только массивы и скаляры, потому что восстановление PHP-классов отключено в конфигурации.
     *
     * @return array{
     *     summary: array<string, int|bool>,
     *     histogram: list<array<string, int|string>>,
     *     income_articles: list<array<string, mixed>>,
     *     expense_articles: list<array<string, mixed>>,
     *     planned_articles: list<array<string, mixed>>,
     *     warnings: list<array<string, string|null>>,
     *     undistributed_expenses: int,
     *     projects: array<string, array<string, mixed>>
     * }
     */
    public function toCache(): array
    {
        return [
            'summary' => $this->summary->all(),
            'histogram' => $this->histogram->values()->all(),
            'income_articles' => $this->incomeArticles->values()->all(),
            'expense_articles' => $this->expenseArticles->values()->all(),
            'planned_articles' => $this->plannedArticles->values()->all(),
            'warnings' => $this->warnings->values()->all(),
            'undistributed_expenses' => $this->undistributedExpenses,
            'projects' => $this->projects->all(),
        ];
    }

    /**
     * Фильтры берутся из текущего запроса: они уже нормализованы и входят в ключ кэша.
     *
     * @param  array{
     *     summary: array<string, int|bool>,
     *     histogram: list<array<string, int|string>>,
     *     income_articles: list<array<string, mixed>>,
     *     expense_articles: list<array<string, mixed>>,
     *     planned_articles: list<array<string, mixed>>,
     *     warnings: list<array<string, string|null>>,
     *     undistributed_expenses: int,
     *     projects: array<string, array<string, mixed>>
     * }  $data
     */
    public static function fromCache(FinanceAnalyticsFiltersData $filters, array $data): self
    {
        return new self(
            filters: $filters,
            summary: collect($data['summary']),
            histogram: collect($data['histogram']),
            incomeArticles: collect($data['income_articles']),
            expenseArticles: collect($data['expense_articles']),
            plannedArticles: collect($data['planned_articles']),
            warnings: collect($data['warnings']),
            undistributedExpenses: $data['undistributed_expenses'],
            projects: collect($data['projects']),
        );
    }
}
