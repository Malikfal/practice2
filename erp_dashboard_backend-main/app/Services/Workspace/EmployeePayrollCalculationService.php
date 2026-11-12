<?php

namespace App\Services\Workspace;

use App\Enums\EmployeeRateType;
use App\Enums\FinanceType;
use App\Enums\PayrollHoursScope;
use App\Enums\PayrollProjectHoursType;
use App\Enums\UserPermission;
use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\Finance;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Services\Payroll\Calculation\Rates\Data\PayrollProjectRateAmount;
use App\Services\Payroll\Calculation\Rates\Data\PayrollRateLine;
use App\Services\Payroll\Calculation\Rates\PayrollProjectRateHours;
use App\Services\Payroll\Calculation\Rates\PayrollRateRange;
use App\Services\Payroll\Calculation\Rates\PayrollRateSetting;
use App\Services\Payroll\Calculation\Rates\WeeklyEmployeeRatePayrollService;
use App\Services\Payroll\Hours\PayrollHoursService;
use App\Services\Payroll\Period\PayrollPeriod;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class EmployeePayrollCalculationService
{
    private readonly WeeklyEmployeeRatePayrollService $weeklyPayroll;

    public function __construct(
        private readonly EmployeeRateRepository $rates,
        private readonly PayrollHoursService $payrollHours,
        ?WeeklyEmployeeRatePayrollService $weeklyPayroll = null,
    ) {
        $this->weeklyPayroll = $weeklyPayroll ?? new WeeklyEmployeeRatePayrollService($payrollHours);
    }

    /**
     * Возвращает недельные payroll-итоги сотрудника с детализацией формул ставок.
     *
     * @param  array{from?:string, to?:string, page?:int, per_page?:int}  $data
     * @return array{from:string, to:string, rows:Collection<int, array<string, mixed>>, meta:array{current_page:int, last_page:int, per_page:int, total:int}}
     */
    public function calculate(User $user, User $employee, array $data): array
    {
        $this->assertEmployeeAccess($user, $employee, allowSelfWithoutPermission: true);

        $page = (int) ($data['page'] ?? 1);
        $perPage = (int) ($data['per_page'] ?? 20);
        $company = $this->employeeCompany($employee);
        [$from, $to] = $this->reportBoundaries($company, $employee, $data);

        // API использует те же границы периодов, что и перерасчет: конец недели или месяца.
        $periods = PayrollPeriod::between($from, $to->copy()->addDay())
            ->reverse()
            ->values();
        $total = $periods->count();
        $rows = $periods
            ->forPage($page, $perPage)
            ->map(fn (PayrollPeriod $period): array => $this->buildPeriodRow($company, $employee, $period))
            ->values();

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'rows' => $rows,
            'meta' => [
                'current_page' => $page,
                'last_page' => max(1, (int) ceil($total / $perPage)),
                'per_page' => $perPage,
                'total' => $total,
            ],
        ];
    }

    /**
     * @param  array{from?:string, to?:string, page?:int, per_page?:int}  $data
     * @return array{from:string, to:string, rows:Collection<int, array<string, mixed>>, meta:array{current_page:int, last_page:int, per_page:int, total:int}}
     */
    public function calculateForCompany(User $user, Company $company, array $data): array
    {
        $this->assertSalaryPermission($user);

        if (! $user->isSuperAdmin() && (string) $user->company_id !== (string) $company->id) {
            throw new NotFoundHttpException;
        }

        $employees = $company->employees()->orderBy('id')->get();
        $page = (int) ($data['page'] ?? 1);
        $perPage = (int) ($data['per_page'] ?? 20);
        [$from, $to] = $this->companyReportBoundaries($company, $data);
        $periods = PayrollPeriod::between($from, $to->copy()->addDay())
            ->reverse()
            ->values();
        $total = $periods->count();
        $rows = $periods
            ->forPage($page, $perPage)
            ->map(fn (PayrollPeriod $period): array => [
                'period_from' => $period->from->toDateString(),
                'period_to' => $period->paymentDate()->toDateString(),
                'employees' => $employees
                    ->map(function (User $employee) use ($company, $period): array {
                        return [
                            'employee' => $employee,
                            'calculation' => $this->buildPeriodRow($company, $employee, $period),
                        ];
                    })
                    ->filter(static fn (array $item): bool => $item['calculation']['amount_kopecks'] !== 0)
                    ->values(),
            ])
            ->values();

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'rows' => $rows,
            'meta' => [
                'current_page' => $page,
                'last_page' => max(1, (int) ceil($total / $perPage)),
                'per_page' => $perPage,
                'total' => $total,
            ],
        ];
    }

    /**
     * @param  array{from?:string, to?:string}  $data
     * @return array{0:Carbon, 1:Carbon}
     */
    private function companyReportBoundaries(Company $company, array $data): array
    {
        return $this->resolveReportBoundaries($company, null, $data);
    }

    /**
     * @param  array{from?:string, to?:string}  $data
     * @return array{0:Carbon, 1:Carbon}
     */
    private function reportBoundaries(Company $company, User $employee, array $data): array
    {
        return $this->resolveReportBoundaries($company, $employee, $data);
    }

    /**
     * @param  array{from?:string, to?:string}  $data
     * @return array{0:Carbon, 1:Carbon}
     */
    private function resolveReportBoundaries(Company $company, ?User $employee, array $data): array
    {
        $timezone = $company->payrollTimezone();
        $currentWeekEnd = Carbon::now($timezone)->endOfWeek(CarbonInterface::SUNDAY);
        $from = ! empty($data['from'])
            ? Carbon::parse($data['from'], $timezone)->startOfDay()
            : ($this->firstFinanceDate($company, $employee)
                ?? $currentWeekEnd->copy()->startOfWeek(CarbonInterface::MONDAY));
        $to = ! empty($data['to'])
            ? Carbon::parse($data['to'], $timezone)->endOfDay()
            : $currentWeekEnd;

        return [
            $this->payrollPeriodStart($from),
            $this->minDate($to, $currentWeekEnd),
        ];
    }

    /**
     * Возвращает дату первой зарплатной финансовой операции.
     */
    private function firstFinanceDate(Company $company, ?User $employee): ?Carbon
    {
        $query = Finance::query()
            ->where('company_id', $company->id)
            ->where('type', FinanceType::EXPENDITURE->value)
            ->whereNotNull('employee_id');

        if ($employee) {
            $query->where('employee_id', $employee->id);
        }

        $date = $query->min('dateOfPayment');

        return $date
            ? Carbon::parse($date, $company->payrollTimezone())->startOfDay()
            : null;
    }

    /**
     * Расширяет начало отчета до начала недельного периода с учетом границы месяца.
     * нужно для корректного отображения на фронте и для корректного перерасчета (отображения и запуска PayrollRecalculationService::period)
     */
    private function payrollPeriodStart(Carbon $date): Carbon
    {
        $weekStart = $date->copy()->startOfWeek(CarbonInterface::MONDAY);
        $monthStart = $date->copy()->startOfMonth();

        return $weekStart->greaterThan($monthStart) ? $weekStart : $monthStart;
    }

    /**
     * Строит строку отчета для периода, ограниченного неделей и месяцем.
     *
     * @return array<string, mixed>
     */
    private function buildPeriodRow(
        Company $company,
        User $employee,
        PayrollPeriod $period,
    ): array {
        $reportFrom = $period->from;
        $reportTo = $period->paymentDate();
        $periodToExclusive = $period->to;

        // Эти часы и финансы относятся только к отображаемой части недели.
        $ownDurations = $this->payrollHours->own($company, $employee, $reportFrom, $periodToExclusive);
        $supervisedDurations = $this->payrollHours
            ->supervised($company, $employee, $reportFrom, $periodToExclusive);
        $totalDurations = $this->mergeOverlappingDurations($ownDurations, $supervisedDurations);
        $companyDurations = $this->payrollHours->company($company, $reportFrom, $periodToExclusive);
        $formulaOwnDurations = $ownDurations;
        $formulaSupervisedDurations = $supervisedDurations;
        $formulaCompanyDurations = $companyDurations;

        if ($period->continuesSplitWeek()) {
            // Во второй части разделенной недели диапазоны формул показываются по полной неделе.
            $formulaOwnDurations = $this->payrollHours
                ->own($company, $employee, $period->weekFrom(), $period->weekTo());
            $formulaSupervisedDurations = $this->payrollHours
                ->supervised($company, $employee, $period->weekFrom(), $period->weekTo());
            $formulaCompanyDurations = $this->payrollHours
                ->company($company, $period->weekFrom(), $period->weekTo());
        }
        $finances = $this->payrollFinances($employee, $reportFrom, $reportTo);
        $amount = (int) $finances->sum('amount');

        return [
            'period_from' => $reportFrom->toDateString(),
            'period_to' => $reportTo->toDateString(),
            'own_seconds' => (int) $ownDurations->sum('duration_seconds'),
            'supervised_seconds' => (int) $supervisedDurations->sum('duration_seconds'),
            'total_seconds' => (int) $totalDurations->sum('duration_seconds'),
            'amount_kopecks' => $amount,
            'finance_ids' => $finances->pluck('id')->map(static fn (mixed $id): string => (string) $id)->values()->all(),
            'details' => $this->projectDetails($ownDurations, $supervisedDurations, $finances),
            'formulas' => $this->rateFormulas(
                $company,
                $employee,
                $reportTo,
                $period->continuesSplitWeek() ? $period->weekFrom() : $reportFrom,
                $period->continuesSplitWeek() ? $period->weekTo() : $periodToExclusive,
                $period->continuesSplitWeek() ? $reportFrom : null,
                [
                    PayrollHoursScope::OWN->value => $formulaOwnDurations,
                    PayrollHoursScope::SUPERVISED->value => $formulaSupervisedDurations,
                    PayrollHoursScope::COMPANY->value => $formulaCompanyDurations,
                ],
                [
                    PayrollHoursScope::OWN->value => $ownDurations,
                    PayrollHoursScope::SUPERVISED->value => $supervisedDurations,
                    PayrollHoursScope::COMPANY->value => $companyDurations,
                ],
            ),
        ];
    }

    /**
     * Формирует описание формул по всем типам ставок активного среза.
     *
     * Неделя формулы — интервал, по которому выбираются диапазоны. Во второй части
     * разделенной недели это вся неделя, а первая часть уже начислена отдельно.
     *
     * @param  array<string, Collection<int, object>>  $formulaDurationScopes  Часы для выбора диапазонов.
     * @param  array<string, Collection<int, object>>  $periodDurationScopes  Часы отображаемого периода.
     * @param  ?CarbonInterface  $previousPartTo  Начало отображаемой части, если перед ней есть начисленная часть недели.
     * @return list<array<string, mixed>>
     */
    private function rateFormulas(
        Company $company,
        User $employee,
        Carbon $date,
        CarbonInterface $formulaFrom,
        CarbonInterface $formulaTo,
        ?CarbonInterface $previousPartTo,
        array $formulaDurationScopes,
        array $periodDurationScopes,
    ): array {
        $rate = $this->rates->rateForDate($employee, $date);

        return collect(EmployeeRateType::cases())
            ->map(fn (EmployeeRateType $type): array => [
                ...$this->rateFormula(
                    $rate,
                    $type,
                    $formulaDurationScopes,
                    $periodDurationScopes,
                ),
                ...$this->regularRateLines(
                    $company,
                    $employee,
                    $rate,
                    $type,
                    $formulaFrom,
                    $formulaTo,
                    $previousPartTo,
                    $formulaDurationScopes,
                ),
            ])
            ->values()
            ->all();
    }

    /**
     * Формирует описание формулы для одного типа ставки.
     *
     * @param  array<string, Collection<int, object>>  $durationScopes
     * @param  array<string, Collection<int, object>>  $periodDurationScopes
     * @return array<string, mixed>
     */
    private function rateFormula(
        ?EmployeeRate $rate,
        EmployeeRateType $type,
        array $durationScopes,
        array $periodDurationScopes,
    ): array {
        $setting = $rate ? $this->rates->settingForDate($rate, $type) : null;
        $hoursScope = $setting?->hoursScope ?? $this->defaultHoursScope($type);
        $durations = $durationScopes[$hoursScope->value] ?? collect();
        $projectSeconds = $this->projectSeconds($durations);
        $ranges = $this->formulaRanges($setting, $projectSeconds);
        $reachedRanges = collect($ranges)->filter(static fn (array $range): bool => $range['is_reached'])->values()->all();

        return [
            'rate_id' => $rate?->id ? (string) $rate->id : null,
            'rate_effective_from' => $rate?->effective_from?->toDateString(),
            'rate_type' => $type->value,
            'base_rate_kopecks' => $rate ? (int) $rate->{$type->baseColumn()} : null,
            'is_advanced' => (bool) ($setting?->isAdvanced ?? false),
            'default_rate_kopecks' => $setting?->defaultRate,
            'split_by_project_type' => (bool) ($setting?->splitByProjectType ?? false),
            'hours_scope' => $hoursScope->value,
            'range_calculation_method' => $setting?->rangeCalculationMethod->value,
            'calculation_hours_seconds' => $projectSeconds[PayrollProjectHoursType::ALL->value],
            'project_hours_seconds' => $projectSeconds,
            'reached_range' => $reachedRanges[0] ?? null,
            'reached_ranges' => $reachedRanges,
            'ranges' => $ranges,
            'project_rates' => $this->formulaProjectRates(
                $setting,
                $periodDurationScopes[$hoursScope->value] ?? collect(),
            ),
        ];
    }

    /**
     * Раскладывает оплату обычных часов по ставкам: диапазонам формулы или базовой ставке.
     *
     * Строки считаются тем же кодом, что и перерасчет, по всей неделе формулы. Для второй
     * части разделенной недели отдельно возвращается сумма уже начисленной первой части.
     *
     * @param  array<string, Collection<int, object>>  $formulaDurationScopes
     * @return array{regular_lines:list<array<string, mixed>>, regular_from:string, regular_to:string, previous_part:?array<string, mixed>}
     */
    private function regularRateLines(
        Company $company,
        User $employee,
        ?EmployeeRate $rate,
        EmployeeRateType $type,
        CarbonInterface $formulaFrom,
        CarbonInterface $formulaTo,
        ?CarbonInterface $previousPartTo,
        array $formulaDurationScopes,
    ): array {
        $setting = $rate ? $this->rates->settingForDate($rate, $type) : null;
        $hoursScope = $setting?->hoursScope ?? $this->defaultHoursScope($type);
        $lines = $rate
            ? $this->rateLines(
                $company,
                $employee,
                $rate,
                $type,
                $setting,
                $hoursScope,
                $formulaDurationScopes[$hoursScope->value] ?? collect(),
                $formulaFrom,
                $formulaTo,
            )
            : collect();
        $previousPart = null;

        if ($rate && $previousPartTo && $lines->isNotEmpty()) {
            $previousLines = $this->rateLines(
                $company,
                $employee,
                $rate,
                $type,
                $setting,
                $hoursScope,
                $this->scopeDurations($hoursScope, $company, $employee, $formulaFrom, $previousPartTo),
                $formulaFrom,
                $previousPartTo,
            );
            $previousPart = [
                'from' => $formulaFrom->toDateString(),
                'to' => $previousPartTo->copy()->subDay()->toDateString(),
                'amount_kopecks' => (int) $previousLines->sum('amount'),
            ];
        }

        return [
            'regular_lines' => $lines
                ->map(static fn (PayrollRateLine $line): array => [
                    'project_hours_type' => $line->projectHoursType->value,
                    'from_hours' => $line->fromHours,
                    'to_hours' => $line->toHours,
                    'rate_kopecks' => $line->rate,
                    'hours_seconds' => $line->seconds,
                    'amount_kopecks' => $line->amount,
                ])
                ->values()
                ->all(),
            'regular_from' => $formulaFrom->toDateString(),
            'regular_to' => $formulaTo->copy()->subDay()->toDateString(),
            'previous_part' => $previousPart,
        ];
    }

    /**
     * @param  Collection<int, object>  $durations  Часы интервала в области часов ставки.
     * @return Collection<int, PayrollRateLine>
     */
    private function rateLines(
        Company $company,
        User $employee,
        EmployeeRate $rate,
        EmployeeRateType $type,
        ?PayrollRateSetting $setting,
        PayrollHoursScope $hoursScope,
        Collection $durations,
        CarbonInterface $from,
        CarbonInterface $to,
    ): Collection {
        $baseRate = $setting?->isAdvanced && $setting->defaultRate !== null
            ? $setting->defaultRate
            : (int) ($rate->{$type->baseColumn()} ?? 0);

        return $this->weeklyPayroll->regularLines(
            $type,
            $setting,
            $baseRate,
            $durations,
            fn (): Collection => $this->dayDurations($hoursScope, $company, $employee, $from, $to),
        );
    }

    /**
     * Возвращает часы интервала по дням для раздельных ступеней.
     *
     * @return Collection<int, object{in_period:bool, durations:Collection<int, object>}>
     */
    private function dayDurations(
        PayrollHoursScope $scope,
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
    ): Collection {
        $days = collect();
        $dayFrom = $from->copy();

        while ($dayFrom->lt($to)) {
            $dayTo = $dayFrom->copy()->addDay()->startOfDay();
            $dayTo = $dayTo->gt($to) ? $to->copy() : $dayTo;
            $days->push((object) [
                'in_period' => true,
                'durations' => $this->scopeDurations($scope, $company, $employee, $dayFrom, $dayTo),
            ]);
            $dayFrom = $dayTo;
        }

        return $days;
    }

    /** @return Collection<int, object> */
    private function scopeDurations(
        PayrollHoursScope $scope,
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
    ): Collection {
        return match ($scope) {
            PayrollHoursScope::OWN => $this->payrollHours->own($company, $employee, $from, $to),
            PayrollHoursScope::SUPERVISED => $this->payrollHours->supervised($company, $employee, $from, $to),
            PayrollHoursScope::COMPANY => $this->payrollHours->company($company, $from, $to),
        };
    }

    /**
     * Сериализует начисления по отдельным ставкам проектов за отображаемый период.
     *
     * @param  Collection<int, object>  $durations
     * @return list<array<string, mixed>>
     */
    private function formulaProjectRates(?PayrollRateSetting $setting, Collection $durations): array
    {
        $projectRates = $setting?->projectRatesById() ?? collect();

        return PayrollProjectRateHours::amounts($durations, $projectRates)
            ->map(static fn (PayrollProjectRateAmount $amount): array => [
                'project_id' => $amount->projectId,
                'project_name' => (string) ($amount->durations->first()->project_name ?? ''),
                'rate_kopecks' => $amount->rate,
                'hours_seconds' => $amount->seconds,
                'amount_kopecks' => $amount->amount,
            ])
            ->sortBy('project_name')
            ->values()
            ->all();
    }

    /**
     * Возвращает стандартную область часов для типа ставки, если она не задана в настройках.
     */
    private function defaultHoursScope(EmployeeRateType $type): PayrollHoursScope
    {
        return match ($type) {
            EmployeeRateType::HOURLY => PayrollHoursScope::OWN,
            EmployeeRateType::SUPERVISED_HOURLY => PayrollHoursScope::SUPERVISED,
            EmployeeRateType::COMPANY_HOURLY => PayrollHoursScope::COMPANY,
            EmployeeRateType::WEEKLY_SALARY => PayrollHoursScope::COMPANY,
        };
    }

    /**
     * Возвращает часы в секундах по типам проектов и общий итог.
     *
     * @return array{ALL:int, COMMERCIAL:int, INTERNAL:int}
     */
    private function projectSeconds(Collection $durations): array
    {
        $seconds = $this->payrollHours->secondsByProjectType($durations);

        return [
            PayrollProjectHoursType::ALL->value => (int) $durations->sum('duration_seconds'),
            PayrollProjectHoursType::COMMERCIAL->value => (int) $seconds->get(PayrollProjectHoursType::COMMERCIAL->value, 0),
            PayrollProjectHoursType::INTERNAL->value => (int) $seconds->get(PayrollProjectHoursType::INTERNAL->value, 0),
        ];
    }

    /**
     * Сериализует диапазоны расширенной формулы и отмечает достигнутые.
     *
     * @param  array{ALL:int, COMMERCIAL:int, INTERNAL:int}  $projectSeconds
     * @return list<array<string, mixed>>
     */
    private function formulaRanges(?PayrollRateSetting $setting, array $projectSeconds): array
    {
        if (! $setting) {
            return [];
        }

        return $setting->ranges
            ->map(fn (PayrollRateRange $range): array => $this->formulaRange($range, $projectSeconds))
            ->values()
            ->all();
    }

    /**
     * Сериализует один диапазон формулы.
     *
     * @param  array{ALL:int, COMMERCIAL:int, INTERNAL:int}  $projectSeconds
     * @return array<string, mixed>
     */
    private function formulaRange(PayrollRateRange $range, array $projectSeconds): array
    {
        $seconds = $projectSeconds[$range->projectHoursType->value] ?? 0;
        $hours = $seconds / 3600;

        return [
            'project_hours_type' => $range->projectHoursType->value,
            'from_hours' => $range->fromHours,
            'to_hours' => $range->toHours,
            'rate_kopecks' => $range->rate,
            'position' => $range->position,
            'calculation_hours_seconds' => $seconds,
            'is_reached' => $this->rangeReached($range, $hours),
        ];
    }

    /**
     * Проверяет, попадают ли расчетные часы в диапазон.
     */
    private function rangeReached(PayrollRateRange $range, float $hours): bool
    {
        return $hours >= $range->fromHours
            && ($range->toHours === null || $hours < $range->toHours);
    }

    /**
     * Проверяет доступ текущего пользователя к payroll-данным сотрудника.
     */
    private function assertEmployeeAccess(
        User $user,
        User $employee,
        bool $allowSelfWithoutPermission = false,
    ): void {
        if ($allowSelfWithoutPermission && (string) $user->id === (string) $employee->id) {
            return;
        }

        $this->assertSalaryPermission($user);

        if ($user->isSuperAdmin()) {
            $this->employeeCompanyId($employee);

            return;
        }

        if ((string) $user->company_id === '' || (string) $user->company_id !== (string) $employee->company_id) {
            throw new NotFoundHttpException;
        }
    }

    /**
     * Проверяет право просмотра вкладки зарплаты.
     */
    private function assertSalaryPermission(User $user): void
    {
        if (! $user->can(UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value)) {
            throw new NotFoundHttpException;
        }
    }

    /**
     * Возвращает компанию сотрудника или скрывает ресурс через 404.
     */
    private function employeeCompany(User $employee): Company
    {
        $company = $employee->company;

        if (! $company) {
            throw new NotFoundHttpException;
        }

        return $company;
    }

    /**
     * Возвращает id компании сотрудника или скрывает ресурс через 404.
     */
    private function employeeCompanyId(User $employee): string
    {
        $companyId = (string) $employee->company_id;

        if ($companyId === '') {
            throw new NotFoundHttpException;
        }

        return $companyId;
    }

    /**
     * Возвращает более раннюю дату.
     */
    private function minDate(Carbon $first, Carbon $second): Carbon
    {
        return $first->lessThan($second) ? $first : $second;
    }

    /**
     * Возвращает payroll-финансы сотрудника за период.
     *
     * @return Collection<int, Finance>
     */
    private function payrollFinances(User $employee, Carbon $from, Carbon $to): Collection
    {
        return Finance::query()
            ->with(['project'])
            ->where('company_id', $this->employeeCompanyId($employee))
            ->where('employee_id', $employee->id)
            ->where('type', FinanceType::EXPENDITURE->value)
            ->whereDate('dateOfPayment', '>=', $from->toDateString())
            ->whereDate('dateOfPayment', '<=', $to->toDateString())
            ->orderBy('dateOfPayment')
            ->orderBy('created_at')
            ->get();
    }

    /**
     * Собирает проектную детализацию из часов и финансовых строк.
     *
     * @param  Collection<int, object>  $ownDurations
     * @param  Collection<int, object>  $supervisedDurations
     * @param  Collection<int, Finance>  $finances
     * @return Collection<int, array<string, mixed>>
     */
    private function projectDetails(Collection $ownDurations, Collection $supervisedDurations, Collection $finances): Collection
    {
        $projects = [];

        foreach ($ownDurations as $duration) {
            $projectId = (string) $duration->project_id;
            $projects[$projectId] ??= [
                'project_id' => $projectId,
                'project_name' => (string) $duration->project_name,
                'own_seconds' => 0,
                'duration_seconds' => 0,
                'supervised_seconds' => 0,
                'amount_kopecks' => 0,
                'finance_ids' => [],
            ];
            $projects[$projectId]['own_seconds'] += (int) $duration->duration_seconds;
            $projects[$projectId]['duration_seconds'] += (int) $duration->duration_seconds;
        }

        foreach ($supervisedDurations as $duration) {
            $projectId = (string) $duration->project_id;
            $projects[$projectId] ??= [
                'project_id' => $projectId,
                'project_name' => (string) $duration->project_name,
                'own_seconds' => 0,
                'duration_seconds' => 0,
                'supervised_seconds' => 0,
                'amount_kopecks' => 0,
                'finance_ids' => [],
            ];
            $projects[$projectId]['supervised_seconds'] += (int) $duration->duration_seconds;
            $projects[$projectId]['duration_seconds'] += (int) $duration->duration_seconds;
        }

        foreach ($finances as $finance) {
            $projectId = $finance->project_id ? (string) $finance->project_id : '__none__';
            $projects[$projectId] ??= [
                'project_id' => $finance->project_id ? (string) $finance->project_id : null,
                'project_name' => $finance->project?->name,
                'own_seconds' => 0,
                'duration_seconds' => 0,
                'supervised_seconds' => 0,
                'amount_kopecks' => 0,
                'finance_ids' => [],
            ];

            $amount = (int) $finance->amount;
            $projects[$projectId]['amount_kopecks'] += $amount;
            $projects[$projectId]['finance_ids'][] = (string) $finance->id;
        }

        return collect(array_values($projects))
            ->sortBy(static fn (array $project): string => (string) ($project['project_name'] ?? $project['project_id'] ?? ''))
            ->values();
    }

    /**
     * Склеивает несколько наборов проектных часов по project_id.
     *
     * @param  Collection<int, object>  ...$groups
     * @return Collection<int, object>
     */
    private function mergeOverlappingDurations(Collection ...$groups): Collection
    {
        $merged = [];

        foreach ($groups as $durations) {
            foreach ($durations as $duration) {
                $projectId = (string) $duration->project_id;
                $merged[$projectId] ??= (object) [
                    'project_id' => $projectId,
                    'project_name' => (string) $duration->project_name,
                    'is_internal' => (bool) $duration->is_internal,
                    'duration_seconds' => 0,
                ];
                // Подконтрольные часы уже включают собственные часы менеджера на этом проекте.
                $merged[$projectId]->duration_seconds = max(
                    (int) $merged[$projectId]->duration_seconds,
                    (int) $duration->duration_seconds,
                );
            }
        }

        return collect(array_values($merged));
    }
}
