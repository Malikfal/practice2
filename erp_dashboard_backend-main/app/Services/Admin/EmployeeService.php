<?php

namespace App\Services\Admin;

use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Repositories\Workspace\EmployeeRepository;
use App\Repositories\Workspace\ProjectAssignmentHistoryRepository;
use App\Services\Payroll\EmployeeArchiveRateService;
use App\Services\Workspace\SkillService;
use App\Support\ClientRolePermissions;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class EmployeeService
{
    /**
     * @return array<int, string>
     */
    private function mandatoryAdminPermissions(): array
    {
        return [
            UserPermission::ROLES_VIEW->value,
            UserPermission::ROLES_MANAGE->value,
        ];
    }

    public function __construct(
        private readonly EmployeeRepository $employees,
        private readonly PermissionRegistrar $permissionRegistrar,
        private readonly SkillService $skills,
        private readonly EmployeeArchiveRateService $archiveRates,
        private readonly ProjectAssignmentHistoryRepository $projectAssignments,
    ) {}

    public function create(User $actor, array $data): User
    {
        $skillNames = $this->skills->normalizeSkillNamesFromString($data['skills'] ?? null);

        $user = $this->employees->create([
            'id' => (string) Str::uuid(),
            'company_id' => $actor->company_id,
            'email' => $data['email'],
            'name' => trim($data['first_name']),
            'last_name' => $data['last_name'],
            'password_hash' => Hash::make($data['password']),
            'role' => $data['role'],
            'role_id' => $data['role_id'] ?? null,
            'status' => 'ACTIVE',
            'position' => $data['position'],
            'birthday' => $data['birthday'],
            'phone' => $data['phone'],
            'socials' => $data['socials'],
            'skills' => $this->skills->joinSkillNames($skillNames),
            'payload' => $data['payload'] ?? null,
        ]);

        $user->syncSpatieRoleFromLegacyRole();
        $this->skills->syncUserSkills($user, $skillNames);

        return $user;
    }

    public function updateBlockedStatus(
        User $admin,
        User $employee,
        bool $blocked,
    ): User {
        if ($blocked && $employee->isBlocked()) {
            throw ValidationException::withMessages([
                'blocked' => ['Сотрудник уже находится в архиве.'],
            ]);
        }

        if ($admin->id === $employee->id && $blocked) {
            throw ValidationException::withMessages([
                'blocked' => ['Нельзя архивировать текущего администратора.'],
            ]);
        }

        if (! $blocked) {
            $this->ensureEmployeeCanBeRestored($employee, 'blocked');
        }

        return DB::transaction(function () use ($admin, $employee, $blocked): User {
            $company = $employee->company ?? $employee->company()->firstOrFail();
            $today = today($company->payrollTimezone());
            $archivedOn = $blocked ? $today : null;
            $updatedEmployee = $this->employees->update($employee, [
                'status' => $blocked ? UserStatus::BLOCKED->value : UserStatus::ACTIVE->value,
                'archived_at' => $archivedOn,
            ]);

            if ($blocked) {
                $this->projectAssignments->closeAllForUser($updatedEmployee, $archivedOn ?? $today);
                $this->archiveRates->archive($updatedEmployee, $admin);
            }

            return $updatedEmployee;
        });
    }

    private function ensureEmployeeCanBeRestored(User $employee, string $field): void
    {
        $company = $employee->company;
        $maxEmployees = $company?->tariff?->max_employees;

        if ($maxEmployees === null) {
            return;
        }

        $activeCount = $company->employees()->where('status', UserStatus::ACTIVE)->count();

        if ($activeCount >= $maxEmployees) {
            throw ValidationException::withMessages([
                $field => ['Нельзя восстановить сотрудника: исчерпан лимит активных сотрудников по тарифу.'],
            ]);
        }
    }

    public function updateRole(User $admin, User $employee, string $role, ?int $roleId = null): User
    {
        if ($admin->id === $employee->id && $role !== UserRole::ADMIN->value) {
            throw ValidationException::withMessages([
                'role' => ['Нельзя понизить роль текущего администратора.'],
            ]);
        }

        $updatedUser = $this->employees->update($employee, [
            'role' => $role,
            'role_id' => $roleId ?? $employee->role_id,
        ]);

        $updatedUser->syncSpatieRoleFromLegacyRole();
        $this->permissionRegistrar->forgetCachedPermissions();

        return $updatedUser;
    }

    public function updateProfile(User $admin, User $employee, array $data): User
    {
        $skillNames = $this->skills->normalizeSkillNamesFromString($data['skills'] ?? null);
        $status = isset($data['status'])
            ? UserStatus::from((string) $data['status'])
            : $employee->status;

        if ($admin->id === $employee->id && $data['role'] !== UserRole::ADMIN->value) {
            throw ValidationException::withMessages([
                'role' => ['Нельзя понизить роль текущего администратора.'],
            ]);
        }

        if ($admin->id === $employee->id && $status === UserStatus::BLOCKED) {
            throw ValidationException::withMessages([
                'status' => ['Нельзя архивировать текущего администратора.'],
            ]);
        }

        if ($employee->isBlocked() && $status === UserStatus::ACTIVE) {
            $this->ensureEmployeeCanBeRestored($employee, 'status');
        }

        $company = $employee->company ?? $employee->company()->firstOrFail();
        $archivedOn = $status === UserStatus::BLOCKED
            ? (isset($data['archived_at'])
                ? Carbon::createFromFormat('Y-m-d', $data['archived_at'], $company->payrollTimezone())->startOfDay()
                : ($employee->archived_at ?? today($company->payrollTimezone())))
            : null;
        $becameBlocked = ! $employee->isBlocked() && $status === UserStatus::BLOCKED;

        $updatedUser = DB::transaction(function () use ($admin, $employee, $data, $skillNames, $status, $archivedOn, $becameBlocked): User {
            $attributes = [
                'name' => trim($data['first_name']),
                'last_name' => trim($data['last_name']),
                'role' => $data['role'],
                'role_id' => $data['role_id'] ?? $employee->role_id,
                'position' => $data['position'],
                'birthday' => $data['birthday'],
                'phone' => $data['phone'],
                'socials' => $data['socials'],
                'skills' => $this->skills->joinSkillNames($skillNames),
                'payload' => $data['payload'] ?? null,
                'status' => $status->value,
                'archived_at' => $archivedOn,
            ];
            if (array_key_exists('weekly_plan_seconds', $data)) {
                $attributes['weekly_plan_seconds'] = $data['weekly_plan_seconds'];
            }

            $updatedUser = $this->employees->update($employee, $attributes);
            $this->skills->syncUserSkills($updatedUser, $skillNames);

            if ($becameBlocked) {
                $this->projectAssignments->closeAllForUser($updatedUser, $archivedOn);
                $this->archiveRates->archive($updatedUser, $admin, $archivedOn);
            }

            return $updatedUser;
        });

        $updatedUser->syncSpatieRoleFromLegacyRole();
        $this->permissionRegistrar->forgetCachedPermissions();

        return $updatedUser;
    }

    public function changePassword(User $admin, User $employee, string $password): User
    {
        if ($admin->id === $employee->id) {
            throw ValidationException::withMessages([
                'password' => ['Для смены собственного пароля используйте настройки профиля.'],
            ]);
        }

        return $this->employees->update($employee, [
            'password_hash' => Hash::make($password),
        ]);
    }

    public function delete(User $admin, User $employee): void
    {
        if ($admin->id === $employee->id) {
            throw ValidationException::withMessages([
                'employee' => ['Нельзя удалить текущего администратора.'],
            ]);
        }

        if (! $employee->isBlocked()) {
            throw ValidationException::withMessages([
                'employee' => ['Удалять можно только сотрудников из архива.'],
            ]);
        }

        $createdProjectNames = $this->employees->createdProjectNames($employee);

        if ($createdProjectNames !== []) {
            $projectNames = collect($createdProjectNames)
                ->map(static fn (string $name): string => "«{$name}»")
                ->implode(', ');

            throw ValidationException::withMessages([
                'employee' => [
                    "Нельзя удалить сотрудника, так как он является создателем проектов: {$projectNames}. Сначала измените создателя этих проектов.",
                ],
            ]);
        }

        $totalSeconds = $this->employees->totalSeconds($employee);

        if ($totalSeconds > 0) {
            throw ValidationException::withMessages([
                'employee' => ['Нельзя удалить сотрудника, потому что у него есть учтённое время.'],
            ]);
        }

        DB::transaction(function () use ($employee): void {
            $employee->syncRoles([]);
            $employee->syncPermissions([]);
            $employee->deniedPermissions()->detach();
            $employee->competencies()->detach();

            $this->employees->delete($employee);
        });

        $this->permissionRegistrar->forgetCachedPermissions();
        $employee->flushPermissionCache();
    }

    public function syncPermissions(
        User $admin,
        User $employee,
        array $permissions,
        array $deniedPermissions = [],
    ): User {
        if ($admin->id === $employee->id && $employee->role !== UserRole::ADMIN->value) {
            throw ValidationException::withMessages([
                'permissions' => ['Нельзя изменять свои права, если вы не администратор.'],
            ]);
        }

        $normalizedPermissions = collect($permissions)
            ->filter(static fn (mixed $permission): bool => is_string($permission) && $permission !== '')
            ->map(static fn (string $permission): string => trim($permission))
            ->unique()
            ->values();

        $invalidPermissions = $normalizedPermissions
            ->reject(static fn (string $permission): bool => in_array($permission, UserPermission::values(), true))
            ->values();

        if ($invalidPermissions->isNotEmpty()) {
            throw ValidationException::withMessages([
                'permissions' => ['Переданы неизвестные права.'],
            ]);
        }

        $normalizedDeniedPermissions = collect($deniedPermissions)
            ->filter(static fn (mixed $permission): bool => is_string($permission) && $permission !== '')
            ->map(static fn (string $permission): string => trim($permission))
            ->unique()
            ->values();

        $invalidDeniedPermissions = $normalizedDeniedPermissions
            ->reject(static fn (string $permission): bool => in_array($permission, UserPermission::values(), true))
            ->values();

        if ($invalidDeniedPermissions->isNotEmpty()) {
            throw ValidationException::withMessages([
                'denied_permissions' => ['Переданы неизвестные права.'],
            ]);
        }

        $roleValue = (string) $employee->role;
        $normalizedPermissions = collect(ClientRolePermissions::filterFor($roleValue, $normalizedPermissions->all()));
        $normalizedDeniedPermissions = collect(ClientRolePermissions::filterFor($roleValue, $normalizedDeniedPermissions->all()));

        $uiPermissionValues = UserPermission::uiValues();
        $hiddenDirectPermissions = $employee->getDirectPermissions()
            ->pluck('name')
            ->reject(
                static fn (string $permission): bool => in_array($permission, $uiPermissionValues, true)
            )
            ->values();

        $nextPermissions = $normalizedPermissions
            ->filter(
                static fn (string $permission): bool => in_array($permission, $uiPermissionValues, true)
            )
            ->merge($hiddenDirectPermissions)
            ->unique()
            ->values();

        if ((string) $employee->role === UserRole::ADMIN->value) {
            $nextPermissions = $nextPermissions
                ->merge($this->mandatoryAdminPermissions())
                ->unique()
                ->values();
        }

        $nextPermissions->each(
            static fn (string $permission): mixed => Permission::findOrCreate($permission, 'web')
        );

        $employee->syncPermissions($nextPermissions->all());

        $nextDeniedPermissions = $normalizedDeniedPermissions
            ->filter(
                static fn (string $permission): bool => in_array($permission, $uiPermissionValues, true)
            )
            ->reject(static fn (string $permission): bool => $nextPermissions->contains($permission))
            ->values();

        if ((string) $employee->role === UserRole::ADMIN->value) {
            $nextDeniedPermissions = $nextDeniedPermissions
                ->reject(
                    fn (string $permission): bool => in_array($permission, $this->mandatoryAdminPermissions(), true)
                )
                ->values();
        }

        $deniedPermissionIds = $nextDeniedPermissions
            ->map(
                static fn (string $permission): int => Permission::findOrCreate($permission, 'web')->id
            )
            ->all();

        $employee->deniedPermissions()->sync($deniedPermissionIds);
        $this->permissionRegistrar->forgetCachedPermissions();
        $employee->flushPermissionCache();

        return $employee->fresh();
    }
}
