<?php

namespace App\Http\Resources\Workspace;

use App\Models\Task;
use App\Models\TaskPublicLink;
use App\Services\Workspace\TaskViewService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Task
 */
class TaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $statusColumn = $this->statusColumn;
        $rawSpentByUsers = $this->spent_by_users ?? [];
        $assignees = collect($this->assignees ?? [])->map(
            static fn (object $assignee): array => [
                'id' => (string) $assignee->id,
                'first_name' => $assignee->name,
                'last_name' => $assignee->last_name,
                'name' => $assignee->name,
                'email' => $assignee->email,
            ]
        )->values();
        $spentByUsers = is_string($rawSpentByUsers)
            ? collect(json_decode($rawSpentByUsers, true) ?: [])
            : collect($rawSpentByUsers);
        $spentByUsers = $spentByUsers
            ->filter(static fn ($item): bool => is_array($item))
            ->map(static fn (array $item): array => [
                'user_id' => (string) ($item['user_id'] ?? ''),
                'name' => isset($item['name']) ? (string) $item['name'] : '',
                'last_name' => isset($item['last_name']) ? (string) $item['last_name'] : '',
                'spent_seconds' => max(0, (int) ($item['spent_seconds'] ?? 0)),
            ])
            ->filter(static fn (array $item): bool => $item['user_id'] !== '')
            ->values();
        $creator = $this->creator;
        $subtasks = collect($this->subtasks ?? [])
            ->map(fn (Task $subtask): array => $this->mapSubtask($subtask))
            ->values();

        return [
            'id' => (string) $this->id,
            'number' => $this->number,
            'title' => (string) $this->title,
            'project_id' => (string) $this->project_id,
            'project_name' => $this->project ? (string) $this->project->name : null,
            'parent_task_id' => $this->parent_task_id ? (string) $this->parent_task_id : null,
            'created_by_id' => $this->created_by_id ? (string) $this->created_by_id : null,
            'is_draft' => (bool) $this->is_draft,
            'is_client_visible' => (bool) $this->is_client_visible,
            'client_approval_status' => $this->client_approval_status,
            'published_at' => $this->published_at,
            // Запрос доски отдаёт ссылку сразу, отдельный запрос нужен только для остальных выборок.
            'client_public_link' => array_key_exists('client_public_link', $this->resource->getAttributes())
                ? $this->resource->getAttributes()['client_public_link']
                : TaskPublicLink::where('task_id', $this->id)->value('id'),
            'creator' => $creator ? [
                'id' => (string) $creator->id,
                'first_name' => $creator->name,
                'last_name' => $creator->last_name,
                'name' => $creator->name,
                'email' => $creator->email,
            ] : null,
            'description' => $this->description !== null ? (string) $this->description : null,
            'status_column_id' => $this->task_status_column_id ? (string) $this->task_status_column_id : null,
            'status_label' => $statusColumn?->name,
            'status_color' => $statusColumn?->color,
            'status_slug' => $statusColumn?->slug,
            'priority' => $this->priority,
            'estimation' => $this->estimation !== null ? (int) $this->estimation : null,
            'deadline' => $this->deadline,
            'start_at' => $this->start_at,
            'last_activity_at' => $this->last_activity_at,
            'has_changes' => TaskViewService::hasChanges($this->resource, $request->user()),
            'position' => (float) ($this->position ?? 0),
            'spent_seconds' => (int) ($this->spent_seconds ?? 0),
            'spent_by_users' => $spentByUsers,
            'remaining_seconds' => $this->remaining_seconds,
            'updated_at' => $this->updated_at,
            'created_at' => $this->created_at,
            'assignee_ids' => $assignees->pluck('id')->values(),
            'assignees' => $assignees,
            'subtasks' => $subtasks,
        ];
    }

    private function mapSubtask(Task $task): array
    {
        $assignees = collect($task->assignees ?? [])->map(
            static fn (object $assignee): array => [
                'id' => (string) $assignee->id,
                'first_name' => $assignee->name,
                'last_name' => $assignee->last_name,
                'name' => $assignee->name,
                'email' => $assignee->email,
            ]
        )->values();

        return [
            'id' => (string) $task->id,
            'number' => $task->number,
            'title' => (string) $task->title,
            'project_id' => (string) $task->project_id,
            'parent_task_id' => $task->parent_task_id ? (string) $task->parent_task_id : null,
            'created_by_id' => $task->created_by_id ? (string) $task->created_by_id : null,
            'is_draft' => (bool) $task->is_draft,
            'is_client_visible' => (bool) $task->is_client_visible,
            'client_approval_status' => $task->client_approval_status,
            'published_at' => $task->published_at,
            'creator' => $task->creator ? [
                'id' => (string) $task->creator->id,
                'first_name' => $task->creator->name,
                'last_name' => $task->creator->last_name,
                'name' => $task->creator->name,
                'email' => $task->creator->email,
            ] : null,
            'description' => $task->description !== null ? (string) $task->description : null,
            'status_column_id' => $task->task_status_column_id ? (string) $task->task_status_column_id : null,
            'status_label' => $task->statusColumn?->name,
            'status_color' => $task->statusColumn?->color,
            'status_slug' => $task->statusColumn?->slug,
            'priority' => $task->priority,
            'estimation' => $task->estimation !== null ? (int) $task->estimation : null,
            'deadline' => $task->deadline,
            'start_at' => $task->start_at,
            'last_activity_at' => $task->last_activity_at,
            'has_changes' => TaskViewService::hasChanges($task, request()->user()),
            'position' => (float) ($task->position ?? 0),
            'spent_seconds' => (int) ($task->spent_seconds ?? 0),
            'remaining_seconds' => $task->remaining_seconds,
            'updated_at' => $task->updated_at,
            'created_at' => $task->created_at,
            'assignee_ids' => $assignees->pluck('id')->values(),
            'assignees' => $assignees,
            'subtasks' => [],
        ];
    }
}
