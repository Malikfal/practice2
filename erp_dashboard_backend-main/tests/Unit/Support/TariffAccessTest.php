<?php

namespace Tests\Unit\Support;

use App\Enums\TariffFeature;
use App\Models\Company;
use App\Models\Tariff;
use App\Models\User;
use App\Support\TariffAccess;
use Illuminate\Http\Request;
use Tests\TestCase;

class TariffAccessTest extends TestCase
{
    public function test_free_tariff_locks_pro_permissions(): void
    {
        $user = $this->userOnPlan(Tariff::PLAN_FREE);

        $this->assertTrue($user->hasDeniedPermission('employees.tabs.salary.view'));
        $this->assertTrue($user->hasDeniedPermission('reports.managers.view'));
        $this->assertTrue($user->hasDeniedPermission('clients.flow_access.manage'));
        $this->assertFalse($user->hasDeniedPermission('projects.tabs.tasks.view'));
        $this->assertFalse($user->hasDeniedPermission('finance.view'));
        $this->assertFalse($user->hasDeniedPermission('reports.view'));
    }

    public function test_pro_tariff_and_missing_tariff_lock_nothing(): void
    {
        $this->assertTrue($this->userOnPlan(Tariff::PLAN_PRO)->tariffLockedPermissionNames()->isEmpty());

        $company = new Company(['id' => 'company-id']);
        $company->setRelation('tariff', null);
        $user = new User(['id' => 'user-id', 'company_id' => 'company-id']);
        $user->setRelation('company', $company);

        $this->assertTrue($user->tariffLockedPermissionNames()->isEmpty());
        $this->assertSame([], $company->lockedTariffFeatures());
    }

    public function test_free_tariff_locks_pro_routes_only(): void
    {
        $user = $this->userOnPlan(Tariff::PLAN_FREE);

        $locked = [
            'api/payroll-payouts/settings' => TariffFeature::PAYROLL,
            'api/employees/abc/payroll-calculations' => TariffFeature::PAYROLL,
            'api/employees/abc/rates/current' => TariffFeature::PAYROLL,
            'api/finance/analytics/overview' => TariffFeature::FINANCE_ANALYTICS,
            'api/finance/financial-results/projects' => TariffFeature::PROJECT_ECONOMICS,
            'api/projects/abc/rates' => TariffFeature::PROJECT_ECONOMICS,
            'api/tasks/abc/client-messages' => TariffFeature::CLIENT_ACCESS,
        ];
        foreach ($locked as $path => $feature) {
            $this->assertSame($feature, TariffAccess::lockedFeatureForRequest($user, Request::create('/'.$path)), $path);
        }

        foreach (['api/finance', 'api/finance/summary', 'api/projects/abc/tasks', 'api/employees', 'api/clients/abc', 'api/billing/tariffs'] as $path) {
            $this->assertNull(TariffAccess::lockedFeatureForRequest($user, Request::create('/'.$path)), $path);
        }

        $this->assertNull(TariffAccess::lockedFeatureForRequest(
            $this->userOnPlan(Tariff::PLAN_PRO),
            Request::create('/api/payroll-payouts/settings'),
        ));
    }

    private function userOnPlan(string $plan): User
    {
        $company = new Company(['id' => 'company-id']);
        $company->setRelation('tariff', new Tariff(['plan' => $plan, 'max_employees' => 6]));

        $user = new User(['id' => 'user-id', 'company_id' => 'company-id']);
        $user->setRelation('company', $company);
        $user->setRelation('deniedPermissions', collect());

        return $user;
    }
}
