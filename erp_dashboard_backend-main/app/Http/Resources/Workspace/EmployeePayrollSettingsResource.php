<?php

namespace App\Http\Resources\Workspace;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
final class EmployeePayrollSettingsResource extends JsonResource
{
    /**
     * Преобразует индивидуальные настройки оплаты труда сотрудника для API.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'employee_id' => (string) $this->id,
            'salary_finance_article_id' => $this->salary_finance_article_id
                ? (string) $this->salary_finance_article_id
                : null,
            'salary_finance_article' => $this->salaryFinanceArticle
                ? [
                    'id' => (string) $this->salaryFinanceArticle->id,
                    'name' => (string) $this->salaryFinanceArticle->name,
                ]
                : null,
        ];
    }
}
