<?php

namespace Tests\Unit\Payroll;

use App\Services\Payroll\Distribution\PayrollProjectDistributionService;
use Tests\TestCase;

class PayrollProjectDistributionServiceTest extends TestCase
{
    /**
     * Проверяет точную сумму и детерминированное распределение остатка.
     */
    public function test_distribution_preserves_total_amount(): void
    {
        $durations = collect([
            (object) ['project_id' => 'project-b', 'duration_seconds' => 1],
            (object) ['project_id' => 'project-a', 'duration_seconds' => 1],
            (object) ['project_id' => 'project-c', 'duration_seconds' => 1],
        ]);

        $rows = (new PayrollProjectDistributionService)->distribute(100, $durations);

        $this->assertSame(100, $rows->sum('amount'));
        $this->assertSame(['project-b', 'project-a', 'project-c'], $rows->pluck('projectId')->all());
        $this->assertSame([34, 33, 33], $rows->pluck('amount')->all());
    }

    /**
     * Фиксирует прежнее поведение при отсутствии проектных часов.
     */
    public function test_distribution_without_hours_returns_amount_without_project(): void
    {
        $rows = (new PayrollProjectDistributionService)->distribute(100, collect());

        $this->assertCount(1, $rows);
        $this->assertNull($rows->first()->projectId);
        $this->assertSame(100, $rows->first()->amount);
    }

    /**
     * Проверяет сохранение null-проекта, переданного последним fallback-этапом.
     */
    public function test_distribution_accepts_explicit_null_project_weight(): void
    {
        $rows = (new PayrollProjectDistributionService)->distribute(100, collect([
            (object) ['project_id' => null, 'duration_seconds' => 1],
        ]));

        $this->assertCount(1, $rows);
        $this->assertNull($rows->first()->projectId);
        $this->assertSame(100, $rows->first()->amount);
    }
}
