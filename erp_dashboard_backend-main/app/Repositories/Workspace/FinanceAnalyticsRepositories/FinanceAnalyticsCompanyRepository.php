<?php

namespace App\Repositories\Workspace\FinanceAnalyticsRepositories;

use App\Models\Company;

class FinanceAnalyticsCompanyRepository
{
    /** Возвращает календарный часовой пояс, в котором компания ведёт аналитику. */
    public function timezoneForCompany(string $companyId): string
    {
        return Company::query()->findOrFail($companyId)->payrollTimezone();
    }
}
