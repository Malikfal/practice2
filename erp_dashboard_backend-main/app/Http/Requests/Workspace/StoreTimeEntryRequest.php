<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTimeEntryRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $title = $this->input('new_task_title');

        if (! is_string($title) || trim($title) === '') {
            $title = $this->input('task_title', $this->input('title'));
        }

        if (is_string($title)) {
            $this->merge([
                'new_task_title' => trim($title),
            ]);
        }
    }

    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user) {
            return false;
        }

        $targetUserId = (string) $this->input('user_id', '');

        if ($targetUserId === '' || $targetUserId === (string) $user->id) {
            return true;
        }

        return $user->can(PermissionSection::TIME->value.'.'.PermissionAction::ADD_FOR_OTHERS->value)
            || $user->can(PermissionSection::TIME->value.'.'.PermissionAction::ADD_FOR_PROJECT_USERS->value)
            || $user->can(PermissionSection::TIME->value.'.'.PermissionAction::ADD_FOR_ALL->value);
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');
        $projectExists = Rule::exists('projects', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));
        $userExists = Rule::exists('users', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));
        $taskExists = Rule::exists('tasks', 'id')
            ->where(fn ($query) => $query->where('is_draft', false))
            ->when($companyId !== '', fn ($rule) => $rule->whereIn('project_id', function ($query) use ($companyId): void {
                $query->select('id')
                    ->from('projects')
                    ->where('company_id', $companyId);
            }));

        return [
            'user_id' => ['required', $userExists],
            'project_id' => ['required', $projectExists],
            'started_at' => ['required', 'integer', 'min:0'],
            'ended_at' => ['required', 'integer', 'min:0'],
            'note' => ['nullable', 'string', 'max:2000'],
            'task_id' => ['nullable', $taskExists],
            'new_task_title' => ['nullable', 'string', 'max:255', 'required_without:task_id'],
        ];
    }
}
