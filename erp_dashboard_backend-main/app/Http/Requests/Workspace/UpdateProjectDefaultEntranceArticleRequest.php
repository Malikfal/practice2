<?php

namespace App\Http\Requests\Workspace;

use App\Enums\FinanceType;
use Illuminate\Validation\Rule;

class UpdateProjectDefaultEntranceArticleRequest extends StoreProjectRateRequest
{
    public function rules(): array
    {
        $project = $this->route('project');

        return [
            'default_entrance_finance_article_id' => [
                'present',
                'nullable',
                'uuid',
                Rule::exists('finance_article', 'id')
                    ->where('company_id', (string) $project->company_id)
                    ->where('type', FinanceType::ENTRANCE->value),
            ],
        ];
    }
}
