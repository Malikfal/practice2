<?php

namespace App\Support;

use App\Enums\UserPermission;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Видит ли сотрудник задачу: те же правила, что при открытии задачи и её комментариев
 * (TaskCommentService::assertTaskAccess). Клиентский доступ проверяет ClientPortalService.
 */
final class TaskAccess
{
    /**
     * @param  array<int, string>|null  $projectMemberIds  Участники проекта, если уже загружены.
     */
    public static function canView(User $user, Task $task, ?array $projectMemberIds = null): bool
    {
        $task->loadMissing('project');
        $project = $task->project;

        if (! $project || (! $user->isSuperAdmin() && (string) $project->company_id !== (string) $user->company_id)) {
            return false;
        }

        if ($user->can(UserPermission::TASKS_VIEW_ALL->value)) {
            return true;
        }

        if ($user->can(UserPermission::TASKS_VIEW_PROJECT_ASSIGNED->value)) {
            $isMember = $projectMemberIds !== null
                ? in_array((string) $user->id, $projectMemberIds, true)
                : DB::table('project_members')->where('project_id', $project->id)->where('user_id', $user->id)->exists();

            if ($isMember) {
                return true;
            }
        }

        return $user->can(UserPermission::TASKS_VIEW_ASSIGNED->value)
            && TaskVisibility::isVisibleByAssignedTree($task, (string) $task->project_id, (string) $user->id);
    }
}
