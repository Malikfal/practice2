<?php

namespace Database\Seeders;

use App\Enums\CompanyStatus;
use App\Enums\UserRole;
use App\Models\Company;
use App\Models\Project;
use App\Models\User;
use App\Support\RoleDefaults;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

class SuperAdminAndCompanySeeder extends Seeder
{
    public function run(): void
    {
        $defaultPassword = 'password123';

        $company = Company::firstOrCreate(
            ['name' => 'ALT Studio'],
            [
                'id' => (string) Str::uuid(),
                'status' => CompanyStatus::ACTIVE->value,
            ]
        );

        $this->attachLegacyRoleToCompanyIfExists(UserRole::ADMIN, (string) $company->id);
        $this->attachLegacyRoleToCompanyIfExists(UserRole::MANAGER, (string) $company->id);
        $this->attachLegacyRoleToCompanyIfExists(UserRole::WORKER, (string) $company->id);

        $ownerRole = User::findOrCreateScopedRole(UserRole::ADMIN->value, (string) $company->id);
        $superadminRole = User::findOrCreateScopedRole(UserRole::SUPERADMIN->value, '');

        $ownerPayload = [
            'id' => (string) Str::uuid(),
            'company_id' => $company->id,
            'name' => 'ALT Owner',
            'last_name' => '',
            'password_hash' => Hash::make($defaultPassword),
            'status' => 'ACTIVE',
        ];
        if (Schema::hasColumn('users', 'role_id')) {
            $ownerPayload['role_id'] = $ownerRole->id;
        } else {
            $ownerPayload['role'] = UserRole::ADMIN->value;
        }

        $owner = User::withBlocked()->firstOrCreate(['email' => 'altstudio@gmail.com'], $ownerPayload);

        $ownerUpdatePayload = [
            'company_id' => $company->id,
            'name' => 'ALT Owner',
            'last_name' => '',
            'status' => 'ACTIVE',
            'password_hash' => $owner->password_hash ?: Hash::make($defaultPassword),
        ];
        if (Schema::hasColumn('users', 'role_id')) {
            $ownerUpdatePayload['role_id'] = $ownerRole->id;
        }
        $owner->forceFill($ownerUpdatePayload)->save();
        RoleDefaults::syncForCompany((string) $company->id);
        if (Schema::hasColumn('users', 'role_id')) {
            $owner->forceFill(['role_id' => $ownerRole->id])->save();
        } else {
            $owner->role = UserRole::ADMIN->value;
            $owner->save();
        }
        $owner->syncSpatieRoleFromLegacyRole();

        $company->forceFill([
            'owner_user_id' => $owner->id,
            'status' => CompanyStatus::ACTIVE->value,
            'blocked_at' => null,
        ])->save();

        $superadminPayload = [
            'id' => (string) Str::uuid(),
            'company_id' => null,
            'name' => 'Super Admin',
            'last_name' => 'System',
            'password_hash' => Hash::make($defaultPassword),
            'status' => 'ACTIVE',
        ];
        if (Schema::hasColumn('users', 'role_id')) {
            $superadminPayload['role_id'] = $superadminRole->id;
        } else {
            $superadminPayload['role'] = UserRole::SUPERADMIN->value;
        }

        $superadmin = User::withBlocked()->firstOrCreate(
            ['email' => 'superadmin@gmail.com'],
            $superadminPayload
        );

        $superadminUpdatePayload = [
            'company_id' => null,
            'name' => 'Super Admin',
            'last_name' => 'System',
            'status' => 'ACTIVE',
            'password_hash' => $superadmin->password_hash ?: Hash::make($defaultPassword),
        ];
        if (Schema::hasColumn('users', 'role_id')) {
            $superadminUpdatePayload['role_id'] = $superadminRole->id;
        }
        $superadmin->forceFill($superadminUpdatePayload)->save();
        RoleDefaults::syncSuperadminRole();
        if (Schema::hasColumn('users', 'role_id')) {
            $superadmin->forceFill(['role_id' => $superadminRole->id])->save();
        } else {
            $superadmin->role = UserRole::SUPERADMIN->value;
            $superadmin->save();
        }
        $superadmin->syncSpatieRoleFromLegacyRole();

        User::withBlocked()
            ->whereNull('company_id')
            ->where('id', '!=', $superadmin->id)
            ->whereDoesntHave('roles', static function ($query): void {
                $query->where('name', UserRole::SUPERADMIN->value)
                    ->where('guard_name', 'web');
            })
            ->update([
                'company_id' => $company->id,
            ]);

        Project::query()
            ->whereNull('company_id')
            ->update([
                'company_id' => $company->id,
            ]);
    }

    private function attachLegacyRoleToCompanyIfExists(UserRole $role, string $companyId): void
    {
        $legacyRole = Role::query()
            ->where('name', $role->value)
            ->where('guard_name', 'web')
            ->whereNull('company_id')
            ->first();

        if (! $legacyRole) {
            return;
        }

        $scopedRole = Role::query()
            ->where('name', $role->value)
            ->where('guard_name', 'web')
            ->where('company_id', $companyId)
            ->first();

        if ($scopedRole) {
            return;
        }

        $legacyRole->update(['company_id' => $companyId]);
    }
}
