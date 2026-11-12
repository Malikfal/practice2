<?php

namespace App\Services\Workspace\FinanceAnalyticsServices;

use App\Services\Workspace\FinanceAnalyticsServices\Data\FinanceAnalyticsFiltersData;
use App\Services\Workspace\FinanceAnalyticsServices\Reports\Data\AnalyticsResultData;
use Closure;
use Illuminate\Support\Facades\Cache;

/** Хранит общий результат расчёта, из которого затем строятся overview, projects, clients и managers. */
class FinanceAnalyticsCacheService
{
    private const KEY_PREFIX = 'finance_analytics:v5';

    private const VERSION_PREFIX = 'finance_analytics_version';

    /**
     * Сохраняет DTO как обычный массив, потому что драйвер кеша может запрещать десериализацию PHP-классов.
     * Один ключ на набор фильтров позволяет всем финансовым разрезам использовать один дорогой расчёт.
     *
     * @param  Closure(): AnalyticsResultData  $callback
     */
    public function remember(string $companyId, FinanceAnalyticsFiltersData $filters, Closure $callback): AnalyticsResultData
    {
        $key = $this->analyticsKey($companyId, $filters);
        $cached = Cache::get($key);

        if (is_array($cached)) {
            return AnalyticsResultData::fromCache($filters, $cached);
        }

        if ($cached !== null) {
            // Значение прежнего объектного формата нельзя восстановить при запрещённой десериализации классов.
            Cache::forget($key);
        }

        $result = $callback();
        Cache::put($key, $result->toCache(), $this->ttl($filters));

        return $result;
    }

    /** Меняет версию ключей компании, чтобы не искать и не удалять каждый ранее созданный ключ отдельно. */
    public function invalidateCompany(string $companyId): void
    {
        $versionKey = $this->versionKey($companyId);

        if (! Cache::has($versionKey)) {
            Cache::forever($versionKey, 1);
        }

        Cache::increment($versionKey);
    }

    /** Хеш нормализованных фильтров делает порядок и формат входных параметров независимыми от контроллера. */
    private function analyticsKey(string $companyId, FinanceAnalyticsFiltersData $filters): string
    {
        $version = (int) Cache::get($this->versionKey($companyId), 1);
        $hash = sha1(json_encode([
            'timezone' => $filters->timezone,
            'filters' => $filters->toArray(),
        ], JSON_THROW_ON_ERROR));

        return self::KEY_PREFIX.':'.$companyId.':'.$version.':'.$hash;
    }

    private function versionKey(string $companyId): string
    {
        return self::VERSION_PREFIX.':'.$companyId;
    }

    /** Текущие и короткие периоды обновляются чаще, поскольку их платежи и часы ещё могут изменяться. */
    private function ttl(FinanceAnalyticsFiltersData $filters): int
    {
        $from = $filters->from->copy()->startOfDay();
        $to = $filters->to->copy()->startOfDay();
        $today = now($filters->timezone)->startOfDay();

        if ($to->gte($today)) {
            return 15 * 60;
        }

        if ($from->diffInDays($to) < 30) {
            return 15 * 60;
        }

        return 24 * 60 * 60;
    }
}
