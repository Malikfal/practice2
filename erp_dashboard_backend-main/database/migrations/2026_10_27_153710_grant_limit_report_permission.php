<?php

use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Models\User;
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

        $permission = Permission::findOrCreate(UserPermission::REPORTS_LIMITS_VIEW->value, 'web');

        // По умолчанию отчёт «Лимитные проекты» видят только администраторы, остальным право выдают в ролях.
        Role::query()
            ->where('guard_name', 'web')
            ->whereIn('name', [UserRole::ADMIN->value, UserRole::SUPERADMIN->value])
            ->get()
            ->each(static function (Role $role) use ($permission): void {
                $role->givePermissionTo($permission);
                User::flushRolePermissionCache($role->id);
            });

        $registrar->forgetCachedPermissions();
    }

    public function down(): void
    {
        $permission = Permission::query()
            ->where('name', UserPermission::REPORTS_LIMITS_VIEW->value)
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
