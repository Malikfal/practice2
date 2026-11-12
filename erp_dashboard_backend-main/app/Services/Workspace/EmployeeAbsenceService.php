<?php

namespace App\Services\Workspace;

use App\Enums\EmployeeAbsencePaymentMode;
use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Models\Company;
use App\Models\EmployeeAbsence;
use App\Models\User;
use App\Repositories\Workspace\EmployeeAbsenceRepository;
use App\Repositories\Workspace\Reports\TimeReportRepository;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Carbon\CarbonPeriod;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class EmployeeAbsenceService
{
    public function __construct(
        private readonly EmployeeAbsenceRepository $absences,
        private readonly TimeReportRepository $timeReports,
    ) {}

    /**
     * @param  array{from?:string, to?:string}  $data
     * @return Collection<int, EmployeeAbsence>
     */
    public function list(User $user, User $employee, array $data = []): Collection
    {
        $this->assertEmployeeAccess($user, $employee, allowSelfWithoutPermission: true);

        return $this->absences->listForEmployee($employee, $data);
    }

    /**
     * @param  array{from?:string, to?:string}  $data
     * @return array{from:string, to:string, days:list<array<string, mixed>>, summary:array<string, int>}
     */
    public function calendar(User $user, User $employee, array $data = []): array
    {
        $this->assertEmployeeAccess($user, $employee, allowSelfWithoutPermission: true);

        $from = isset($data['from']) ? Carbon::parse($data['from'])->startOfDay() : now()->startOfMonth();
        $to = isset($data['to']) ? Carbon::parse($data['to'])->startOfDay() : now()->endOfMonth()->startOfDay();
        $absences = $this->list($user, $employee, [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
        ]);
        $absencesByDate = $this->absencesByDate($absences);
        $workedSeconds = $this->workedSecondsByDate($employee, $from, $to);

        $days = [];
        foreach (CarbonPeriod::create($from, $to) as $day) {
            $absence = $absencesByDate[$day->toDateString()] ?? null;
            $days[] = [
                'date' => $day->toDateString(),
                'is_working_day' => $day->isWeekday(),
                'worked_seconds' => $workedSeconds[$day->toDateString()] ?? 0,
                'absence' => $absence ? [
                    'id' => (string) $absence->id,
                    'type' => $absence->type?->value,
                    'payment_mode' => $absence->payment_mode?->value,
                    'fixed_daily_amount' => $absence->fixed_daily_amount,
                    'coefficient' => (float) ($absence->coefficient ?? 1),
                    'comment' => $absence->comment,
                ] : null,
            ];
        }

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'days' => $days,
            'summary' => $absences
                ->groupBy(static fn (EmployeeAbsence $absence): string => (string) $absence->type?->value)
                ->map(fn (Collection $group): int => (int) $group->sum(
                    fn (EmployeeAbsence $absence): int => $this->daysCount($absence->date_from, $absence->date_to),
                ))
                ->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function store(User $user, User $employee, array $data): EmployeeAbsence
    {
        $this->assertEmployeeAccess($user, $employee);
        $this->assertValidPaymentMode($data);

        $from = Carbon::parse($data['date_from'])->startOfDay();
        $to = Carbon::parse($data['date_to'])->startOfDay();
        if (! $this->canChangePastDays($user)) {
            $this->assertCanCreate($from, $this->today($employee));
        }
        $this->assertNoOverlap($employee, $from, $to);

        return $this->absences->create([
            'company_id' => $this->employeeCompanyId($employee),
            'employee_id' => $employee->id,
            'type' => $data['type'],
            'date_from' => $from->toDateString(),
            'date_to' => $to->toDateString(),
            'payment_mode' => $data['payment_mode'],
            'fixed_daily_amount' => $this->fixedDailyAmount($data),
            'coefficient' => $this->coefficient($data),
            'comment' => $data['comment'] ?? null,
            'created_by' => $user->id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(User $user, EmployeeAbsence $absence, array $data): EmployeeAbsence
    {
        $this->assertAbsenceAccess($user, $absence);
        $this->assertValidPaymentMode($data);

        $from = Carbon::parse($data['date_from'])->startOfDay();
        $to = Carbon::parse($data['date_to'])->startOfDay();
        $employee = $absence->employee;

        if (! $employee) {
            throw new NotFoundHttpException;
        }

        if (! $this->canChangePastDays($user)) {
            $this->assertCanUpdate($absence, $data, $from, $to, $this->today($employee));
        }
        $this->assertNoOverlap($employee, $from, $to, (string) $absence->id);

        return $this->absences->update($absence, [
            'type' => $data['type'],
            'date_from' => $from->toDateString(),
            'date_to' => $to->toDateString(),
            'payment_mode' => $data['payment_mode'],
            'fixed_daily_amount' => $this->fixedDailyAmount($data),
            'coefficient' => $this->coefficient($data),
            'comment' => $data['comment'] ?? null,
            'updated_by' => $user->id,
        ]);
    }

    public function delete(User $user, EmployeeAbsence $absence): void
    {
        $this->assertAbsenceAccess($user, $absence);
        if (! $this->canChangePastDays($user)) {
            $this->assertCanDelete($absence, Carbon::parse(Company::todayFor((string) $absence->company_id)));
        }

        $this->absences->delete($absence);
    }

    /**
     * Админ компании может отмечать и исправлять прошедшие дни; перерасчет ФОТ после этого запускается отдельно.
     */
    private function canChangePastDays(User $user): bool
    {
        return in_array((string) $user->role, [UserRole::ADMIN->value, UserRole::SUPERADMIN->value], true);
    }

    /**
     * Сегодняшняя дата в часовом поясе компании сотрудника.
     */
    private function today(User $employee): Carbon
    {
        return Carbon::parse(Company::todayFor($this->employeeCompanyId($employee)));
    }

    /**
     * Собственное время сотрудника по локальным дням компании, по тем же правилам, что отчет по времени.
     *
     * @return array<string, int>
     */
    private function workedSecondsByDate(User $employee, CarbonInterface $from, CarbonInterface $to): array
    {
        $companyId = $this->employeeCompanyId($employee);
        $timezone = $this->timeReports->timezoneForCompany($companyId);
        $periodFrom = Carbon::parse($from->toDateString(), $timezone)->startOfDay();
        $periodTo = Carbon::parse($to->toDateString(), $timezone)->startOfDay()->addDay();

        return $this->timeReports
            ->own($companyId, $periodFrom, $periodTo, 'day', userIds: [(string) $employee->id], timezone: $timezone)
            ->mapWithKeys(static fn (object $row): array => [(string) $row->date => (int) $row->duration_seconds])
            ->all();
    }

    /**
     * @param  Collection<int, EmployeeAbsence>  $absences
     * @return array<string, EmployeeAbsence>
     */
    private function absencesByDate(Collection $absences): array
    {
        $dates = [];

        foreach ($absences as $absence) {
            foreach (CarbonPeriod::create($absence->date_from, $absence->date_to) as $day) {
                $dates[$day->toDateString()] = $absence;
            }
        }

        return $dates;
    }

    private function assertValidPaymentMode(array $data): void
    {
        $paymentMode = EmployeeAbsencePaymentMode::from($data['payment_mode']);
        $fixedDailyAmount = $data['fixed_daily_amount'] ?? null;

        if ($paymentMode === EmployeeAbsencePaymentMode::DEFAULT && $fixedDailyAmount !== null) {
            throw ValidationException::withMessages([
                'fixed_daily_amount' => ['Фиксированная сумма указывается только для фиксированной оплаты.'],
            ]);
        }

        if ($paymentMode === EmployeeAbsencePaymentMode::FIXED && $fixedDailyAmount === null) {
            throw ValidationException::withMessages([
                'fixed_daily_amount' => ['Укажите фиксированную сумму за день.'],
            ]);
        }
    }

    private function assertNoOverlap(User $employee, CarbonInterface $from, CarbonInterface $to, ?string $exceptId = null): void
    {
        if ($this->absences->hasOverlap($employee, $from, $to, $exceptId)) {
            throw ValidationException::withMessages([
                'date_from' => ['Период пересекается с уже созданным отпуском, отгулом или больничным.'],
            ]);
        }
    }

    private function assertCanCreate(CarbonInterface $from, CarbonInterface $today): void
    {
        if ($from->lt($today)) {
            throw ValidationException::withMessages([
                'date_from' => ['Нельзя создать отпуск, отгул или больничный задним числом.'],
            ]);
        }
    }

    private function assertCanUpdate(
        EmployeeAbsence $absence,
        array $data,
        CarbonInterface $from,
        CarbonInterface $to,
        CarbonInterface $today,
    ): void {
        if ($absence->date_to->lt($today)) {
            throw ValidationException::withMessages([
                'date_from' => ['Нельзя изменить отпуск, отгул или больничный, который уже прошел.'],
            ]);
        }

        if ($absence->date_from->gte($today)) {
            $this->assertCanCreate($from, $today);

            return;
        }

        $minInterruptedTo = $today->copy()->subDay();
        if ($from->toDateString() !== $absence->date_from->toDateString()) {
            throw ValidationException::withMessages([
                'date_from' => ['Нельзя изменить дату начала уже начавшегося отпуска, отгула или больничного.'],
            ]);
        }

        if ($to->lt($minInterruptedTo)) {
            throw ValidationException::withMessages([
                'date_to' => ['Нельзя прервать отпуск, отгул или больничный раньше текущего дня.'],
            ]);
        }

        foreach (['type', 'payment_mode', 'fixed_daily_amount', 'coefficient'] as $field) {
            $current = $absence->{$field};
            $currentValue = $current instanceof \BackedEnum ? $current->value : $current;
            $nextValue = $field === 'coefficient'
                ? $this->coefficient($data)
                : ($data[$field] ?? null);

            if ($field === 'coefficient') {
                $currentValue = number_format((float) ($currentValue ?? 1), 4, '.', '');
                $nextValue = number_format((float) $nextValue, 4, '.', '');
            }

            if ((string) $currentValue !== (string) $nextValue) {
                throw ValidationException::withMessages([
                    $field => ['Нельзя изменить тип или способ оплаты уже начавшегося отпуска, отгула или больничного.'],
                ]);
            }
        }
    }

    private function assertCanDelete(EmployeeAbsence $absence, CarbonInterface $today): void
    {
        if ($absence->date_from->lt($today)) {
            throw ValidationException::withMessages([
                'date_from' => ['Нельзя удалить отпуск, отгул или больничный, который уже начался. Его можно только прервать.'],
            ]);
        }
    }

    private function assertEmployeeAccess(
        User $user,
        User $employee,
        bool $allowSelfWithoutPermission = false,
    ): void {
        if ($allowSelfWithoutPermission && (string) $user->id === (string) $employee->id) {
            return;
        }

        $this->assertAbsencesPermission($user);

        if ($user->isSuperAdmin()) {
            $this->employeeCompanyId($employee);

            return;
        }

        if ((string) $user->company_id === '' || (string) $user->company_id !== (string) $employee->company_id) {
            throw new NotFoundHttpException;
        }
    }

    private function assertAbsenceAccess(User $user, EmployeeAbsence $absence): void
    {
        $this->assertAbsencesManagePermission($user);

        if ($user->isSuperAdmin()) {
            return;
        }

        if ((string) $user->company_id === '' || (string) $user->company_id !== (string) $absence->company_id) {
            throw new NotFoundHttpException;
        }
    }

    private function assertAbsencesPermission(User $user): void
    {
        if ($user->isSuperAdmin()) {
            return;
        }

        if (! $user->can(UserPermission::EMPLOYEES_TABS_ABSENCES_VIEW->value)) {
            throw new NotFoundHttpException;
        }
    }

    private function assertAbsencesManagePermission(User $user): void
    {
        if ($user->isSuperAdmin()) {
            return;
        }

        if (! $user->can(UserPermission::EMPLOYEES_ABSENCES_MANAGE->value)) {
            throw new NotFoundHttpException;
        }
    }

    private function employeeCompanyId(User $employee): string
    {
        $companyId = (string) $employee->company_id;

        if ($companyId === '') {
            throw new NotFoundHttpException;
        }

        return $companyId;
    }

    private function daysCount(CarbonInterface $from, CarbonInterface $to): int
    {
        return (int) $from->diffInDays($to) + 1;
    }

    private function fixedDailyAmount(array $data): ?int
    {
        if ($data['payment_mode'] !== EmployeeAbsencePaymentMode::FIXED->value) {
            return null;
        }

        return (int) $data['fixed_daily_amount'];
    }

    private function coefficient(array $data): float
    {
        if ($data['payment_mode'] !== EmployeeAbsencePaymentMode::FIXED->value) {
            return 1.0;
        }

        return isset($data['coefficient']) ? (float) $data['coefficient'] : 1.0;
    }
}
