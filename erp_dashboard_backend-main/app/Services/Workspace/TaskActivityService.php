<?php

namespace App\Services\Workspace;

use App\Enums\UserPermission;
use App\Models\User;
use App\Models\Task;
use App\Repositories\Workspace\ProjectRepository;
use App\Support\TaskVisibility;
use Illuminate\Support\Collection;
use Spatie\Activitylog\Models\Activity;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class TaskActivityService
{
    private const TRACKED_FIELDS = [
        'title',
        'description',
        'task_status_column_id',
        'priority',
        'estimation',
        'deadline',
        'start_at',
    ];

    private const UPDATE_FIELDS = [
        'title', 
        'description', 
        'priority', 
        'estimation',
        'deadline',
        'start_at',
    ];

    public function __construct(
        private readonly ProjectRepository $projects,
    ) {
    }

    public function list(User $user, Task $task): Collection 
    {
        $this->assertTaskAccess($user, $task);

        return Activity::forSubject($task)
            ->with('causer:id,name,last_name')
            ->latest()
            ->get();
    }

    public function create(Task $task, array $assigneeIds): void
    {
        $attributes = $task->only(self::TRACKED_FIELDS);

        if (!empty($assigneeIds)) {
            $attributes['assignees'] = $task->refresh()->assignees->pluck('name')->all();
        }

        activity('task')
            ->performedOn($task)
            ->event('created')
            ->tap(function ($activity) use ($attributes) {
                $activity->attribute_changes = ['attributes' => $attributes];
            })
            ->log('Задача создана');
    }


    public function update(Task $oldTask, Task $updatedTask, array $oldAssigneeNames): void
    {
        $changes = [];
        $oldChanges = [];

        foreach (self::UPDATE_FIELDS as $field) {
            if ($oldTask->{$field} != $updatedTask->{$field}) {
                $changes[$field] = $updatedTask->{$field};
                $oldChanges[$field] = $oldTask->{$field};
            }
        }

        $oldAssigneeIds = $oldTask->assignees->pluck('id')->map(fn($id) => (string) $id)->all();

        $updatedTask->load('assignees');
        $newAssigneeIds = $updatedTask->assignees->pluck('id')->map(fn($id) => (string) $id)->all();
        $newAssigneeNames = $updatedTask->assignees->map(function ($user) {
            return trim($user->name . ' ' . $user->last_name);
        })->all();

        sort($oldAssigneeIds);
        sort($newAssigneeIds);

        if ($oldAssigneeIds !== $newAssigneeIds) {
            $changes['assignees'] = $newAssigneeNames;
            $oldChanges['assignees'] = $oldAssigneeNames;
        }

        if (!empty($changes)) {
            activity('task')
                ->performedOn($updatedTask)
                ->event('updated')
                ->tap(function ($activity) use ($changes, $oldChanges) {
                    $activity->attribute_changes = [
                        'attributes' => $changes,
                        'old' => $oldChanges,
                    ];
                })
                ->log('Задача обновлена');
        }
    }
    public function comment(Task $task, string $text = '', int $attachmentsCount = 0): void
    {
        activity('task')
            ->performedOn($task)
            ->event('comment_added')
            ->tap(function ($activity) use ($text, $attachmentsCount) {
                $activity->attribute_changes = [
                    'attributes' => [
                        'comment' => $text,
                        'attachments_count' => $attachmentsCount,
                    ],
                ];
            })
            ->log('Добавлен комментарий');
    }

    public function move(Task $task, ?string $oldColumnId): void
    {
        if ((string) $task->task_status_column_id !== (string) $oldColumnId) {
            activity('task')
                ->performedOn($task)
                ->event('status_updated')
                ->tap(function ($activity) use ($task, $oldColumnId) {
                    $activity->attribute_changes = [
                        'attributes' => ['task_status_column_id' => $task->task_status_column_id],
                        'old' => ['task_status_column_id' => $oldColumnId],
                    ];
                })
                ->log('Изменен статус задачи');
        }
    }

    public function uploadAttachment(Task $task, string $originalName): void 
    {
        activity('task')
            ->performedOn($task)
            ->event('attachment_upload')
            ->tap(function ($activity) use ($originalName) {
                $activity->attribute_changes = [
                    'attributes' => ['original_name' => $originalName],
                ];
            })
            ->log('Добавлено вложение');
    }

    public function deleteAttachment(Task $task, string $originalName): void
    {
        activity('task')
            ->performedOn($task)
            ->event('attachment_delete')
            ->tap(function ($activity) use ($originalName) {
                $activity->attribute_changes = [
                    'attributes' => ['original_name' => $originalName],
                ];
            })
            ->log('Вложение удалено');
    } 

    public function clientMessage(Task $task, string $text = '', int $attachmentsCount = 0, bool $isFromClient = false): void
    {
        activity('task')
            ->performedOn($task)
            ->event('client_message_added')
            ->tap(function ($activity) use ($text, $attachmentsCount, $isFromClient) {
                $activity->attribute_changes = [
                    'attributes' => [
                        'comment' => $text,
                        'attachments_count' => $attachmentsCount,
                        'is_from_client' => $isFromClient,
                    ],
                ];
            })
            ->log($isFromClient ? 'Клиент оставил сообщение' : 'Сотрудник ответил клиенту');
    }

    public function clientApprovalStatusUpdated(Task $task, ?string $newStatus): void
    {
        activity('task')
            ->performedOn($task)
            ->event('client_status_updated')
            ->tap(function ($activity) use ($newStatus) {
                $activity->attribute_changes = [
                    'attributes' => ['client_approval_status' => $newStatus],
                ];
            })
            ->log('Изменен статус согласования клиентом');
    }

    public function publicLinkCreated(Task $task): void
    {
        activity('task')
            ->performedOn($task)
            ->event('public_link_created')
            ->log('Создана публичная ссылка для клиента');
    }

    public function publicLinkDeleted(Task $task): void
    {
        activity('task')
            ->performedOn($task)
            ->event('public_link_deleted')
            ->log('Отключена публичная ссылка для клиента');
    }

    private function assertTaskAccess(User $user, Task $task): void 
    {
        $task->loadMissing('project');
        $project = $task->project;

        if (! $project || (! $user->isSuperAdmin() 
            && (string) $project->company_id  !== (string) $user->company_id)) {
            throw new NotFoundHttpException();
        }

        if ($user->can(UserPermission::TASKS_VIEW_ALL->value)) {
            return;
        }

        if ($user->can(UserPermission::TASKS_VIEW_PROJECT_ASSIGNED->value)
            && $this->projects->userHasAccessToProject($user, $project)) 
        {
            return;
        }

        if ($user->can(UserPermission::TASKS_VIEW_ASSIGNED->value)
            && $this->isTaskVisibleByAssignedTree($task, $user)) 
        {
            return;
        }

        throw new NotFoundHttpException();
    }

    private function isTaskVisibleByAssignedTree(Task $task, User $user): bool
    {
        return TaskVisibility::isVisibleByAssignedTree(
            $task,
            (string) $task->project_id,
            (string) $user->id,
        );
    }
}
