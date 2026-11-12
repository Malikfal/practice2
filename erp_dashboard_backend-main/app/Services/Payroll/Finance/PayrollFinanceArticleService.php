<?php

namespace App\Services\Payroll\Finance;

use App\Enums\FinanceType;
use App\Enums\PayrollComponentType;
use App\Models\Company;
use App\Models\FinanceArticle;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class PayrollFinanceArticleService
{
    /**
     * Возвращает индивидуальную статью сотрудника либо общую зарплатную статью компании, либо статью отсутутствия, если ничего не задано то null
     */
    public function resolveId(
        Company $company,
        User $employee,
        ?PayrollComponentType $component = null,
    ): ?string {
        if ($component === PayrollComponentType::FIXED_ABSENCE) {
            $absenceArticleId = (string) ($company->default_fixed_absence_finance_article_id ?? '');

            return $absenceArticleId !== '' ? $absenceArticleId : null;
        }

        $articleId = $employee->salary_finance_article_id;

        if ($articleId && $this->isSelectable($company, (string) $articleId)) {
            return (string) $articleId;
        }

        $defaultId = (string) ($company->default_salary_finance_article_id ?? '');

        return $defaultId !== '' && $this->isSelectable($company, $defaultId)
            ? $defaultId
            : null;
    }

    /**
     * Проверяет, что статья является дефолтной зарплатной статьей или ее потомком любой глубины.
     */
    public function isSelectable(Company $company, string $articleId): bool
    {
        $defaultId = (string) ($company->default_salary_finance_article_id ?? '');
        if ($defaultId === '') {
            return false;
        }

        $visited = [];
        $currentId = $articleId;

        while ($currentId !== '' && ! isset($visited[$currentId])) {
            $visited[$currentId] = true;
            $article = FinanceArticle::query()
                ->where('company_id', $company->id)
                ->where('type', FinanceType::EXPENDITURE->value)
                ->find($currentId, ['id', 'parent_id']);

            if (! $article) {
                return false;
            }

            if ((string) $article->id === $defaultId) {
                return true;
            }

            $currentId = (string) ($article->parent_id ?? '');
        }

        return false;
    }

    /**
     * Проверяет выбранную пользователем статью и формирует ошибку валидации.
     */
    public function assertSelectable(Company $company, ?string $articleId): void
    {
        if ($articleId === null || $articleId === '') {
            return;
        }

        if (! $this->isSelectable($company, $articleId)) {
            throw ValidationException::withMessages([
                'salary_finance_article_id' => [
                    'Можно выбрать только общую зарплатную статью или одну из ее дочерних статей.',
                ],
            ]);
        }
    }

    /**
     * Возвращает идентификаторы дефолтной статьи и всех ее потомков.
     *
     * @return Collection<int, string>
     */
    public function selectableIds(Company $company): Collection
    {
        $defaultId = (string) ($company->default_salary_finance_article_id ?? '');
        if ($defaultId === '') {
            return collect();
        }

        $hasValidRoot = FinanceArticle::query()
            ->whereKey($defaultId)
            ->where('company_id', $company->id)
            ->where('type', FinanceType::EXPENDITURE->value)
            ->exists();
        if (! $hasValidRoot) {
            return collect();
        }

        $ids = collect([$defaultId]);
        $frontier = collect([$defaultId]);

        while ($frontier->isNotEmpty()) {
            $children = FinanceArticle::query()
                ->where('company_id', $company->id)
                ->where('type', FinanceType::EXPENDITURE->value)
                ->whereIn('parent_id', $frontier->all())
                ->pluck('id')
                ->map(static fn (mixed $id): string => (string) $id)
                ->reject(static fn (string $id): bool => $ids->contains($id))
                ->values();

            $ids = $ids->merge($children);
            $frontier = $children;
        }

        return $ids->unique()->values();
    }

    /**
     * Очищает индивидуальные статьи, которые перестали относиться к новой основной статье.
     */
    public function clearInvalidEmployeeArticles(Company $company): void
    {
        $selectableIds = $this->selectableIds($company);

        User::withBlocked()
            ->where('company_id', $company->id)
            ->whereNotNull('salary_finance_article_id')
            ->when(
                $selectableIds->isNotEmpty(),
                static fn ($query) => $query->whereNotIn('salary_finance_article_id', $selectableIds->all()),
            )
            ->update(['salary_finance_article_id' => null]);
    }
}
