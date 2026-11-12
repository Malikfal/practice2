<?php

use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Выдаёт существующим ролям «Клиент» новые права по умолчанию: просмотр документов проекта,
 * изменение приоритета и установку дедлайна. Остальные права ролей не меняются.
 */
return new class extends Migration
{
    private const NEW_CLIENT_PERMISSIONS = [
        UserPermission::PROJECTS_TABS_DOCUMENTS_VIEW,
        UserPermission::CLIENT_PORTAL_TASK_PRIORITY_UPDATE,
        UserPermission::CLIENT_PORTAL_TASK_DEADLINE_SET,
    ];

    public function up(): void
    {
        $registrar = app(PermissionRegistrar::class);
        $registrar->forgetCachedPermissions();

        $permissions = array_map(
            static fn (UserPermission $permission): Permission => Permission::findOrCreate($permission->value, 'web'),
            self::NEW_CLIENT_PERMISSIONS,
        );

        Role::query()
            ->where('guard_name', 'web')
            ->where('name', UserRole::CLIENT->value)
            ->get()
            ->each(static function (Role $role) use ($permissions): void {
                $role->givePermissionTo($permissions);
                User::flushRolePermissionCache($role->id);
            });

        $registrar->forgetCachedPermissions();
    }

    public function down(): void
    {
        Role::query()
            ->where('guard_name', 'web')
            ->where('name', UserRole::CLIENT->value)
            ->get()
            ->each(static function (Role $role): void {
                $role->revokePermissionTo(UserPermission::PROJECTS_TABS_DOCUMENTS_VIEW->value);
                User::flushRolePermissionCache($role->id);
            });

        Permission::query()
            ->where('guard_name', 'web')
            ->whereIn('name', [
                UserPermission::CLIENT_PORTAL_TASK_PRIORITY_UPDATE->value,
                UserPermission::CLIENT_PORTAL_TASK_DEADLINE_SET->value,
            ])
            ->get()
            ->each(static fn (Permission $permission) => $permission->delete());

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
