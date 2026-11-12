<?php

namespace App\Services\Workspace;

use App\Enums\UserPermission;
use App\Models\User;
use App\Services\Payroll\Finance\PayrollFinanceArticleService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class EmployeePayrollSettingsService
{
    /**
     * Подключает проверку и разрешение зарплатных финансовых статей.
     */
    public function __construct(
        private readonly PayrollFinanceArticleService $articles,
    ) {}

    /**
     * Возвращает настройку финансовой статьи сотрудника.
     */
    public function show(User $actor, User $employee): User
    {
        $this->assertAccess($actor, $employee);
        $employee->loadMissing('salaryFinanceArticle');

        return $employee;
    }

    /**
     * Проверяет и сохраняет индивидуальную финансовую статью сотрудника.
     *
     * @param  array{salary_finance_article_id:?string}  $data
     */
    public function update(User $actor, User $employee, array $data): User
    {
        $this->assertAccess($actor, $employee);
        $company = $employee->company()->firstOrFail();
        $articleId = $data['salary_finance_article_id'] ?? null;

        $this->articles->assertSelectable($company, $articleId);
        $employee->update(['salary_finance_article_id' => $articleId]);

        return $employee->fresh('salaryFinanceArticle');
    }

    /**
     * Проверяет доступ к настройкам оплаты труда сотрудника своей компании.
     */
    private function assertAccess(User $actor, User $employee): void
    {
        if (! $actor->can(UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value)) {
            throw new NotFoundHttpException;
        }

        if (! $actor->isSuperAdmin() && (string) $actor->company_id !== (string) $employee->company_id) {
            throw new NotFoundHttpException;
        }
    }
}
