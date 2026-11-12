<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Reports;

use App\Enums\FinanceArticleDistributionMethod;
use App\Models\FinanceArticle;
use Illuminate\Support\Collection;

/** Форматирование иерархии статей для API, без отдельных DTO для каждого узла. */
class ArticleTreeBuilder
{
    /**
     * Родитель включает дочерние суммы, но сохраняет свою сумму отдельно.
     *
     * @param  Collection<int, FinanceArticle>  $articles
     * @param  Collection<string, int>  $amounts
     * @return Collection<int, array<string, mixed>>
     */
    public function build(string $type, Collection $articles, Collection $amounts, int $total): Collection
    {
        /** @var Collection<string, FinanceArticle> $articles */
        $articles = $articles->filter(static fn (FinanceArticle $article): bool => $article->type->value === $type)->keyBy('id');
        /** @var Collection<string, Collection<int, FinanceArticle>> $children */
        $children = $articles->filter(static fn (FinanceArticle $article): bool => (bool) $article->parent_id)->groupBy('parent_id');
        $node = function (FinanceArticle $article) use (&$node, $children, $amounts, $total): ?array {
            /** @var Collection<int, array<string, mixed>> $nested */
            $nested = $children->get($article->id, collect())->map($node)->filter()->values();
            $own = (int) $amounts->get($article->id, 0);
            $childrenAmount = (int) $nested->sum('amount');
            $amount = $own + $childrenAmount;
            if ($amount === 0) {
                return null;
            }

            return [
                'article_id' => (string) $article->id,
                'name' => $article->name,
                'type' => $article->type->value,
                'distribution_method' => $article->distribution_method->value,
                'own_amount' => $own,
                'children_amount' => $childrenAmount,
                'amount' => $amount,
                'percent' => $total > 0 ? round($amount * 100 / $total, 2) : 0.0,
                'children' => $nested->all(),
            ];
        };
        /** @var Collection<int, array<string, mixed>> $roots */
        $roots = $articles->filter(static fn (FinanceArticle $article): bool => ! $article->parent_id || ! $articles->has($article->parent_id))
            ->map($node)->filter()->values();
        $withoutArticle = (int) $amounts->get('without_article', 0);
        if ($withoutArticle > 0) {
            $roots->push([
                'article_id' => null,
                'name' => 'Без статьи',
                'type' => $type,
                'distribution_method' => FinanceArticleDistributionMethod::BY_TERM->value,
                'own_amount' => $withoutArticle,
                'children_amount' => 0,
                'amount' => $withoutArticle,
                'percent' => $total > 0 ? round($withoutArticle * 100 / $total, 2) : 0.0,
                'children' => [],
            ]);
        }

        return $roots->sortBy('name')->values();
    }
}
