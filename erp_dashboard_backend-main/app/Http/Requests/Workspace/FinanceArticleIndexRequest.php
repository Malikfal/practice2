<?php

namespace App\Http\Requests\Workspace;

use App\Enums\FinanceType;
use Illuminate\Validation\Rule;

class FinanceArticleIndexRequest extends FinanceViewRequest
{
    public function rules(): array
    {
        return [
            'type' => ['nullable', Rule::enum(FinanceType::class)],
        ];
    }
}
