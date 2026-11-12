<?php

namespace App\Http\Resources\Workspace;

use App\Enums\UserPermission;
use App\Models\TaskStatusColumn;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TaskStatusColumn
 */
final class TaskStatusColumnResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'project_id' => (string) $this->project_id,
            'name' => $this->name,
            'label' => $this->name,
            'slug' => $this->slug,
            'color' => $this->color,
            'position' => (int) $this->position,
            'order' => (int) $this->position,
            'is_default' => (bool) $this->is_default,
            'is_final' => (bool) $this->is_final,

            $this->mergeWhen($request->user()?->can(UserPermission::TASKS_STATUS_CREATE_UPDATE->value) ?? false, [
                'created_at' => $this->created_at?->toISOString(),
                'updated_at' => $this->updated_at?->toISOString(),
            ]),
        ];
    }
}
