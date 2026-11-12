<?php

use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Models\User;
use App\Support\ClientRolePermissions;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        $registrar = app(PermissionRegistrar::class);
        $registrar->forgetCachedPermissions();

        foreach (UserPermission::cases() as $permission) {
            Permission::findOrCreate($permission->value, 'web');
        }

        $permission = Permission::findByName(UserPermission::CLIENTS_FLOW_ACCESS_MANAGE->value, 'web');

        Role::query()
            ->where('guard_name', 'web')
            ->whereIn('name', [UserRole::ADMIN->value, UserRole::SUPERADMIN->value])
            ->get()
            ->each(static function (Role $role) use ($permission): void {
                $role->givePermissionTo($permission);
                User::flushRolePermissionCache($role->id);
            });

        Role::query()
            ->where('guard_name', 'web')
            ->where('name', UserRole::CLIENT->value)
            ->get()
            ->each(static function (Role $role): void {
                $role->givePermissionTo(ClientRolePermissions::defaults());
                User::flushRolePermissionCache($role->id);
            });

        $registrar->forgetCachedPermissions();
    }

    public function down(): void
    {
        $permission = Permission::query()
            ->where('name', UserPermission::CLIENTS_FLOW_ACCESS_MANAGE->value)
            ->where('guard_name', 'web')
            ->first();

        if ($permission) {
            Role::query()
                ->where('guard_name', 'web')
                ->get()
                ->each(static function (Role $role) use ($permission): void {
                    $role->revokePermissionTo($permission);
                    User::flushRolePermissionCache($role->id);
                });
            $permission->delete();
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
