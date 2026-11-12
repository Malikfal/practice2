<?php

namespace App\Jobs\Payroll;

use App\Enums\PayrollRecalculationStatus;
use App\Models\Company;
use App\Models\PayrollRecalculation;
use App\Services\Payroll\Period\PayrollPeriod;
use App\Services\Payroll\Recalculation\CompanyPayrollRecalculationService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;
use Throwable;

class RecalculateCompanyPayrollPeriodJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 300;

    public bool $failOnTimeout = true;

    public function __construct(public readonly string $recalculationId) {}

    /**
     * Не допускает одновременное выполнение одной задачи перерасчета.
     */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("payroll-recalculation:{$this->recalculationId}"))
            ->expireAfter($this->timeout + 60)];
    }

    /**
     * Выполняет перерасчет компании и фиксирует состояние фоновой задачи.
     */
    public function handle(CompanyPayrollRecalculationService $service): void
    {
        $recalculation = PayrollRecalculation::query()->findOrFail($this->recalculationId);
        if ($recalculation->status !== PayrollRecalculationStatus::QUEUED) {
            return;
        }

        $recalculation->update([
            'status' => PayrollRecalculationStatus::RUNNING,
            'started_at' => now(),
            'finished_at' => null,
            'error_message' => null,
        ]);

        try {
            $company = Company::query()->findOrFail($recalculation->company_id);
            $timezone = $company->payrollTimezone();
            $service->recalculate(
                $company,
                new PayrollPeriod(
                    from: Carbon::parse($recalculation->period_from->toDateString(), $timezone)->startOfDay(),
                    to: Carbon::parse($recalculation->period_to->toDateString(), $timezone)->addDay()->startOfDay(),
                ),
            );
            $recalculation->update([
                'status' => PayrollRecalculationStatus::COMPLETED,
                'finished_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $this->markFailed($exception);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $this->markFailed($exception);
    }

    private function markFailed(?Throwable $exception): void
    {
        PayrollRecalculation::query()->whereKey($this->recalculationId)->update([
            'status' => PayrollRecalculationStatus::FAILED,
            'error_message' => Str::limit($exception?->getMessage() ?? 'Перерасчет завершился с ошибкой.', 4000),
            'finished_at' => now(),
        ]);
    }
}
