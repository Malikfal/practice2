<?php

namespace App\Repositories\Workspace;

use App\Enums\EmployeeAbsencePaymentMode;
use App\Enums\FinanceType;
use App\Models\EmployeeAbsence;
use App\Models\Finance;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class EmployeeAbsenceRepository
{
    /**
     * @param  array{from?:string, to?:string}  $filters
     * @return Collection<int, EmployeeAbsence>
     */
    public function listForEmployee(User $employee, array $filters = []): Collection
    {
        return EmployeeAbsence::query()
            ->with(['creator', 'updater'])
            ->where('employee_id', $employee->id)
            ->when($filters['from'] ?? null, static fn ($query, string $from) => $query->whereDate('date_to', '>=', $from))
            ->when($filters['to'] ?? null, static fn ($query, string $to) => $query->whereDate('date_from', '<=', $to))
            ->orderByDesc('date_from')
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): EmployeeAbsence
    {
        return EmployeeAbsence::query()
            ->create(array_merge(['id' => (string) Str::uuid()], $attributes))
            ->load(['creator', 'updater']);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(EmployeeAbsence $absence, array $attributes): EmployeeAbsence
    {
        $absence->fill($attributes);
        $absence->save();

        return $absence->load(['creator', 'updater']);
    }

    public function delete(EmployeeAbsence $absence): void
    {
        $absence->delete();
    }

    public function hasOverlap(
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
        ?string $exceptId = null,
    ): bool {
        return EmployeeAbsence::query()
            ->where('employee_id', $employee->id)
            ->whereDate('date_from', '<=', $to->toDateString())
            ->whereDate('date_to', '>=', $from->toDateString())
            ->when($exceptId, static fn ($query, string $id) => $query->where('id', '!=', $id))
            ->exists();
    }

    public function fixedAbsenceForDate(User $employee, CarbonInterface $date): ?EmployeeAbsence
    {
        return EmployeeAbsence::query()
            ->where('employee_id', $employee->id)
            ->where('payment_mode', EmployeeAbsencePaymentMode::FIXED->value)
            ->whereDate('date_from', '<=', $date->toDateString())
            ->whereDate('date_to', '>=', $date->toDateString())
            ->orderBy('date_from')
            ->first();
    }

    /**
     * @return Collection<int, EmployeeAbsence>
     */
    public function fixedAbsencesForPeriod(User $employee, CarbonInterface $from, CarbonInterface $to): Collection
    {
        $toInclusive = Carbon::instance($to)->copy()->subDay();

        if ($toInclusive->lt($from)) {
            return collect();
        }

        return EmployeeAbsence::query()
            ->where('employee_id', $employee->id)
            ->where('payment_mode', EmployeeAbsencePaymentMode::FIXED->value)
            ->whereDate('date_from', '<=', $toInclusive->toDateString())
            ->whereDate('date_to', '>=', $from->toDateString())
            ->orderBy('date_from')
            ->get();
    }

    public function payrollAmountForFixedAmountCalculation(
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
    ): int {
        return (int) Finance::query()
            ->where('company_id', $employee->company_id)
            ->where('employee_id', $employee->id)
            ->where('type', FinanceType::EXPENDITURE->value)
            ->whereDate('dateOfPayment', '>=', $from->toDateString())
            ->whereDate('dateOfPayment', '<=', $to->toDateString())
            ->sum('amount');
    }
}
