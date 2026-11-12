<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Data;

use App\Enums\FinanceAnalyticsGranularity;
use Carbon\Carbon;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Support\Collection;

/**
 * Проверенные и нормализованные фильтры для расчётов аналитики и ключей кэша.
 *
 * @property-read FinanceAnalyticsGranularity $granularity
 * @property-read string $timezone
 * @property-read Collection<int, string> $projectIds
 * @property-read Collection<int, string> $clientIds
 * @property-read Collection<int, string> $managerIds
 */
final readonly class FinanceAnalyticsFiltersData implements Arrayable
{
    public function __construct(
        public Carbon $from,
        public Carbon $to,
        public FinanceAnalyticsGranularity $granularity,
        public string $timezone,
        public Collection $projectIds,
        public Collection $clientIds,
        public Collection $managerIds,
    ) {}

    /** Один признак фильтрации используется расчётом и отчётами. */
    public function isScoped(): bool
    {
        return $this->projectIds->isNotEmpty() || $this->clientIds->isNotEmpty() || $this->managerIds->isNotEmpty();
    }

    /**
     * Возвращает стабильное скалярное представление для ответа API и ключа кэша.
     *
     * @return array{from:string,to:string,granularity:string,project_ids:list<string>,client_ids:list<string>,manager_ids:list<string>}
     */
    public function toArray(): array
    {
        return [
            'from' => $this->from->toDateString(),
            'to' => $this->to->toDateString(),
            'granularity' => $this->granularity->value,
            'project_ids' => $this->projectIds->values()->all(),
            'client_ids' => $this->clientIds->values()->all(),
            'manager_ids' => $this->managerIds->values()->all(),
        ];
    }
}
