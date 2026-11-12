<?php

namespace App\Services\Workspace;

use App\Models\PayrollPayoutArticle;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PayrollPayoutArticleService
{
    /** Статьи, которые получает компания при первом включении учета выплат. */
    private const DEFAULT_NAMES = [
        'Аванс на карту',
        'Аванс через кассу',
        'Расчёт на карту',
        'Расчёт через кассу',
        'Отпускные и больничные',
        'Расчёт при увольнении',
        'НДФЛ',
        'Удержания',
    ];

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function list(string $companyId): Collection
    {
        return PayrollPayoutArticle::query()
            ->where('company_id', $companyId)
            ->withCount('payouts')
            ->orderByRaw('archived_at is not null')
            ->orderBy('name')
            ->get()
            ->map(fn (PayrollPayoutArticle $article): array => $this->payload($article, (int) $article->payouts_count));
    }

    /**
     * @return array<string, mixed>
     */
    public function create(string $companyId, string $name): array
    {
        $article = PayrollPayoutArticle::query()->create([
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
            'name' => trim($name),
        ]);

        return $this->payload($article, 0);
    }

    /**
     * @return array<string, mixed>
     */
    public function rename(PayrollPayoutArticle $article, string $companyId, string $name): array
    {
        $this->assertCompany($article, $companyId);
        $article->update(['name' => trim($name)]);

        return $this->payload($article, $article->payouts()->count());
    }

    /**
     * Статью с выплатами убирает в архив, чтобы история выплат не потеряла основание.
     *
     * @return array<string, mixed>|null null, если статья удалена совсем
     */
    public function delete(PayrollPayoutArticle $article, string $companyId): ?array
    {
        $this->assertCompany($article, $companyId);

        // Удаленные выплаты тоже ссылаются на статью, поэтому учитываются.
        $payoutsCount = $article->payouts()->withTrashed()->count();
        if ($payoutsCount === 0) {
            $article->delete();

            return null;
        }

        $article->update(['archived_at' => now()]);

        return $this->payload($article, $article->payouts()->count());
    }

    /**
     * @return array<string, mixed>
     */
    public function restore(PayrollPayoutArticle $article, string $companyId): array
    {
        $this->assertCompany($article, $companyId);
        $article->update(['archived_at' => null]);

        return $this->payload($article, $article->payouts()->count());
    }

    public function ensureDefaults(string $companyId): void
    {
        if (PayrollPayoutArticle::query()->where('company_id', $companyId)->exists()) {
            return;
        }

        foreach (self::DEFAULT_NAMES as $name) {
            PayrollPayoutArticle::query()->create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => $name,
            ]);
        }
    }

    private function assertCompany(PayrollPayoutArticle $article, string $companyId): void
    {
        if ((string) $article->company_id !== $companyId) {
            throw new NotFoundHttpException;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(PayrollPayoutArticle $article, int $payoutsCount): array
    {
        return [
            'id' => (string) $article->id,
            'name' => $article->name,
            'is_archived' => $article->archived_at !== null,
            'payouts_count' => $payoutsCount,
        ];
    }
}
