<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data;

/** Две независимые базы: фактические расходы и отработанное время. */
final readonly class DistributionWeightsData
{
    /**
     * @param  DayWeightsData  $expenses  Дневные суммы базовых расходов для PROPORTIONAL_TO_EXPENSES.
     * @param  DayWeightsData  $volume  Дневные секунды работы для BY_VOLUME.
     */
    public function __construct(
        public DayWeightsData $expenses = new DayWeightsData,
        public DayWeightsData $volume = new DayWeightsData,
    ) {}
}
