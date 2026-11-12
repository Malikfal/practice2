<?php

namespace Tests\Unit\Payroll;

use App\Enums\PayrollComponentType;
use App\Models\Company;
use App\Models\User;
use App\Services\Payroll\Distribution\Data\PayrollFinanceAllocation;
use App\Services\Payroll\Finance\PayrollFinanceArticleService;
use App\Services\Payroll\Finance\PayrollFinancePreparationService;
use Mockery;
use Tests\TestCase;

class PayrollFinancePreparationServiceTest extends TestCase
{
    /**
     * Проверяет объединение компонентов по фактической финансовой статье и проекту.
     */
    public function test_components_with_same_article_and_project_are_merged(): void
    {
        $articles = Mockery::mock(PayrollFinanceArticleService::class);
        $articles->shouldReceive('resolveId')
            ->andReturnUsing(static fn (Company $company, User $employee, PayrollComponentType $component): string => $component === PayrollComponentType::FIXED_ABSENCE
                ? 'absence-article'
                : 'salary-article');

        $rows = (new PayrollFinancePreparationService($articles))->prepare(
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            collect([
                new PayrollFinanceAllocation(PayrollComponentType::HOURLY, 'project-a', 100),
                new PayrollFinanceAllocation(PayrollComponentType::SUPERVISED_HOURLY, 'project-a', 200),
                new PayrollFinanceAllocation(PayrollComponentType::FIXED_ABSENCE, null, 50),
            ]),
        );

        $this->assertCount(2, $rows);
        $this->assertSame(300, $rows->firstWhere('financeArticleId', 'salary-article')->amount);
        $this->assertSame(50, $rows->firstWhere('financeArticleId', 'absence-article')->amount);
    }
}
