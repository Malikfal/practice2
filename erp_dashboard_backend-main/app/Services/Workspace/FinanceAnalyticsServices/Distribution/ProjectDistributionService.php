<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Distribution;

use App\Enums\FinanceArticleDistributionMethod as Method;
use App\Enums\FinanceDistributionProjectMode as Mode;
use App\Models\Finance;
use App\Models\Project;
use App\Models\ProjectActivityHistory;
use App\Services\Workspace\FinanceAnalyticsServices\Data\FinanceAnalyticsFiltersData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionPeriodData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionWeightsData;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/** Выбирает проекты и рассчитывает их доли; не знает о сводке и детализации API. */
class ProjectDistributionService
{
    /**
     * Возвращает знаменатель проектного распределения, не распределяя деньги самостоятельно.
     * SELECTED сначала ограничивает допустимые проекты настройкой платежа; метод выбирает вес расходов, часов или активных дней.
     * Активность проверяется в периоде операции, а доля — в пересечении с отчётом.
     *
     * @param  Collection<int|string, Project>  $projects
     * @return Collection<string, int>
     */
    public function weightsForFinance(Finance $finance, Collection $projects, FinanceAnalyticsFiltersData $filters, DistributionWeightsData $weights): Collection
    {
        $period = DistributionPeriodData::fromFinance($finance, $filters->timezone);

        /** @var Collection<int|string, Project> $projects */
        $projects = $projects->filter(fn (Project $project): bool => $this->activeDaysBetween($project, $period->from, $period->to) > 0);

        if ($finance->distribution_project_mode === Mode::SELECTED) {
            // Порядок настройки определяет получателя остатка при равных дробных долях.
            /** @var Collection<string, Project> $byId */
            $byId = $projects->keyBy('id');
            $projects = collect($finance->distribution_project_ids ?? [])->map(strval(...))->unique()
                ->map(fn (string $id) => $byId->get($id))->filter()->values();
        }
        $from = $period->from->max($filters->from)->copy()->startOfDay();
        $to = $period->to->min($filters->to)->copy()->startOfDay();
        $method = $finance->distributionMethod();

        if ($method !== Method::BY_TERM) {
            $base = $method === Method::PROPORTIONAL_TO_EXPENSES ? $weights->expenses : $weights->volume;
            /** @var Collection<string, int> $weighted */
            $weighted = $projects->mapWithKeys(function (Project $project) use ($base, $from, $to): array {
                $amount = $base->projects->get((string) $project->id, collect())
                    ->filter(static fn ($weight, $day): bool => $weight > 0 && $day >= $from->toDateString()
                        && $day <= $to->toDateString())
                    ->filter(fn ($weight, $day): bool => $this->isActiveOn($project, (string) $day))
                    ->sum();

                return $amount > 0 ? [(string) $project->id => (int) $amount] : [];
            });
            if ($weighted->isNotEmpty()) {
                return $weighted;
            }
        }

        // Без расходов или часов весом становится число активных дней проекта.
        return $projects->mapWithKeys(function (Project $project) use ($from, $to): array {
            $days = $this->activeDaysBetween($project, $from, $to);

            return $days > 0 ? [(string) $project->id => $days] : [];
        });
    }

    private function isActiveOn(Project $project, string $day): bool
    {
        return $project->activityHistories->contains(
            static fn (ProjectActivityHistory $period): bool => $period->started_on->toDateString() <= $day
                && ($period->ended_on === null || $day < $period->ended_on->toDateString()),
        );
    }

    private function activeDaysBetween(Project $project, Carbon $from, Carbon $to): int
    {
        return (int) $project->activityHistories->sum(
            static function (ProjectActivityHistory $period) use ($from, $to): int {
                $timezone = $from->getTimezone()->getName();
                $periodFrom = Carbon::parse($period->started_on->toDateString(), $timezone)->startOfDay();
                $activeFrom = $from->copy()->max($periodFrom)->startOfDay();
                $activeUntil = $to->copy()->addDay()->startOfDay();
                if ($period->ended_on !== null) {
                    $periodUntil = Carbon::parse($period->ended_on->toDateString(), $timezone)->startOfDay();
                    $activeUntil = $activeUntil->min($periodUntil);
                }

                return $activeFrom->lt($activeUntil)
                    ? (int) $activeFrom->diffInDays($activeUntil)
                    : 0;
            },
        );
    }
}
