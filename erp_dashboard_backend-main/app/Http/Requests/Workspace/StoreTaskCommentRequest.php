<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Validator;

class StoreTaskCommentRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return [PermissionAction::CREATE_UPDATE, PermissionAction::VIEW_ALL, PermissionAction::VIEW_PROJECT_ASSIGNED, PermissionAction::VIEW_ASSIGNED];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::TASKS;
    }

    public function rules(): array
    {
        return [
            'text' => ['nullable', 'string'],
            'files' => ['nullable', 'array', 'max:10'],
            'files.*' => ['file', 'max:20480'], // 20 MB каждый
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $text = trim((string) $this->input('text', ''));
            $hasFiles = $this->hasFile('files');

            if ($text === '' && ! $hasFiles) {
                $validator->errors()->add(
                    'text',
                    'Комментарий должен содержать текст или хотя бы один файл.'
                );
            }
        });
    }
}
