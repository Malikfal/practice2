<?php

namespace App\Services\Admin;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class RoleService
{
    public function __construct(
        private readonly PermissionRegistrar $permissionRegistrar,
    ) {}

    public function delete(string $roleValue, string $companyId): void
    {
        if (in_array($roleValue, $this->immutableRoleValues(), true)) {
            throw ValidationException::withMessages([
                'role' => ['Дефолтную роль нельзя удалить.'],
            ]);
        }

        $roleModel = $this->findCompanyRoleByValue($roleValue, $companyId);
        if (! $roleModel) {
            throw new NotFoundHttpException('Роль не найдена.');
        }

        $usersCount = User::withBlocked()
            ->when($companyId !== '', static fn ($query) => $query->where('company_id', $companyId))
            ->where('role_id', $roleModel->id)
            ->count();

        if ($usersCount > 0) {
            throw ValidationException::withMessages([
                'role' => ['Нельзя удалить роль, пока она назначена сотрудникам.'],
            ]);
        }

        User::flushRolePermissionCache($roleModel->id);
        $roleModel->delete();
        $this->permissionRegistrar->forgetCachedPermissions();
    }

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

    private function findCompanyRoleByValue(string $roleValue, string $companyId): ?Role
    {
        return Role::query()
            ->where('name', $roleValue)
            ->where('guard_name', 'web')
            ->where('company_id', $companyId !== '' ? $companyId : null)
            ->first();
    }
}
