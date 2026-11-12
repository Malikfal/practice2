<?php

namespace App\Services\Workspace;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceDistributionPeriod;
use App\Enums\FinanceDistributionProjectMode;
use App\Enums\FinanceSource;
use App\Models\Company;
use App\Models\Finance;
use App\Models\FinanceArticle;
use App\Repositories\Workspace\FinanceRepository;
use App\Services\Payroll\Finance\PayrollFinanceArticleService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class FinanceService
{
    /**
     * Подключает хранение финансов, аналитический кеш и контроль payroll-статей.
     */
    public function __construct(
        private readonly FinanceRepository $finances,
        private readonly FinanceAnalyticsCacheService $analyticsCache,
        private readonly PayrollFinanceArticleService $payrollArticles,
    ) {}

    public function paginate(array $data, string $companyId): LengthAwarePaginator
    {
        return $this->finances->paginate($companyId, $data, (int) ($data['per_page'] ?? 20));
    }

    /** @return array{income: int, expenses: int, profit: int} */
    public function summary(array $data, string $companyId): array
    {
        return $this->finances->summary($companyId, $data);
    }

    public function create(array $data, string $companyId): Finance
    {
        $this->assertRelatedModelsBelongToCompany($data, $companyId);

        $finance = $this->finances->create($this->financeAttributes($data, [
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
        ]));

        $this->analyticsCache->invalidateCompany($companyId);

        return $finance;
    }

    public function show(Finance $finance, string $companyId): Finance
    {
        $this->assertFinanceCompany($finance, $companyId);

        return $finance->load(['project.client', 'article.childrenRecursive', 'employee']);
    }

    public function update(Finance $finance, array $data, string $companyId): Finance
    {
        $this->assertFinanceCompany($finance, $companyId);
        $this->assertRelatedModelsBelongToCompany($data, $companyId);

        $updatedFinance = $this->finances->update($finance, $this->financeAttributes($data));

        $this->analyticsCache->invalidateCompany($companyId);

        return $updatedFinance;
    }

    public function delete(Finance $finance, string $companyId): void
    {
        $this->assertFinanceCompany($finance, $companyId);

        $finance->delete();

        $this->analyticsCache->invalidateCompany($companyId);
    }

    public function articles(array $data, string $companyId): Collection
    {
        return $this->finances->articles($companyId, $data);
    }

    public function createArticle(array $data, string $companyId): FinanceArticle
    {
        $this->assertArticleParent($data['parent_id'] ?? null, $companyId);
        $this->assertProjectIdsBelongToCompany(
            $data['default_distribution_project_ids'] ?? [],
            $companyId,
        );

        [$projectMode, $projectIds] = $this->normalizedDistributionProjects(
            $data['default_distribution_project_mode'] ?? FinanceDistributionProjectMode::ALL->value,
            $data['default_distribution_project_ids'] ?? [],
        );

        $article = $this->finances->createArticle([
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
            'parent_id' => $data['parent_id'] ?? null,
            'name' => trim((string) $data['name']),
            'type' => $data['type'],
            'distribution_method' => $data['distribution_method'] ?? FinanceArticleDistributionMethod::BY_TERM,
            'default_distribution_period' => $data['default_distribution_period']
                ?? FinanceDistributionPeriod::CURRENT_DAY,
            'default_distribution_project_mode' => $projectMode,
            'default_distribution_project_ids' => $projectIds,
        ]);

        $this->analyticsCache->invalidateCompany($companyId);

        return $article;
    }

    public function showArticle(FinanceArticle $article, string $companyId): FinanceArticle
    {
        $this->assertArticleCompany($article, $companyId);

        return $article->load(['childrenRecursive']);
    }

    public function updateArticle(FinanceArticle $article, array $data, string $companyId): FinanceArticle
    {
        $this->assertArticleCompany($article, $companyId);
        $this->assertArticleParent($data['parent_id'] ?? null, $companyId, $article);
        $this->assertProjectIdsBelongToCompany(
            $data['default_distribution_project_ids'] ?? [],
            $companyId,
        );

        $attributes = [
            'parent_id' => $data['parent_id'] ?? null,
            'name' => trim((string) $data['name']),
            'type' => $data['type'],
        ];

        if (array_key_exists('distribution_method', $data)) {
            $attributes['distribution_method'] = $data['distribution_method'];
        }

        if (array_key_exists('default_distribution_period', $data)) {
            $attributes['default_distribution_period'] = $data['default_distribution_period'];
        }

        if (
            array_key_exists('default_distribution_project_mode', $data)
            || array_key_exists('default_distribution_project_ids', $data)
        ) {
            [$projectMode, $projectIds] = $this->normalizedDistributionProjects(
                $data['default_distribution_project_mode'] ?? FinanceDistributionProjectMode::ALL->value,
                $data['default_distribution_project_ids'] ?? [],
            );
            $attributes['default_distribution_project_mode'] = $projectMode;
            $attributes['default_distribution_project_ids'] = $projectIds;
        }

        $updatedArticle = DB::transaction(function () use ($article, $attributes, $companyId): FinanceArticle {
            $updatedArticle = $this->finances->updateArticle($article, $attributes);
            $company = Company::query()->findOrFail($companyId);
            $this->payrollArticles->clearInvalidEmployeeArticles($company);

            return $updatedArticle;
        });

        $this->analyticsCache->invalidateCompany($companyId);

        return $updatedArticle;
    }

    public function deleteArticle(FinanceArticle $article, string $companyId): void
    {
        $this->assertArticleCompany($article, $companyId);

        $article->delete();

        $this->analyticsCache->invalidateCompany($companyId);
    }

    private function financeAttributes(array $data, array $base = []): array
    {
        [$distributionFrom, $distributionTo] = $this->distributionDates($data);
        $attributes = array_merge($base, [
            'project_id' => $data['project_id'] ?? null,
            'finance_article_id' => $data['finance_article_id'] ?? null,
            'employee_id' => $data['employee_id'] ?? null,
            'amount' => $data['amount'],
            'type' => $data['type'],
            'comment' => $this->nullableString($data['comment'] ?? null),
            'dateOfPayment' => $data['dateOfPayment'],
            'distribution_from' => $distributionFrom,
            'distribution_to' => $distributionTo,
        ]);

        if ($base !== [] || array_key_exists('distribution_method', $data)) {
            $attributes['distribution_method'] = $this->paymentDistributionMethod($data);
        }

        if (array_key_exists('source', $data)) {
            $attributes['source'] = $data['source'];
        } elseif ($base !== []) {
            $attributes['source'] = FinanceSource::MANUAL->value;
        }

        if (
            $base !== []
            || array_key_exists('distribution_project_mode', $data)
            || array_key_exists('distribution_project_ids', $data)
        ) {
            [$projectMode, $projectIds] = $this->paymentDistributionProjects($data);
            $attributes['distribution_project_mode'] = $projectMode;
            $attributes['distribution_project_ids'] = $projectIds;
        }

        return $attributes;
    }

    private function paymentDistributionMethod(array $data): string
    {
        if (array_key_exists('distribution_method', $data)) {
            $method = $data['distribution_method'] instanceof FinanceArticleDistributionMethod
                ? $data['distribution_method']
                : FinanceArticleDistributionMethod::tryFrom((string) $data['distribution_method']);

            if ($method) {
                return $method->value;
            }
        }

        $articleId = $data['finance_article_id'] ?? null;

        if ($articleId) {
            $articleMethod = FinanceArticle::query()
                ->whereKey($articleId)
                ->value('distribution_method');
            $method = $articleMethod instanceof FinanceArticleDistributionMethod
                ? $articleMethod
                : FinanceArticleDistributionMethod::tryFrom((string) $articleMethod);

            if ($method) {
                return $method->value;
            }
        }

        return FinanceArticleDistributionMethod::BY_TERM->value;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: string, 1: list<string>}
     */
    private function paymentDistributionProjects(array $data): array
    {
        if (array_key_exists('distribution_project_mode', $data)) {
            return $this->normalizedDistributionProjects(
                $data['distribution_project_mode'],
                $data['distribution_project_ids'] ?? [],
            );
        }

        $articleId = $data['finance_article_id'] ?? null;

        if ($articleId) {
            $article = FinanceArticle::query()
                ->whereKey($articleId)
                ->first([
                    'default_distribution_project_mode',
                    'default_distribution_project_ids',
                ]);

            if ($article) {
                return $this->normalizedDistributionProjects(
                    $article->default_distribution_project_mode,
                    $article->default_distribution_project_ids ?? [],
                );
            }
        }

        return [FinanceDistributionProjectMode::ALL->value, []];
    }

    /**
     * @return array{0: string, 1: list<string>}
     */
    private function normalizedDistributionProjects(mixed $mode, mixed $projectIds): array
    {
        $modeValue = $mode instanceof FinanceDistributionProjectMode
            ? $mode
            : FinanceDistributionProjectMode::tryFrom((string) $mode);
        $modeValue ??= FinanceDistributionProjectMode::ALL;
        $ids = $modeValue === FinanceDistributionProjectMode::SELECTED && is_array($projectIds)
            ? array_values(array_unique(array_map('strval', $projectIds)))
            : [];

        return [$modeValue->value, $ids];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: string, 1: string}
     */
    private function distributionDates(array $data): array
    {
        if (! empty($data['distribution_from']) && ! empty($data['distribution_to'])) {
            return [(string) $data['distribution_from'], (string) $data['distribution_to']];
        }

        $period = FinanceDistributionPeriod::CURRENT_DAY;
        $articleId = $data['finance_article_id'] ?? null;

        if ($articleId) {
            $articlePeriod = FinanceArticle::query()
                ->whereKey($articleId)
                ->value('default_distribution_period');
            $period = $articlePeriod instanceof FinanceDistributionPeriod
                ? $articlePeriod
                : FinanceDistributionPeriod::tryFrom((string) $articlePeriod) ?? $period;
        }

        [$from, $to] = $period->bounds(Carbon::parse((string) $data['dateOfPayment']));

        return [$from->toDateString(), $to->toDateString()];
    }

    private function assertRelatedModelsBelongToCompany(array $data, string $companyId): void
    {
        $this->assertProjectIdsBelongToCompany(
            $data['distribution_project_ids'] ?? [],
            $companyId,
        );

        $checks = [
            ['table' => 'projects', 'key' => 'project_id'],
            ['table' => 'finance_article', 'key' => 'finance_article_id'],
            ['table' => 'users', 'key' => 'employee_id'],
        ];

        foreach ($checks as $check) {
            $id = $data[$check['key']] ?? null;

            if (! $id) {
                continue;
            }

            $query = DB::table($check['table'])
                ->where('id', $id)
                ->where('company_id', $companyId);

            if ($check['key'] === 'finance_article_id' && ! empty($data['type'])) {
                $query->where('type', $data['type']);
            }

            $exists = $query->exists();

            if (! $exists) {
                throw new NotFoundHttpException;
            }
        }
    }

    private function assertProjectIdsBelongToCompany(mixed $projectIds, string $companyId): void
    {
        if (! is_array($projectIds) || $projectIds === []) {
            return;
        }

        $ids = array_values(array_unique(array_map('strval', $projectIds)));
        $count = DB::table('projects')
            ->where('company_id', $companyId)
            ->whereIn('id', $ids)
            ->count();

        if ($count !== count($ids)) {
            throw new NotFoundHttpException;
        }
    }

    private function assertFinanceCompany(Finance $finance, string $companyId): void
    {
        if ((string) $finance->company_id !== $companyId) {
            throw new NotFoundHttpException;
        }
    }

    private function assertArticleCompany(FinanceArticle $article, string $companyId): void
    {
        if ((string) $article->company_id !== $companyId) {
            throw new NotFoundHttpException;
        }
    }

    private function assertArticleParent(?string $parentId, string $companyId, ?FinanceArticle $article = null): void
    {
        if (! $parentId) {
            return;
        }

        if ($article && (string) $article->id === $parentId) {
            throw new NotFoundHttpException;
        }

        $parentsById = DB::table('finance_article')
            ->where('company_id', $companyId)
            ->pluck('parent_id', 'id');

        if (! $parentsById->has($parentId)) {
            throw new NotFoundHttpException;
        }

        $currentParentId = $parentsById->get($parentId);

        while ($article && $currentParentId) {
            if ((string) $currentParentId === (string) $article->id) {
                throw new NotFoundHttpException;
            }

            $currentParentId = $parentsById->get($currentParentId);
        }
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
