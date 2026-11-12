<?php

namespace App\Http\Requests\Workspace;

class UpdateProjectActivityHistoryRequest extends ManageProjectActivityHistoryRequest
{
    public function rules(): array
    {
        return [
            'started_on' => ['sometimes', 'date_format:Y-m-d'],
            'ended_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
        ];
    }
}
