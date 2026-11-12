<?php

namespace App\Services\Workspace;

use App\Enums\FinanceType;
use App\Enums\UserPermission;
use App\Models\Company;
use App\Models\Finance;
use App\Models\User;
use App\Services\Payroll\Hours\PayrollHoursService;
use App\Services\Payroll\Period\PayrollPeriod;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Сводка расчёта ФОТ компании по периодам и сотрудникам.
 *
 * Базой служат те же payroll-периоды, что в перерасчёте: неделя, разрезанная по границе месяца.
 * Месяц, квартал и год собираются из этих периодов, поэтому их часы и начисления
 * всегда равны сумме недель внутри.
 */
class CompanyPayrollSummaryService
{
    public const GROUP_WEEK = 'week';

    public const GROUP_MONTH = 'month';

    public const GROUP_QUARTER = 'quarter';

    public const GROUP_YEAR = 'year';

    public const GROUPS = [self::GROUP_WEEK, self::GROUP_MONTH, self::GROUP_QUARTER, self::GROUP_YEAR];

    public function __construct(private readonly PayrollHoursService $payrollHours) {}

    /**
     * Без from и to берётся текущий месяц компании. Границы расширяются до целых периодов,
     * а будущие недели отбрасываются.
     *
     * @param  array{from?:string, to?:string, group_by?:string}  $data
     * @return array<string, mixed>
     */
    public function summarize(User $user, Company $company, array $data): array
    {
        if (! $user->can(UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value)) {
            throw new NotFoundHttpException;
        }

        if (! $user->isSuperAdmin() && (string) $user->company_id !== (string) $company->id) {
            throw new NotFoundHttpException;
        }

        $groupBy = in_array($data['group_by'] ?? null, self::GROUPS, true) ? $data['group_by'] : self::GROUP_WEEK;
        $timezone = $company->payrollTimezone();
        $today = Carbon::now($timezone)->startOfDay();
        $lastDay = $today->copy()->endOfWeek(CarbonInterface::SUNDAY)->startOfDay();
        $requestedFrom = ! empty($data['from'])
            ? Carbon::parse($data['from'], $timezone)->startOfDay()
            : $today->copy()->startOfMonth();
        $requestedTo = ! empty($data['to'])
            ? Carbon::parse($data['to'], $timezone)->startOfDay()
            : $today->copy()->endOfMonth()->startOfDay();
        $from = $this->periodStart($requestedFrom);
        $to = $this->periodEnd($requestedTo);
        if ($to->greaterThan($lastDay)) {
            $to = $lastDay;
        }

        $employees = $company->employees()->get()
            ->keyBy(static fn (User $employee): string => (string) $employee->id);
        $periods = $from->lessThanOrEqualTo($to)
            ? PayrollPeriod::between($from, $to->copy()->addDay())
            : collect();
        $amounts = $periods->isEmpty() ? [] : $this->amountsByPeriod($company, $employees->keys(), $from, $to);

        $periodRows = $periods
            ->map(fn (PayrollPeriod $period): array => $this->periodRow($company, $employees, $period, $amounts, $groupBy))
            ->reverse()
            ->values();

        $groups = $periodRows
            ->groupBy('group_key')
            ->map(fn (Collection $rows, string $key): array => $this->groupRow($key, $rows, $groupBy, $today))
            ->values();

        $employeeTotals = $this->sumValues($periodRows->pluck('values')->flatten(1));

        return [
            'requested_from' => $requestedFrom->toDateString(),
            'requested_to' => $requestedTo->toDateString(),
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'today' => $today->toDateString(),
            'group_by' => $groupBy,
            'available_from' => $this->firstFinanceDate($company)?->toDateString(),
            'totals' => [
                ...$this->sumTotals($periodRows),
                'employees_count' => count($employeeTotals),
                'periods_count' => $periodRows->count(),
            ],
            'employees' => collect($employeeTotals)
                ->map(static fn (array $totals, string $id): array => [
                    'employee' => $employees->get($id),
                    ...$totals,
                ])
                ->sortBy(static fn (array $row): string => mb_strtolower(
                    trim("{$row['employee']->first_name} {$row['employee']->last_name}") ?: (string) $row['employee']->name,
                ))
                ->values(),
            'groups' => $groups,
            'periods' => $periodRows,
        ];
    }

