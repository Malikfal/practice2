<?php

namespace App\Services\Workspace;

use App\Enums\PayrollRecalculationStatus;
use App\Enums\UserPermission;
use App\Jobs\Payroll\RecalculateCompanyPayrollPeriodJob;
use App\Models\Company;
use App\Models\PayrollRecalculation;
use App\Models\User;
use App\Services\Payroll\Period\PayrollPeriod;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PayrollRecalculationService
{
    /**
     * Ставит завершенный период компании в отдельную очередь перерасчетов.
     */
    public function dispatch(User $actor, string $periodFrom, string $periodTo): PayrollRecalculation
    {
        $company = $this->company($actor);
        $period = $this->period($company, $periodFrom, $periodTo);

        try {
            $recalculation = DB::transaction(function () use ($actor, $company, $period): PayrollRecalculation {
                $existing = PayrollRecalculation::query()
                    ->where('company_id', $company->id)
                    ->whereDate('period_from', $period->from->toDateString())
                    ->whereDate('period_to', $period->paymentDate()->toDateString())
                    ->lockForUpdate()
                    ->first();

                if ($existing?->status?->isActive()) {
                    throw new ConflictHttpException('Перерасчет компании за выбранный период уже выполняется.');
                }

                $attributes = [
                    'company_id' => $company->id,
                    'requested_by' => $actor->id,
                    'period_from' => $period->from->toDateString(),
                    'period_to' => $period->paymentDate()->toDateString(),
                    'status' => PayrollRecalculationStatus::QUEUED,
                    'error_message' => null,
                    'started_at' => null,
                    'finished_at' => null,
                ];

                if ($existing) {
                    $existing->update($attributes);

                    return $existing->fresh();
                }

                return PayrollRecalculation::query()->create([
                    'id' => (string) Str::uuid(),
                    ...$attributes,
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw new ConflictHttpException('Перерасчет компании за выбранный период уже выполняется.');
        }

        RecalculateCompanyPayrollPeriodJob::dispatch((string) $recalculation->id)
            ->onConnection((string) config('payroll.recalculation_queue_connection', 'database_payroll_recalculation'))
            ->onQueue((string) config('payroll.recalculation_queue', 'payroll_recalculation'))
            ->afterCommit();

        return $recalculation;
    }

    /**
     * Возвращает состояние перерасчета компании за период.
     */
    public function show(User $actor, string $periodFrom, string $periodTo): ?PayrollRecalculation
    {
        $company = $this->company($actor);
        $period = $this->period($company, $periodFrom, $periodTo, requireCompleted: false);

        return PayrollRecalculation::query()
            ->where('company_id', $company->id)
            ->whereDate('period_from', $period->from->toDateString())
            ->whereDate('period_to', $period->paymentDate()->toDateString())
            ->first();
    }

    private function company(User $actor): Company
    {
        if (! $actor->can(UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value) || ! $actor->company) {
            throw new NotFoundHttpException;
        }

        return $actor->company;
    }

    /**
     * Проверяет, что границы совпадают с закрываемым недельным или месячным периодом.
     */
    private function period(Company $company, string $periodFrom, string $periodTo, bool $requireCompleted = true): PayrollPeriod
    {
        $timezone = $company->payrollTimezone();
        $from = Carbon::parse($periodFrom, $timezone)->startOfDay();
        $end = Carbon::parse($periodTo, $timezone)->startOfDay();
        $expected = PayrollPeriod::endingOn($end);

        if (! $expected || ! $expected->from->equalTo($from)) {
            throw ValidationException::withMessages([
                'period_from' => ['Период должен соответствовать границам недели с учетом конца месяца.'],
            ]);
        }
        if ($requireCompleted && $end->gte(Carbon::now($timezone)->startOfDay())) {
            throw ValidationException::withMessages([
                'period_to' => ['Можно пересчитывать только завершенные периоды.'],
            ]);
        }

        return $expected;
    }
}
