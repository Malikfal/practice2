<?php

namespace App\Repositories\Workspace\FinanceAnalyticsRepositories;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceType;
use App\Models\Finance;
use App\Models\FinanceArticle;
use App\Models\WorkSegment;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class FinanceAnalyticsOperationRepository
{
    /**
     * Финансы и рабочие сегменты задают общий период, доступный во всех разрезах аналитики.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public function periodBounds(string $companyId, string $timezone): array
    {
        $financeBounds = Finance::query()
            ->where('company_id', $companyId)
            ->selectRaw('MIN(LEAST("dateOfPayment", COALESCE(distribution_from, "dateOfPayment"))) AS first_date')
            ->selectRaw('MAX(GREATEST("dateOfPayment", COALESCE(distribution_to, "dateOfPayment"))) AS last_date')
            ->toBase()->first();
        $workBounds = WorkSegment::query()
            ->join('tasks as t', 't.id', '=', 'work_segments.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->where('p.company_id', $companyId)
            ->selectRaw('MIN(work_segments.started_at) AS first_timestamp')
            ->selectRaw('MAX(work_segments.ended_at) AS last_timestamp')
            ->toBase()->first();

        /** @var Collection<int, Carbon> $starts */
        $starts = collect([
            $financeBounds?->first_date,
            $workBounds?->first_timestamp !== null ? Carbon::createFromTimestamp((int) $workBounds->first_timestamp, $timezone) : null,
        ])->filter()->map(static fn (mixed $date): Carbon => $date instanceof Carbon
            ? $date->setTimezone($timezone) : Carbon::parse($date, $timezone));
        /** @var Collection<int, Carbon> $ends */
        $ends = collect([
            $financeBounds?->last_date,
            $workBounds?->last_timestamp !== null ? Carbon::createFromTimestamp((int) $workBounds->last_timestamp, $timezone) : null,
        ])->filter()->map(static fn (mixed $date): Carbon => $date instanceof Carbon
            ? $date->setTimezone($timezone) : Carbon::parse($date, $timezone));

        return [$starts->min() ?? now($timezone), $ends->max() ?? now($timezone)];
    }

    /** @return Collection<int, FinanceArticle> */
    public function articles(string $companyId): Collection
    {
        return FinanceArticle::query()
            ->where('company_id', $companyId)
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name', 'type', 'distribution_method']);
    }

    /** @return Collection<int, Finance> */
    public function finances(string $companyId, Carbon $from, Carbon $to): Collection
    {
        return $this->financeQuery($companyId, $from, $to)
            ->with([
                'article:id,name,distribution_method',
                'employee' => fn ($query) => $query->withBlocked()->select('id', 'name', 'last_name', 'email'),
            ])
            ->orderBy('dateOfPayment')
            ->get([
                'id', 'company_id', 'project_id', 'finance_article_id', 'employee_id', 'amount', 'type', 'comment',
                'dateOfPayment', 'distribution_from', 'distribution_to', 'distribution_method',
                'distribution_project_mode', 'distribution_project_ids',
            ]);
    }

    /** @return Collection<int, Finance> */
    public function expenseDistributionBaseFinances(string $companyId, Carbon $from, Carbon $to): Collection
    {
        return $this->financeQuery($companyId, $from, $to)
            ->with('article:id,distribution_method')
            ->where('type', FinanceType::EXPENDITURE->value)
            ->where(function (Builder $query): void {
                $query
                    ->where(function (Builder $query): void {
                        $query
                            ->where('distribution_method', '!=', FinanceArticleDistributionMethod::PROPORTIONAL_TO_EXPENSES->value)
                            ->orWhere(function (Builder $query): void {
                                $query
                                    ->whereNull('distribution_method')
                                    ->whereDoesntHave('article', fn (Builder $query) => $query->where(
                                        'distribution_method', FinanceArticleDistributionMethod::PROPORTIONAL_TO_EXPENSES->value,
                                    ));
                            });
                    })
                    // Однодневная операция имеет однозначную дату и не создаёт рекурсию в базе расходов.
                    ->orWhere(fn (Builder $query) => $this->whereSingleDayDistribution($query));
            })
            ->get([
                'id', 'project_id', 'finance_article_id', 'amount', 'type', 'dateOfPayment',
                'distribution_from', 'distribution_to', 'distribution_method',
            ]);
    }

    /**
     * Расчёт ФОТ, как и финансовый результат, относит всю сумму к фактической дате платежа;
     * поля распределения здесь не учитываются.
     *
     * @return Collection<int, Finance>
     */
    public function employeeExpenseFinances(string $companyId, Carbon $from, Carbon $to): Collection
    {
        return Finance::query()
            ->where('company_id', $companyId)
            ->whereDate('dateOfPayment', '>=', $from->toDateString())
            ->whereDate('dateOfPayment', '<=', $to->toDateString())
            ->with([
                'employee' => fn ($query) => $query->withBlocked()->select('id', 'name', 'last_name', 'email'),
            ])
            ->where('type', FinanceType::EXPENDITURE->value)
            ->whereNotNull('employee_id')
            ->orderBy('dateOfPayment')
            ->get(['id', 'project_id', 'employee_id', 'amount', 'type', 'dateOfPayment']);
    }

    /** @return Collection<int, Finance> */
    public function unaccountedPayments(string $companyId, Carbon $from, Carbon $to, FinanceType $type): Collection
    {
        $query = Finance::query()
            ->leftJoin('finance_article as article', 'article.id', '=', 'finance.finance_article_id')
            ->where('finance.company_id', $companyId)
            ->where('finance.type', $type->value)
            ->where(fn (Builder $query) => $this->whereDistributionOverlaps($query, $from, $to, 'finance'));
        $effectiveMethod = "COALESCE(finance.distribution_method, article.distribution_method, '"
            .FinanceArticleDistributionMethod::BY_TERM->value."')";

        if ($type === FinanceType::ENTRANCE) {
            $query->whereNull('finance.project_id')->whereNull('finance.distribution_project_mode');
        } else {
            // Расход с project_id уже напрямую относится к проекту; сотрудник для этого не обязателен.
            $query->whereNull('finance.project_id')->whereNull('finance.distribution_project_mode')
                ->where(DB::raw($effectiveMethod), '!=', FinanceArticleDistributionMethod::PROPORTIONAL_TO_EXPENSES->value);
        }

        return $query->orderBy('finance.dateOfPayment')->get([
            'finance.id', 'finance.project_id', 'finance.amount', 'finance.comment', 'finance.dateOfPayment',
            'finance.distribution_from', 'finance.distribution_to', 'finance.distribution_project_mode',
            'finance.distribution_project_ids', 'article.name as article_name',
            DB::raw($effectiveMethod.' as distribution_method'),
        ]);
    }

    /** Одинаковое пересечение периода применяется ко всем выборкам фактических операций.
     * @return Builder<Finance>
     */
    private function financeQuery(string $companyId, Carbon $from, Carbon $to): Builder
    {
        return Finance::query()->where('company_id', $companyId)
            ->where(fn (Builder $query) => $this->whereDistributionOverlaps($query, $from, $to));
    }

    private function whereDistributionOverlaps(Builder $query, Carbon $from, Carbon $to, string $table = ''): void
    {
        $grammar = $query->getQuery()->getGrammar();
        $prefix = $table !== '' ? $table.'.' : '';
        $paymentDate = $grammar->wrap($prefix.'dateOfPayment');
        $distributionFrom = 'COALESCE('.$grammar->wrap($prefix.'distribution_from').', '.$paymentDate.')';
        $distributionTo = 'COALESCE('.$grammar->wrap($prefix.'distribution_to').', '.$paymentDate.')';

        $query->whereRaw($distributionFrom.' <= ?', [$to->toDateString()])
            ->whereRaw($distributionTo.' >= ?', [$from->toDateString()]);
    }

    private function whereSingleDayDistribution(Builder $query, string $table = ''): void
    {
        $grammar = $query->getQuery()->getGrammar();
        $prefix = $table !== '' ? $table.'.' : '';
        $paymentDate = $grammar->wrap($prefix.'dateOfPayment');
        $distributionFrom = 'COALESCE('.$grammar->wrap($prefix.'distribution_from').', '.$paymentDate.')';
        $distributionTo = 'COALESCE('.$grammar->wrap($prefix.'distribution_to').', '.$paymentDate.')';

        $query->whereRaw($distributionFrom.' = '.$distributionTo);
    }
}
