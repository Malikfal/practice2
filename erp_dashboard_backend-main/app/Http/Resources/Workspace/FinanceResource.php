<?php

namespace App\Http\Resources\Workspace;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceDistributionProjectMode;
use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Models\Finance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Finance
 */
final class FinanceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $type = $this->type instanceof FinanceType
            ? $this->type
            : FinanceType::tryFrom((string) $this->type);
        $source = $this->source instanceof FinanceSource
            ? $this->source
            : FinanceSource::tryFrom((string) $this->source);
        $distributionProjectMode = $this->distribution_project_mode instanceof FinanceDistributionProjectMode
            ? $this->distribution_project_mode
            : FinanceDistributionProjectMode::tryFrom((string) $this->distribution_project_mode);
        $distributionMethodValue = $this->distribution_method ?? $this->article?->distribution_method;
        $distributionMethod = $distributionMethodValue instanceof FinanceArticleDistributionMethod
            ? $distributionMethodValue
            : FinanceArticleDistributionMethod::tryFrom((string) $distributionMethodValue);
        $distributionMethod ??= FinanceArticleDistributionMethod::BY_TERM;

        return [
            'id' => (string) $this->id,
            'company_id' => (string) $this->company_id,
            'type' => $type?->value ?? (string) $this->type,
            'type_label' => $type?->label() ?? (string) $this->type,
            'source' => $source?->value ?? (string) $this->source,
            'amount' => $this->amount,
            'comment' => $this->comment,
            'dateOfPayment' => $this->dateOfPayment?->toDateString(),
            'distribution_from' => $this->distribution_from?->toDateString()
                ?? $this->dateOfPayment?->toDateString(),
            'distribution_to' => $this->distribution_to?->toDateString()
                ?? $this->dateOfPayment?->toDateString(),
            'distribution_method' => $distributionMethod->value,
            'distribution_method_label' => $distributionMethod->label(),
            'distribution_project_mode' => $distributionProjectMode?->value,
            'distribution_project_mode_label' => $distributionProjectMode?->label(),
            'distribution_project_ids' => array_values(array_map(
                'strval',
                $this->distribution_project_ids ?? [],
            )),
            'project' => $this->project ? [
                'id' => (string) $this->project->id,
                'name' => $this->project->name,
                'client' => $this->project->client ? [
                    'id' => (string) $this->project->client->id,
                    'name' => $this->project->client->name,
                ] : null,
            ] : null,
            'article' => $this->article ? FinanceArticleResource::make($this->article)->resolve($request) : null,
            'employee' => $this->employee ? [
                'id' => (string) $this->employee->id,
                'name' => $this->employee->name,
                'last_name' => $this->employee->last_name,
                'email' => $this->employee->email,
            ] : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
