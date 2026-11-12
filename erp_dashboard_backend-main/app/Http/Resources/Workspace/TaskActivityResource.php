<?php

namespace App\Http\Resources\Workspace;

use App\Models\TaskStatusColumn;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;


/**
 * @mixin \Spatie\Activitylog\Models\Activity
 */
class TaskActivityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $changes = collect($this->attribute_changes)->toArray();

        if (isset($changes['attributes']['task_status_column_id'])) {
            $changes['attributes']['task_status_column_name'] = TaskStatusColumn::find(
                $changes['attributes']['task_status_column_id']
                )?->name;

            unset($changes['attributes']['task_status_column_id']);
        }

        if (isset($changes['old']['task_status_column_id'])) {
            $changes['old']['task_status_column_name'] = TaskStatusColumn::find(
                $changes['old']['task_status_column_id']
                )?->name;

            unset($changes['old']['task_status_column_id']);
        }

        return [
            'id' => $this->id,
            'event' => $this->event,
            'description' => $this->description,
            'user' => $this->causer ? [
                'id' => (string) $this->causer_id,     
                'name' => trim($this->causer->name . ' ' . $this->causer->last_name),
            ] : null,
            'changes' => $changes, 
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}