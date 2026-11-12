<?php

namespace App\Http\Resources\Workspace;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceDistributionPeriod;
use App\Enums\FinanceDistributionProjectMode;
use App\Enums\FinanceType;
use App\Models\FinanceArticle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FinanceArticle
 */
final class FinanceArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $type = $this->type instanceof FinanceType
            ? $this->type
            : FinanceType::tryFrom((string) $this->type);

        $distributionMethod = $this->distribution_method instanceof FinanceArticleDistributionMethod
            ? $this->distribution_method
            : FinanceArticleDistributionMethod::tryFrom((string) $this->distribution_method);
        $defaultDistributionPeriod = $this->default_distribution_period instanceof FinanceDistributionPeriod
            ? $this->default_distribution_period
            : FinanceDistributionPeriod::tryFrom((string) $this->default_distribution_period)
                ?? FinanceDistributionPeriod::CURRENT_DAY;
        $defaultDistributionProjectMode = $this->default_distribution_project_mode instanceof FinanceDistributionProjectMode
            ? $this->default_distribution_project_mode
            : FinanceDistributionProjectMode::tryFrom((string) $this->default_distribution_project_mode)
                ?? FinanceDistributionProjectMode::ALL;

        return [
            'id' => (string) $this->id,
            'company_id' => (string) $this->company_id,
            'parent_id' => $this->parent_id ? (string) $this->parent_id : null,
            'name' => $this->name,
            'type' => $type?->value ?? (string) $this->type,
            'type_label' => $type?->label() ?? (string) $this->type,
            'distribution_method' => $distributionMethod?->value ?? (string) $this->distribution_method,
            'distribution_method_label' => $distributionMethod?->label() ?? (string) $this->distribution_method,
            'default_distribution_period' => $defaultDistributionPeriod->value,
            'default_distribution_period_label' => $defaultDistributionPeriod->label(),
            'default_distribution_project_mode' => $defaultDistributionProjectMode->value,
            'default_distribution_project_mode_label' => $defaultDistributionProjectMode->label(),
            'default_distribution_project_ids' => array_values(array_map(
                'strval',
                $this->default_distribution_project_ids ?? [],
            )),
            'children' => $this->whenLoaded(
                'childrenRecursive',
                fn () => self::collection($this->childrenRecursive)->resolve($request),
            ),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
