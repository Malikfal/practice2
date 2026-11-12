<?php

namespace App\Services\Payroll\Calculation\Rates;

use App\Enums\PayrollProjectHoursType;

final readonly class PayrollRateRange
{
    public function __construct(
        public PayrollProjectHoursType $projectHoursType,
        public float $fromHours,
        public ?float $toHours,
        public int $rate,
        public int $position,
    ) {}

    /**
     * Создает диапазон ставки из элемента JSON-настроек.
     *
     * @param  array<string, mixed>  $data  Данные одного диапазона из rate_settings.
     * @param  int  $position  Порядковый номер диапазона в настройке.
     */
    public static function fromArray(array $data, int $position): self
    {
        return new self(
            PayrollProjectHoursType::tryFrom((string) ($data['project_hours_type'] ?? PayrollProjectHoursType::ALL->value))
                ?? PayrollProjectHoursType::ALL,
            (float) ($data['from_hours'] ?? 0),
            array_key_exists('to_hours', $data) && $data['to_hours'] !== null
                ? (float) $data['to_hours']
                : null,
            (int) ($data['rate'] ?? 0),
            (int) ($data['position'] ?? $position),
        );
    }

    /**
     * Возвращает диапазон в формате, пригодном для сохранения в JSON.
     *
     * @return array{project_hours_type:string, from_hours:float, to_hours:?float, rate:int, position:int}
     */
    public function toArray(): array
    {
        return [
            'project_hours_type' => $this->projectHoursType->value,
            'from_hours' => $this->fromHours,
            'to_hours' => $this->toHours,
            'rate' => $this->rate,
            'position' => $this->position,
        ];
    }
}
