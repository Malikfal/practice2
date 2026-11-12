<?php

namespace App\Services\Payroll\Calculation\Rates;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollHoursScope;
use App\Enums\PayrollRangeCalculationMethod;
use Illuminate\Support\Collection;

final readonly class PayrollRateSetting
{
    /**
     * @param  Collection<int, PayrollRateRange>  $ranges  Диапазоны расширенной формулы.
     * @param  Collection<int, PayrollProjectRate>  $projectRates  Отдельные ставки за часы проектов.
     */
    public function __construct(
        public EmployeeRateType $rateType,
        public bool $isAdvanced,
        public ?int $defaultRate,
        public bool $splitByProjectType,
        public ?PayrollHoursScope $hoursScope,
        public PayrollRangeCalculationMethod $rangeCalculationMethod,
        public ?string $changedBy,
        public Collection $ranges,
        public Collection $projectRates = new Collection,
    ) {}

    /**
     * Создает настройку ставки из элемента JSON-колонки employee_rates.rate_settings.
     *
     * @param  array<string, mixed>  $data  Сырые данные настройки.
     */
    public static function fromArray(array $data): ?self
    {
        $type = EmployeeRateType::tryFrom((string) ($data['rate_type'] ?? ''));

        if (! $type) {
            return null;
        }

        $ranges = collect($data['ranges'] ?? [])
            ->filter(static fn (mixed $range): bool => is_array($range))
            ->values()
            ->map(static fn (array $range, int $position): PayrollRateRange => PayrollRateRange::fromArray($range, $position))
            ->sortBy(static fn (PayrollRateRange $range): int => $range->position)
            ->values();

        $projectRates = collect($data['project_rates'] ?? [])
            ->filter(static fn (mixed $projectRate): bool => is_array($projectRate))
            ->map(static fn (array $projectRate): ?PayrollProjectRate => PayrollProjectRate::fromArray($projectRate))
            ->filter()
            ->unique(static fn (PayrollProjectRate $projectRate): string => $projectRate->projectId)
            ->values();

        return new self(
            $type,
            (bool) ($data['is_advanced'] ?? false),
            array_key_exists('default_rate', $data) && $data['default_rate'] !== null
                ? (int) $data['default_rate']
                : null,
            (bool) ($data['split_by_project_type'] ?? false),
            PayrollHoursScope::tryFrom((string) ($data['hours_scope'] ?? '')),
            PayrollRangeCalculationMethod::tryFrom(
                (string) ($data['range_calculation_method'] ?? PayrollRangeCalculationMethod::THRESHOLD->value),
            ) ?? PayrollRangeCalculationMethod::THRESHOLD,
            isset($data['changed_by']) ? (string) $data['changed_by'] : null,
            $ranges,
            $projectRates,
        );
    }

    /**
     * Возвращает настройку в формате, пригодном для сохранения в JSON.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'rate_type' => $this->rateType->value,
            'is_advanced' => $this->isAdvanced,
            'default_rate' => $this->defaultRate,
            'split_by_project_type' => $this->splitByProjectType,
            'hours_scope' => $this->hoursScope?->value,
            'range_calculation_method' => $this->rangeCalculationMethod->value,
            'changed_by' => $this->changedBy,
            'ranges' => $this->ranges
                ->map(static fn (PayrollRateRange $range): array => $range->toArray())
                ->values()
                ->all(),
            'project_rates' => $this->projectRates
                ->map(static fn (PayrollProjectRate $projectRate): array => $projectRate->toArray())
                ->values()
                ->all(),
        ];
    }

    /**
     * Возвращает отдельные ставки проектов по project_id.
     *
     * Оклад не делится по проектам, поэтому для него ставки проектов не применяются.
     *
     * @return Collection<string, PayrollProjectRate>
     */
    public function projectRatesById(): Collection
    {
        if (! $this->rateType->isHourly()) {
            return collect();
        }

        return $this->projectRates->keyBy(static fn (PayrollProjectRate $projectRate): string => $projectRate->projectId);
    }
}
