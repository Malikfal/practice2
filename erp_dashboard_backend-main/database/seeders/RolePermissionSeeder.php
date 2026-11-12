<?php

namespace Database\Seeders;

use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Models\User;
use App\Support\RoleDefaults;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissionRegistrar = app(PermissionRegistrar::class);
        $permissionRegistrar->forgetCachedPermissions();

        foreach (UserPermission::cases() as $permission) {
            Permission::findOrCreate($permission->value, 'web');
        }

        // Refresh Spatie's in-memory/cached permission registry before syncing roles.
        $permissionRegistrar->forgetCachedPermissions();

        RoleDefaults::syncSuperadminRole();
        User::withBlocked()
            ->whereNotNull('company_id')
            ->select('company_id')
            ->distinct()
            ->pluck('company_id')
            ->each(static function (string $companyId): void {
                RoleDefaults::syncForCompany($companyId);
            });

        User::withBlocked()
            ->get()
            ->each(static function (User $user): void {
                $roleValue = (string) $user->role;

                if (UserRole::tryFrom($roleValue) !== null) {
                    $user->syncSpatieRoleFromLegacyRole();
                }
            });
        
        User::withBlocked()
            ->with('roles')
            ->get()
            ->each(static function (User $user): void {
                $roleValue = (string) $user->role;

                if (UserRole::tryFrom($roleValue) === null) {
                    $roleValue = (string) $user->roles
                        ->pluck('name')
                        ->first(static fn (string $roleName): bool => UserRole::tryFrom($roleName) !== null);
                }

                if (UserRole::tryFrom($roleValue) === null) {
                    return;
                }

                $user->role = $roleValue;
                $user->syncSpatieRoleFromLegacyRole();
            });


        $permissionRegistrar->forgetCachedPermissions();
    }

}
