<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DeleteRoleRequest;
use App\Http\Requests\Admin\StoreRoleRequest;
use App\Http\Requests\Admin\RolesAccessRequest;
use App\Http\Requests\Admin\SyncRolePermissionsRequest;
use App\Http\Requests\Admin\UpdateRoleRequest;
use App\Models\User;
use App\Services\Admin\RoleService;
use App\Support\ClientRolePermissions;
use App\Support\RoleCatalog;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class AdminRolePermissionController extends Controller
{
    public function __construct(
        private readonly RoleService $roles,
    ) {}

    /**
     * @return array<int, string>
     */
    private function immutableRoleValues(): array
    {
        return [
            UserRole::ADMIN->value,
            UserRole::MANAGER->value,
            UserRole::WORKER->value,
            UserRole::CLIENT->value,
        ];
    }

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

    public function index(RolesAccessRequest $request): JsonResponse
    {
        $uiPermissionValues = UserPermission::uiValues();

        foreach (UserPermission::uiCases() as $permission) {
            Permission::findOrCreate($permission->value, 'web');
        }

        $roles = $this->getCompanyRolesWithDefaults($request)
            ->map(function (Role $roleModel) use ($uiPermissionValues): array {
                $roleValue = (string) $roleModel->name;

                return [
                    'value' => $roleValue,
                    'display_name' => trim((string) ($roleModel->display_name ?? '')) !== ''
                        ? (string) $roleModel->display_name
                        : (UserRole::labelByValue($roleValue) ?? $roleValue),
                    'label' => trim((string) ($roleModel->display_name ?? '')) !== ''
                        ? (string) $roleModel->display_name
                        : (UserRole::labelByValue($roleValue) ?? $roleValue),
                    'is_immutable' => in_array($roleValue, $this->immutableRoleValues(), true),
                    'available_permissions' => ClientRolePermissions::availableFor($roleValue),
                    'permissions' => $roleModel->permissions
                        ->pluck('name')
                        ->filter(
                            static fn (string $permission): bool => in_array($permission, $uiPermissionValues, true)
                        )
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();

        $permissions = array_map(
            static fn (UserPermission $permission): array => [
                'value' => $permission->value,
                'label' => $permission->label(),
            ],
            UserPermission::uiCases(),
        );

        return response()->json([
            'roles' => $roles,
            'permissions' => $permissions,
        ]);
    }

    public function sync(
        SyncRolePermissionsRequest $request,
        string $role,
    ): JsonResponse {
        $resolvedRole = trim($role);
        if ($resolvedRole === '' || $resolvedRole === UserRole::SUPERADMIN->value) {
            abort(404, 'Роль не найдена.');
        }

        $roleModel = $this->findOrCreateCompanyRoleByValue($request, $resolvedRole);
        $permissions = (array) $request->validated('permissions', []);

        $uiPermissionValues = UserPermission::uiValues();
        $existingPermissions = $roleModel->permissions->pluck('name')->values();
        $existingUiPermissions = $existingPermissions
            ->filter(
                static fn (string $permission): bool => in_array($permission, $uiPermissionValues, true)
            )
            ->values();
        $hiddenPermissions = $existingPermissions
            ->reject(
                static fn (string $permission): bool => in_array($permission, $uiPermissionValues, true)
            )
            ->values();

        $nextUiPermissions = collect($permissions)
            ->filter(
                static fn (string $permission): bool => in_array($permission, $uiPermissionValues, true)
            )
            ->unique()
            ->values();

        if ($resolvedRole === UserRole::ADMIN->value) {
            $nextUiPermissions = $nextUiPermissions
                ->merge($this->mandatoryAdminPermissions())
                ->unique()
                ->values();
        }

        $nextUiPermissions = collect(ClientRolePermissions::filterFor($resolvedRole, $nextUiPermissions->all()));

        $nextPermissions = $nextUiPermissions
            ->merge($hiddenPermissions)
            ->unique()
            ->values()
            ->all();

        foreach ($nextPermissions as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        $roleModel->syncPermissions($nextPermissions);
        $this->syncRoleUserOverrides(
            $request,
            $resolvedRole,
            $existingUiPermissions->all(),
            $nextUiPermissions->all(),
        );
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        User::flushRolePermissionCache($roleModel->id);

        return response()->json([
            'role' => $resolvedRole,
            'permissions' => $roleModel->fresh()->permissions
                ->pluck('name')
                ->filter(static fn (string $permission): bool => in_array($permission, $uiPermissionValues, true))
                ->values()
                ->all(),
        ]);
    }

    public function store(StoreRoleRequest $request): JsonResponse
    {
        $roleValue = (string) $request->validated('role');
        $displayName = (string) $request->validated('display_name');
        $companyId = (string) ($request->attributes->get('company_id') ?? $request->user()?->company_id ?? '');

        $exists = Role::query()
            ->where('name', $roleValue)
            ->where('guard_name', 'web')
            ->where('company_id', $companyId !== '' ? $companyId : null)
            ->exists();

        if ($exists) {
            abort(422, 'Такая роль уже существует.');
        }

        $roleModel = User::findOrCreateScopedRole($roleValue, $companyId);
        $roleModel->update(['display_name' => $displayName]);

        return response()->json([
            'value' => (string) $roleModel->name,
            'display_name' => (string) $roleModel->display_name,
            'label' => (string) $roleModel->display_name,
            'is_immutable' => false,
            'available_permissions' => ClientRolePermissions::availableFor($roleValue),
            'permissions' => [],
        ], 201);
    }

    public function update(UpdateRoleRequest $request, string $role): JsonResponse
    {
        $roleValue = trim($role);
        $nextRoleValue = (string) $request->validated('role', $roleValue);
        $displayName = (string) $request->validated('display_name');
        $isImmutable = in_array($roleValue, $this->immutableRoleValues(), true);

        if ($isImmutable && $nextRoleValue !== $roleValue) {
            abort(422, 'Нельзя изменить техническое имя дефолтной роли.');
        }

        $companyId = (string) ($request->attributes->get('company_id') ?? $request->user()?->company_id ?? '');

        $roleModel = $this->findCompanyRoleByValue($roleValue, $companyId);
        if (! $roleModel) {
            abort(404, 'Роль не найдена.');
        }

        if (! $isImmutable) {
            $duplicate = Role::query()
                ->where('name', $nextRoleValue)
                ->where('guard_name', 'web')
                ->where('company_id', $companyId !== '' ? $companyId : null)
                ->where('id', '!=', $roleModel->id)
                ->exists();

            if ($duplicate) {
                abort(422, 'Такая роль уже существует.');
            }
        }

        DB::transaction(function () use ($roleModel, $isImmutable, $nextRoleValue, $displayName): void {
            $updateData = ['display_name' => $displayName];

            if (! $isImmutable) {
                $updateData['name'] = $nextRoleValue;
            }

            $roleModel->update($updateData);

            // Users are linked by role_id, so role rename does not require user updates.
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'value' => $nextRoleValue,
            'display_name' => $displayName,
            'label' => $displayName,
            'is_immutable' => $isImmutable,
        ]);
    }

    public function destroy(DeleteRoleRequest $request, string $role): Response
    {
        $companyId = (string) ($request->attributes->get('company_id') ?? $request->user()?->company_id ?? '');
        $this->roles->delete(trim($role), $companyId);

        return response()->noContent();
    }

    private function syncRoleUserOverrides(
        Request $request,
        string $role,
        array $previousPermissions,
        array $nextPermissions,
    ): void {
        $addedPermissions = array_values(array_diff($nextPermissions, $previousPermissions));
        $removedPermissions = array_values(array_diff($previousPermissions, $nextPermissions));

        if ($addedPermissions === [] && $removedPermissions === []) {
            return;
        }

        $companyId = (string) ($request->attributes->get('company_id') ?? $request->user()?->company_id ?? '');

        $roleModel = $this->findOrCreateCompanyRoleByValue($request, $role);

        $users = User::withBlocked()
            ->when($companyId !== '', static fn ($query) => $query->where('company_id', $companyId))
            ->where('role_id', $roleModel->id)
            ->get();

        $userIds = $users->modelKeys();

        if ($addedPermissions !== []) {
            $addedPermissionIds = Permission::query()
                ->whereIn('name', $addedPermissions)
                ->pluck('id')
                ->all();

            $users->each(
                static fn (User $user): mixed => $user->deniedPermissions()->detach($addedPermissionIds)
            );
        }

        if ($removedPermissions !== []) {
            $users->each(
                static fn (User $user): User => $user->revokePermissionTo($removedPermissions)
            );
        }

        User::flushPermissionCacheForUsers($userIds);
    }

    private function findOrCreateCompanyRoleByValue(Request $request, string $roleValue): Role
    {
        $companyId = (string) ($request->attributes->get('company_id') ?? $request->user()?->company_id ?? '');

        return User::findOrCreateScopedRole($roleValue, $companyId);
    }

    private function findCompanyRoleByValue(string $roleValue, string $companyId): ?Role
    {
        return Role::query()
            ->where('name', $roleValue)
            ->where('guard_name', 'web')
            ->where('company_id', $companyId !== '' ? $companyId : null)
            ->first();
    }

    private function getCompanyRolesWithDefaults(Request $request): EloquentCollection
    {
        $companyId = (string) ($request->attributes->get('company_id') ?? $request->user()?->company_id ?? '');

        foreach ($this->immutableRoleValues() as $roleValue) {
            $roleModel = User::findOrCreateScopedRole($roleValue, $companyId);
            if (trim((string) ($roleModel->display_name ?? '')) === '') {
                $roleModel->update([
                    'display_name' => RoleCatalog::labelForRole($companyId, $roleValue) ?? $roleValue,
                ]);
            }
        }

        return Role::query()
            ->where('guard_name', 'web')
            ->where('company_id', $companyId !== '' ? $companyId : null)
            ->where('name', '!=', UserRole::SUPERADMIN->value)
            ->with('permissions')
            ->orderByRaw(
                "CASE name WHEN 'ADMIN' THEN 0 WHEN 'MANAGER' THEN 1 WHEN 'WORKER' THEN 2 WHEN 'CLIENT' THEN 3 ELSE 4 END"
            )
            ->orderBy('name')
            ->get();
    }
}