    /**
     * @param  Collection<string, User>  $employees
     * @param  array<string, array<string, int>>  $amounts
     * @return array<string, mixed>
     */
    private function periodRow(
        Company $company,
        Collection $employees,
        PayrollPeriod $period,
        array $amounts,
        string $groupBy,
    ): array {
        $own = $this->payrollHours->ownSecondsByEmployee($company, $period->from, $period->to);
        $supervised = $this->payrollHours->supervisedSecondsByEmployee($company, $period->from, $period->to);
        $periodAmounts = $amounts[$period->from->toDateString()] ?? [];
        $values = [];

        foreach ($employees->keys() as $employeeId) {
            $value = [
                'own_seconds' => (int) ($own[$employeeId] ?? 0),
                'supervised_seconds' => (int) ($supervised[$employeeId] ?? 0),
                'amount_kopecks' => (int) ($periodAmounts[$employeeId] ?? 0),
            ];

            // Сотрудник попадает в период, если у него есть часы или начисления.
            if ($value['own_seconds'] !== 0 || $value['supervised_seconds'] !== 0 || $value['amount_kopecks'] !== 0) {
                $values[] = ['employee_id' => $employeeId, ...$value];
            }
        }

        return [
            'key' => $period->from->toDateString(),
            'group_key' => $this->groupKey($period->from, $groupBy),
            'from' => $period->from->toDateString(),
            'to' => $period->paymentDate()->toDateString(),
            ...$this->sumTotals(collect($values)),
            'employees_count' => count($values),
            'values' => $values,
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows  периоды группы, от новых к старым
     * @return array<string, mixed>
     */
    private function groupRow(string $key, Collection $rows, string $groupBy, Carbon $today): array
    {
        $from = Carbon::parse((string) $rows->last()['from']);
        $to = Carbon::parse((string) $rows->first()['to']);
        [$calendarFrom, $calendarTo] = match ($groupBy) {
            self::GROUP_MONTH => [$from->copy()->startOfMonth(), $from->copy()->endOfMonth()->startOfDay()],
            self::GROUP_QUARTER => [$from->copy()->firstOfQuarter(), $from->copy()->lastOfQuarter()],
            self::GROUP_YEAR => [$from->copy()->startOfYear(), $from->copy()->endOfYear()->startOfDay()],
            default => [$from->copy(), $to->copy()],
        };
        $values = $this->sumValues($rows->pluck('values')->flatten(1));
        $todayDate = $today->toDateString();

        return [
            'key' => $key,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'calendar_from' => $calendarFrom->toDateString(),
            'calendar_to' => $calendarTo->toDateString(),
            'is_current' => $calendarFrom->toDateString() <= $todayDate && $todayDate <= $calendarTo->toDateString(),
            'periods_count' => $rows->count(),
            ...$this->sumTotals($rows),
            'employees_count' => count($values),
            'values' => collect($values)
                ->map(static fn (array $value, string $employeeId): array => ['employee_id' => $employeeId, ...$value])
                ->values()
                ->all(),
        ];
    }

    /**
     * Начисления сотрудников по началу периода: финансовая строка относится к периоду своей даты платежа,
     * как в EmployeePayrollCalculationService::payrollFinances().
     *
     * @param  Collection<int, string>  $employeeIds
     * @return array<string, array<string, int>> period_from => employee_id => копейки
     */
    private function amountsByPeriod(Company $company, Collection $employeeIds, Carbon $from, Carbon $to): array
    {
        $amounts = [];

        Finance::query()
            ->where('company_id', $company->id)
            ->whereIn('employee_id', $employeeIds->all())
            ->where('type', FinanceType::EXPENDITURE->value)
            ->whereDate('dateOfPayment', '>=', $from->toDateString())
            ->whereDate('dateOfPayment', '<=', $to->toDateString())
            ->toBase()
            ->get(['employee_id', 'dateOfPayment', 'amount'])
            ->each(function (object $finance) use (&$amounts): void {
                $date = Carbon::parse(substr((string) $finance->dateOfPayment, 0, 10));
                $periodKey = $this->periodStart($date)->toDateString();
                $employeeId = (string) $finance->employee_id;
                $amounts[$periodKey][$employeeId] = ($amounts[$periodKey][$employeeId] ?? 0) + (int) $finance->amount;
            });

        return $amounts;
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $values
     * @return array<string, array{own_seconds:int, supervised_seconds:int, amount_kopecks:int}>
     */
    private function sumValues(Collection $values): array
    {
        $result = [];

        foreach ($values as $value) {
            $employeeId = (string) $value['employee_id'];
            $result[$employeeId] ??= ['own_seconds' => 0, 'supervised_seconds' => 0, 'amount_kopecks' => 0];
            $result[$employeeId]['own_seconds'] += (int) $value['own_seconds'];
            $result[$employeeId]['supervised_seconds'] += (int) $value['supervised_seconds'];
            $result[$employeeId]['amount_kopecks'] += (int) $value['amount_kopecks'];
        }

        return $result;
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array{own_seconds:int, supervised_seconds:int, amount_kopecks:int}
     */
    private function sumTotals(Collection $rows): array
    {
        return [
            'own_seconds' => (int) $rows->sum('own_seconds'),
            'supervised_seconds' => (int) $rows->sum('supervised_seconds'),
            'amount_kopecks' => (int) $rows->sum('amount_kopecks'),
        ];
    }

    private function groupKey(Carbon $periodFrom, string $groupBy): string
    {
        return match ($groupBy) {
            self::GROUP_MONTH => $periodFrom->format('Y-m'),
            self::GROUP_QUARTER => $periodFrom->format('Y').'-Q'.$periodFrom->quarter,
            self::GROUP_YEAR => $periodFrom->format('Y'),
            default => $periodFrom->toDateString(),
        };
    }

    /** Начало payroll-периода, в который входит дата: понедельник или первое число месяца. */
    private function periodStart(Carbon $date): Carbon
    {
        $weekStart = $date->copy()->startOfWeek(CarbonInterface::MONDAY);
        $monthStart = $date->copy()->startOfMonth();

        return $weekStart->greaterThan($monthStart) ? $weekStart : $monthStart;
    }

    /** Последний день payroll-периода, в который входит дата: воскресенье или конец месяца. */
    private function periodEnd(Carbon $date): Carbon
    {
        $weekEnd = $date->copy()->endOfWeek(CarbonInterface::SUNDAY)->startOfDay();
        $monthEnd = $date->copy()->endOfMonth()->startOfDay();

        return $weekEnd->lessThan($monthEnd) ? $weekEnd : $monthEnd;
    }

    private function firstFinanceDate(Company $company): ?Carbon
    {
        $date = Finance::query()
            ->where('company_id', $company->id)
            ->where('type', FinanceType::EXPENDITURE->value)
            ->whereNotNull('employee_id')
            ->min('dateOfPayment');

        return $date ? Carbon::parse(substr((string) $date, 0, 10)) : null;
    }
}
