<?php

namespace App\Services\Workspace;

use App\Http\Resources\Workspace\FinanceArticleResource;
use App\Models\User;
use App\Services\Payroll\Finance\PayrollFinanceArticleService;
use Illuminate\Support\Facades\DB;

class FinanceSettingsService
{
    /**
     * Подключает синхронизацию индивидуальных статей при смене общей статьи.
     */
    public function __construct(
        private readonly PayrollFinanceArticleService $payrollArticles,
    ) {}

    public function show(User $user): array
    {
        $company = $user->company?->loadMissing([
            'defaultSalaryFinanceArticle.childrenRecursive',
            'defaultFixedAbsenceFinanceArticle',
        ]);
        $article = $company?->defaultSalaryFinanceArticle;
        $absenceArticle = $company?->defaultFixedAbsenceFinanceArticle;

        return [
            'default_salary_finance_article_id' => $article ? (string) $article->id : null,
            'default_salary_finance_article' => $article
                ? FinanceArticleResource::make($article)->resolve(request())
                : null,
            'default_fixed_absence_finance_article_id' => $absenceArticle ? (string) $absenceArticle->id : null,
            'default_fixed_absence_finance_article' => $absenceArticle
                ? FinanceArticleResource::make($absenceArticle)->resolve(request())
                : null,
            'calculate_daily_payroll' => (bool) ($company?->calculate_daily_payroll ?? false),
        ];
    }

    public function update(User $user, array $data): array
    {
        DB::transaction(function () use ($user, $data): void {
            $changes = collect([
                'default_salary_finance_article_id',
                'default_fixed_absence_finance_article_id',
                'calculate_daily_payroll',
            ])->filter(static fn (string $key): bool => array_key_exists($key, $data))
                ->mapWithKeys(static fn (string $key): array => [
                    $key => $key === 'calculate_daily_payroll' ? (bool) $data[$key] : $data[$key],
                ])
                ->all();

            if ($changes !== []) {
                $user->company()->update($changes);
            }

            $company = $user->company()->firstOrFail();
            $this->payrollArticles->clearInvalidEmployeeArticles($company);
        });

        return $this->show($user->fresh([
            'company.defaultSalaryFinanceArticle.childrenRecursive',
            'company.defaultFixedAbsenceFinanceArticle',
        ]));
    }
}
