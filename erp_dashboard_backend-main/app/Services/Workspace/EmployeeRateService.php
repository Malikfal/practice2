<?php

namespace App\Services\Workspace;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollHoursScope;
use App\Enums\PayrollProjectHoursType;
use App\Enums\PayrollRangeCalculationMethod;
use App\Enums\UserPermission;
use App\Models\EmployeeRate;
use App\Models\Project;
use App\Models\User;
use App\Repositories\Workspace\EmployeeRateRepository;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class EmployeeRateService
{
    public function __construct(
        private readonly ?EmployeeRateRepository $employeeRates = null,
    ) {}

    public function paginateEmployeesWithCurrentRates(User $user, string $companyId, array $data): LengthAwarePaginator
    {
        $this->assertSalaryPermission($user);

        if (! $user->isSuperAdmin() && (string) $user->company_id !== $companyId) {
            throw new NotFoundHttpException;
        }

        return $this->employeeRateRepository()->paginateEmployeesWithCurrentRates(
            $companyId,
            trim((string) ($data['search'] ?? '')),
            (int) ($data['per_page'] ?? 20),
            $data['sort_by'] ?? null,
            $data['sort_direction'] ?? 'asc',
        );
    }

    public function list(User $user, User $employee): Collection
    {
        $this->assertEmployeeAccess($user, $employee, allowSelfWithoutPermission: true);

        return EmployeeRate::query()
            ->with(['changer'])
            ->where('employee_id', $employee->id)
            ->orderBy('effective_from', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function current(User $user, User $employee): ?EmployeeRate
    {
        $this->assertEmployeeAccess($user, $employee, allowSelfWithoutPermission: true);

        return EmployeeRate::query()
            ->with(['changer'])
            ->where('employee_id', $employee->id)
            ->whereDate('effective_from', '<=', now()->toDateString())
            ->orderBy('effective_from', 'desc')
            ->orderBy('created_at', 'desc')
            ->first();
    }

    public function store(User $user, User $employee, array $data): EmployeeRate
    {
        $this->assertEmployeeAccess($user, $employee);
        $this->assertAtLeastOneRateFilled($data);
        $this->assertValidRateSettings($data, $employee);

        try {
            return DB::transaction(function () use ($user, $employee, $data): EmployeeRate {
                $history = $this->lockedHistory((string) $employee->id);
                $this->assertNewRateCanBeCreated($history, (string) $data['effective_from']);
                $attributes = $this->rateAttributes($user, $employee, $data);
                $rate = EmployeeRate::create([
                    'id' => (string) Str::uuid(),
                    ...$attributes,
                ]);

                return $rate->load(['changer']);
            });
        } catch (UniqueConstraintViolationException) {
            $this->throwDuplicateEffectiveFrom();
        }
    }

    public function update(User $user, EmployeeRate $rate, array $data): EmployeeRate
    {
        $rate->loadMissing(['employee']);

        $this->assertEmployeeAccess($user, $rate->employee);
        $this->assertAtLeastOneRateFilled($data);
        $this->assertValidRateSettings($data, $rate->employee);

        try {
            return DB::transaction(function () use ($user, $rate, $data): EmployeeRate {
                $history = $this->lockedHistory((string) $rate->employee_id);
                $lockedRate = $this->rateFromHistory($history, (string) $rate->id);
                $this->assertRateIsLatest($lockedRate, $history);

                $lockedRate->loadMissing(['employee']);
                $lockedRate->fill($this->rateAttributes($user, $lockedRate->employee, $data, $lockedRate))->save();

                return $lockedRate->load(['changer']);
            });
        } catch (UniqueConstraintViolationException) {
            $this->throwDuplicateEffectiveFrom();
        }
    }

    public function destroy(User $user, EmployeeRate $rate): void
    {
        $rate->loadMissing(['employee']);

        $this->assertEmployeeAccess($user, $rate->employee);
        DB::transaction(function () use ($rate): void {
            $history = $this->lockedHistory((string) $rate->employee_id);
            $lockedRate = $this->rateFromHistory($history, (string) $rate->id);
            $this->assertRateIsLatest($lockedRate, $history);
            $this->assertRateCanBeDeleted($history);

            $lockedRate->delete();
        });
    }

    /**
     * Нормализует поля создаваемого или изменяемого среза ставки.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function rateAttributes(
        User $user,
        User $employee,
        array $data,
        ?EmployeeRate $currentRate = null,
    ): array {
        return [
            'employee_id' => $employee->id,
            'salary' => $data['salary'] ?? null,
            'salary_distribution_scope' => $data['salary_distribution_scope']
                ?? $currentRate?->salary_distribution_scope?->value
                ?? PayrollHoursScope::COMPANY->value,
            'hourly_rate' => $data['hourly_rate'] ?? null,
            'supervised_hourly_rate' => $data['supervised_hourly_rate'] ?? null,
            'company_hourly_rate' => $data['company_hourly_rate'] ?? null,
            'exclude_from_supervised_hours' => (bool) ($data['exclude_from_supervised_hours'] ?? false),
            'rate_settings' => $this->normalizeRateSettings($data, $user->id),
            'effective_from' => $data['effective_from'],
            'changed_by' => $user->id,
        ];
    }

    /**
     * @return Collection<int, EmployeeRate>
     */
    private function lockedHistory(string $employeeId): Collection
    {
        return EmployeeRate::query()
            ->where('employee_id', $employeeId)
            ->orderByDesc('effective_from')
            ->orderByDesc('created_at')
            ->lockForUpdate()
            ->get();
    }

    /**
     * Находит выбранную ставку внутри заблокированной истории.
     *
     * @param  Collection<int, EmployeeRate>  $history
     */
    private function rateFromHistory(Collection $history, string $rateId): EmployeeRate
    {
        $rate = $history->first(
            static fn (EmployeeRate $rate): bool => (string) $rate->id === $rateId,
        );

        if (! $rate) {
            throw new NotFoundHttpException;
        }

        return $rate;
    }

    /**
     * Разрешает изменение и удаление только самой поздней ставки сотрудника.
     *
     * @param  Collection<int, EmployeeRate>  $history
     */
    private function assertRateIsLatest(EmployeeRate $rate, Collection $history): void
    {
        if ((string) $history->first()?->id === (string) $rate->id) {
            return;
        }

        throw ValidationException::withMessages([
            'rate' => ['Можно изменять или удалять только последнюю ставку сотрудника.'],
        ]);
    }

    /**
     * Запрещает удаление единственной ставки сотрудника.
     *
     * @param  Collection<int, EmployeeRate>  $history
     */
    private function assertRateCanBeDeleted(Collection $history): void
    {
        if ($history->count() > 1) {
            return;
        }

        throw ValidationException::withMessages([
            'rate' => ['Нельзя удалить единственную ставку сотрудника.'],
        ]);
    }

    /**
     * Требует создавать новый срез строго после последней существующей ставки.
     *
     * @param  Collection<int, EmployeeRate>  $history
     */
    private function assertNewRateCanBeCreated(Collection $history, string $effectiveFrom): void
    {
        $latest = $history->first();
        if (! $latest || Carbon::parse($effectiveFrom)->startOfDay()->gt($latest->effective_from)) {
            return;
        }

        throw ValidationException::withMessages([
            'effective_from' => [sprintf(
                'Дата новой ставки должна быть позже %s.',
                $latest->effective_from->toDateString(),
            )],
        ]);
    }

    private function throwDuplicateEffectiveFrom(): never
    {
        throw ValidationException::withMessages([
            'effective_from' => ['Нельзя записать ставку на одно и то же число.'],
        ]);
    }

    private function assertAtLeastOneRateFilled(array $data): void
    {
        $hasRate = collect([
            $data['salary'] ?? null,
            $data['hourly_rate'] ?? null,
            $data['supervised_hourly_rate'] ?? null,
            $data['company_hourly_rate'] ?? null,
        ])->merge(
            collect($data['rate_settings'] ?? [])->pluck('default_rate'),
        )->contains(static fn ($value): bool => $value !== null && $value !== '');

        if (! $hasRate) {
            throw ValidationException::withMessages([
                'salary' => ['Укажите хотя бы одну ставку.'],
            ]);
        }
    }

    private function assertValidRateSettings(array $data, User $employee): void
    {
        $seenTypes = [];

        foreach ($data['rate_settings'] ?? [] as $settingIndex => $setting) {
            $type = EmployeeRateType::tryFrom((string) ($setting['rate_type'] ?? ''));
            if (! $type) {
                continue;
            }

            if (isset($seenTypes[$type->value])) {
                throw ValidationException::withMessages([
                    "rate_settings.$settingIndex.rate_type" => ['Тип ставки не должен повторяться.'],
                ]);
            }
            $seenTypes[$type->value] = true;

            $fixedScope = match ($type) {
                EmployeeRateType::HOURLY => PayrollHoursScope::OWN,
                EmployeeRateType::SUPERVISED_HOURLY => PayrollHoursScope::SUPERVISED,
                EmployeeRateType::COMPANY_HOURLY => PayrollHoursScope::COMPANY,
                EmployeeRateType::WEEKLY_SALARY => null,
            };
            $scope = PayrollHoursScope::tryFrom((string) ($setting['hours_scope'] ?? ''));
            if ($fixedScope !== null && $scope !== null && $scope !== $fixedScope) {
                throw ValidationException::withMessages([
                    "rate_settings.$settingIndex.hours_scope" => [sprintf(
                        'Для типа ставки %s можно использовать только область часов %s.',
                        $type->value,
                        $fixedScope->value,
                    )],
                ]);
            }

            $this->assertValidProjectRates(
                $type,
                $setting['project_rates'] ?? [],
                $employee,
                "rate_settings.$settingIndex.project_rates",
            );

            $isAdvanced = (bool) ($setting['is_advanced'] ?? false);
            if (! $isAdvanced) {
                continue;
            }

            $defaultRate = $setting['default_rate'] ?? $data[$type->baseColumn()] ?? null;
            if ($defaultRate === null || $defaultRate === '') {
                throw ValidationException::withMessages([
                    "rate_settings.$settingIndex.default_rate" => ['Для расширенной формулы необходимо указать ставку по умолчанию.'],
                ]);
            }

            $ranges = $setting['ranges'] ?? [];
            if (! is_array($ranges) || $ranges === []) {
                throw ValidationException::withMessages([
                    "rate_settings.$settingIndex.ranges" => ['Добавьте хотя бы один диапазон ставки.'],
                ]);
            }

            $this->assertValidRanges($ranges, (int) $defaultRate, "rate_settings.$settingIndex.ranges");

            $method = PayrollRangeCalculationMethod::tryFrom(
                (string) ($setting['range_calculation_method'] ?? PayrollRangeCalculationMethod::THRESHOLD->value)
            ) ?? PayrollRangeCalculationMethod::THRESHOLD;

            if (! $type->isHourly() && $method === PayrollRangeCalculationMethod::PROGRESSIVE) {
                throw ValidationException::withMessages([
                    "rate_settings.$settingIndex.range_calculation_method" => ['Прогрессивные диапазоны доступны только для почасовых ставок.'],
                ]);
            }
        }
    }

    /**
     * Проверяет отдельные ставки проектов: только почасовые типы, проекты компании сотрудника, без повторов.
     *
     * @param  array<int, array<string, mixed>>  $projectRates
     */
    private function assertValidProjectRates(
        EmployeeRateType $type,
        array $projectRates,
        User $employee,
        string $path,
    ): void {
        if ($projectRates === []) {
            return;
        }

        if (! $type->isHourly()) {
            throw ValidationException::withMessages([
                $path => ['Отдельная ставка по проектам доступна только для почасовых ставок.'],
            ]);
        }

        $projectIds = collect($projectRates)->pluck('project_id')->map(static fn ($id): string => (string) $id);
        $duplicateIndex = $projectIds->duplicates()->keys()->first();

        if ($duplicateIndex !== null) {
            throw ValidationException::withMessages([
                "$path.$duplicateIndex.project_id" => ['Отдельная ставка по проектам: проект выбран дважды.'],
            ]);
        }

        $companyProjectIds = Project::query()
            ->where('company_id', $this->employeeCompanyId($employee))
            ->whereIn('id', $projectIds->all())
            ->pluck('id')
            ->map(static fn ($id): string => (string) $id);
        $foreignIndex = $projectIds->diff($companyProjectIds)->keys()->first();

        if ($foreignIndex !== null) {
            throw ValidationException::withMessages([
                "$path.$foreignIndex.project_id" => ['Отдельная ставка по проектам: проект не найден в компании.'],
            ]);
        }
    }

    private function assertValidRanges(array $ranges, int $defaultRate, string $path): void
    {
        $rangesByProjectHoursType = [];

        foreach ($ranges as $index => $range) {
            $from = (float) ($range['from_hours'] ?? -1);
            $to = array_key_exists('to_hours', $range) && $range['to_hours'] !== null
                ? (float) $range['to_hours']
                : null;
            $rangeRate = (int) ($range['rate'] ?? -1);

            if ($from < 0) {
                throw ValidationException::withMessages(["$path.$index.from_hours" => ['Начало диапазона не может быть отрицательным.']]);
            }

            if ($to !== null && $to <= $from) {
                throw ValidationException::withMessages(["$path.$index.to_hours" => ['Конец диапазона должен быть больше его начала.']]);
            }

            if ($rangeRate < $defaultRate) {
                throw ValidationException::withMessages(["$path.$index.rate" => ['Ставка диапазона не должна быть ниже ставки по умолчанию.']]);
            }

            $projectHoursType = $range['project_hours_type'] ?? PayrollProjectHoursType::ALL->value;
            $rangesByProjectHoursType[$projectHoursType][] = [
                'index' => $index,
                'from' => $from,
                'to' => $to,
            ];
        }

        foreach ($rangesByProjectHoursType as $groupedRanges) {
            usort($groupedRanges, static fn (array $left, array $right): int => $left['from'] <=> $right['from']);

            $previous = null;
            foreach ($groupedRanges as $range) {
                if ($previous === null && $range['from'] !== 0.0) {
                    throw ValidationException::withMessages([
                        "$path.{$range['index']}.from_hours" => ['Первый диапазон должен начинаться с 0 часов.'],
                    ]);
                }

                if ($previous !== null && $previous['to'] === null) {
                    throw ValidationException::withMessages([
                        "$path.{$range['index']}.from_hours" => ['После открытого диапазона нельзя добавлять другие диапазоны.'],
                    ]);
                }

                if ($previous !== null && $range['from'] < $previous['to']) {
                    throw ValidationException::withMessages([
                        "$path.{$range['index']}.from_hours" => ['Диапазоны ставок не должны пересекаться.'],
                    ]);
                }

                if ($previous !== null && $range['from'] > $previous['to']) {
                    throw ValidationException::withMessages([
                        "$path.{$range['index']}.from_hours" => ['Диапазоны ставок должны идти без разрывов.'],
                    ]);
                }

                $previous = $range;
            }

            if ($previous !== null && $previous['to'] !== null) {
                throw ValidationException::withMessages([
                    "$path.{$previous['index']}.to_hours" => ['Последний диапазон должен быть открытым.'],
                ]);
            }
        }
    }

    /**
     * Нормализует настройки расширенных ставок в JSON-объект для employee_rates.rate_settings.
     *
     * @param  array<string, mixed>  $data  Данные создания ставки сотрудника.
     * @param  string  $changedBy  Пользователь, который изменил ставку.
     * @return array<string, array<string, mixed>>
     */
    private function normalizeRateSettings(array $data, string $changedBy): array
    {
        $normalized = [];

        foreach ($data['rate_settings'] ?? [] as $settingData) {
            $type = EmployeeRateType::from($settingData['rate_type']);
            $isAdvanced = (bool) ($settingData['is_advanced'] ?? false);

            $normalized[$type->value] = [
                'rate_type' => $type->value,
                'is_advanced' => $isAdvanced,
                'default_rate' => $settingData['default_rate'] ?? $data[$type->baseColumn()] ?? null,
                'split_by_project_type' => (bool) ($settingData['split_by_project_type'] ?? false),
                'hours_scope' => $settingData['hours_scope'] ?? match ($type) {
                    EmployeeRateType::HOURLY => PayrollHoursScope::OWN->value,
                    EmployeeRateType::SUPERVISED_HOURLY => PayrollHoursScope::SUPERVISED->value,
                    EmployeeRateType::COMPANY_HOURLY, EmployeeRateType::WEEKLY_SALARY => PayrollHoursScope::COMPANY->value,
                },
                'range_calculation_method' => $settingData['range_calculation_method']
                    ?? PayrollRangeCalculationMethod::THRESHOLD->value,
                'changed_by' => $changedBy,
                'ranges' => collect($settingData['ranges'] ?? [])
                    ->values()
                    ->map(static fn (array $rangeData, int $position): array => [
                        'project_hours_type' => $rangeData['project_hours_type']
                            ?? PayrollProjectHoursType::ALL->value,
                        'from_hours' => (float) $rangeData['from_hours'],
                        'to_hours' => $rangeData['to_hours'] ?? null,
                        'rate' => (int) $rangeData['rate'],
                        'position' => $position,
                    ])
                    ->all(),
                'project_rates' => $type->isHourly()
                    ? collect($settingData['project_rates'] ?? [])
                        ->map(static fn (array $projectRateData): array => [
                            'project_id' => (string) $projectRateData['project_id'],
                            'rate' => (int) $projectRateData['rate'],
                        ])
                        ->values()
                        ->all()
                    : [],
            ];
        }

        return $normalized;
    }

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

    private function assertSalaryPermission(User $user): void
    {
        if (! $user->can(UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value)) {
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

    private function employeeRateRepository(): EmployeeRateRepository
    {
        return $this->employeeRates ?? app(EmployeeRateRepository::class);
    }
}
