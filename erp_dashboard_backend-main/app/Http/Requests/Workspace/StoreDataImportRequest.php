<?php

namespace App\Http\Requests\Workspace;

use App\Enums\DataImportType;
use App\Support\DataImportAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDataImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        $type = DataImportType::tryFrom((string) $this->input('type'));

        return $type !== null && DataImportAccess::can($this->user(), $type);
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::enum(DataImportType::class)],
            'file' => [
                'required',
                'file',
                'max:'.config('imports.max_file_size_kb', 20480),
                'extensions:csv,xls,xlsx',
            ],
        ];
    }
}
