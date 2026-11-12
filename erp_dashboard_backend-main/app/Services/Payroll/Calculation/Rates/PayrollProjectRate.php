<?php

namespace App\Services\Payroll\Calculation\Rates;

/** Отдельная ставка сотрудника за часы одного проекта. */
final readonly class PayrollProjectRate
{
    public function __construct(
        public string $projectId,
        public int $rate,
    ) {}

    /**
     * Создает ставку проекта из элемента JSON-настроек.
     *
     * @param  array<string, mixed>  $data  Данные одной ставки проекта из rate_settings.
     */
    public static function fromArray(array $data): ?self
    {
        $projectId = (string) ($data['project_id'] ?? '');

        if ($projectId === '') {
            return null;
        }

        return new self($projectId, (int) ($data['rate'] ?? 0));
    }

    /**
     * Возвращает ставку проекта в формате, пригодном для сохранения в JSON.
     *
     * @return array{project_id:string, rate:int}
     */
    public function toArray(): array
    {
        return [
            'project_id' => $this->projectId,
            'rate' => $this->rate,
        ];
    }
}
