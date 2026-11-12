<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data;

use App\Enums\FinanceDistributionProjectMode;
use App\Models\Finance;
use Illuminate\Support\Collection;

/** Карты весов по дням компании и отдельных проектов. */
final readonly class DayWeightsData
{
    /**
     * @param  Collection<string, int>  $all
     * @param  Collection<string, Collection<string, int>>  $projects
     */
    public function __construct(
        public Collection $all = new Collection,
        public Collection $projects = new Collection,
    ) {}

    /**
     * Настройки самого платежа ограничивают базу раньше фильтра экрана.
     *
     * @return Collection<string, int>
     */
    public function weightsForFinance(Finance $finance): Collection
    {
        // Операция проекта использует только дневные веса этого проекта.
        if ($finance->project_id) {
            return $this->projects->get((string) $finance->project_id, collect());
        }

        // Режим ALL использует суммарные веса компании.
        if ($finance->distribution_project_mode !== FinanceDistributionProjectMode::SELECTED) {
            return $this->all;
        }

        // Режим SELECTED суммирует веса выбранных проектов по каждому дню.
        /** @var Collection<string, int> $selectedDays */
        $selectedDays = collect();
        foreach (collect($finance->distribution_project_ids ?? [])->map(strval(...))->unique() as $id) {
            foreach ($this->projects->get($id, collect()) as $day => $weight) {
                $selectedDays->put($day, $selectedDays->get($day, 0) + $weight);
            }
        }

        return $selectedDays;
    }
}
