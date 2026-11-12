<?php

namespace App\Services\Workspace;

use App\Enums\UserPermission;
use App\Models\Task;
use App\Models\User;
use App\Models\TaskComment;
use App\Models\TaskCommentAttachment;
use App\Repositories\Workspace\ProjectRepository;
use App\Services\Notifications\TaskNotificationService;
use App\Support\TaskVisibility;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class TaskCommentService
{
    public function __construct(
        private readonly ProjectRepository $projects,
        private readonly TaskActivityService $activity,
        private readonly TaskNotificationService $notifications,
    ) {
    }

    public function list(User $user, Task $task): Collection
    {
        $this->assertTaskAccess($user, $task);

        return TaskComment::query()
            ->with(['author', 'attachments'])
            ->where('task_id', $task->id)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function create(User $user, Task $task, array $data, array $files = []): TaskComment
    {
        $this->assertTaskAccess($user, $task);

        $storedPaths = [];

        DB::beginTransaction();

        try {
            $comment = TaskComment::create([
                'id' => (string) Str::uuid(),
                'task_id' => $task->id,
                'author_id' => $user->id,
                'text' => $data['text'] ?? null,
            ]);

            foreach ($files as $file) {
                if (! $file instanceof UploadedFile) {
                    continue;
                }

                $storedPath = $this->storeAttachment($task, $file);
                $storedPaths[] = $storedPath;

                TaskCommentAttachment::create([
                    'id' => (string) Str::uuid(),
                    'comment_id' => $comment->id,
                    'project_id' => $task->project_id,
                    'task_id' => $task->id,
                    'path' => $storedPath,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getClientMimeType(),
                    'uploaded_by' => $user->id,
                ]);
            }

            DB::commit();

            if (! $task->is_draft) {
                try {
                    $this->activity->comment(
                        $task,
                        (string) ($data['text'] ?? ''),
                        count($storedPaths),
                    );
                } catch (\Throwable $e) {
                    report($e);
                }
            }

            $comment->load(['author', 'attachments']);
            $this->notifications->commentAdded($task, $comment, $user);

            return $comment;
        } catch (\Throwable $e) {
            DB::rollBack();

            foreach ($storedPaths as $path) {
                Storage::disk('local')->delete($path);
            }

            throw $e;
        }
    }

    public function openAttachment(User $user, TaskCommentAttachment $attachment): StreamedResponse
    {
        $task = Task::query()->find($attachment->task_id);

        if (! $task) {
            throw new NotFoundHttpException();
        }

        $this->assertTaskAccess($user, $task);

        if (! Storage::disk('local')->exists($attachment->path)) {
            throw new NotFoundHttpException();
        }

        return Storage::disk('local')->response(
            $attachment->path,
            $attachment->original_name,
            [
                'Content-Type' => $attachment->mime_type ?: 'application/octet-stream',
                'Cache-Control' => 'private, max-age=3600',
            ]
        );
    }

    public function delete(User $user, Task $task, TaskComment $comment): void
    {
        $this->assertTaskCompanyAccess($user, $task);

        if ((string) $comment->task_id !== (string) $task->id) {
            throw new NotFoundHttpException();
        }

        if (! $this->canDeleteComment($user, $comment)) {
            abort(403, 'Недостаточно прав для удаления комментария.');
        }

        $comment->loadMissing('attachments');

        $attachmentPaths = $comment->attachments
            ->pluck('path')
            ->filter()
            ->values()
            ->all();

        DB::transaction(static function () use ($comment): void {
            $comment->delete();
        });

        foreach ($attachmentPaths as $path) {
            Storage::disk('local')->delete($path);
        }
    }

    private function storeAttachment(Task $task, UploadedFile $file): string
    {
        $safeName = $this->safeOriginalName($file);
        $fileName = (string) Str::uuid().'_'.$safeName;
        $directory = 'tasks/'.$task->project_id.'/'.$task->id;

        $storedPath = Storage::disk('local')->putFileAs($directory, $file, $fileName);

        if (! is_string($storedPath) || $storedPath === '') {
            throw new \RuntimeException('Не удалось сохранить файл вложения.');
        }

        return $storedPath;
    }

    private function safeOriginalName(UploadedFile $file): string
    {
        $original = $file->getClientOriginalName();
        $name = pathinfo($original, PATHINFO_FILENAME);
        $extension = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));

        $safeBase = Str::slug($name);
        if ($safeBase === '') {
            $safeBase = 'file';
        }

        $safeBase = substr($safeBase, 0, 80);

        if ($extension === '') {
            return $safeBase;
        }

        return $safeBase.'.'.substr($extension, 0, 15);
    }

    private function assertTaskAccess(User $user, Task $task): void
    {
        $project = $task->project()->first();

        if (! $project || (! $user->isSuperAdmin() && (string) $project->company_id !== (string) $user->company_id)) {
            throw new NotFoundHttpException();
        }

        if ($user->can(UserPermission::TASKS_VIEW_ALL->value)) {
            return;
        }

        if (
            $user->can(UserPermission::TASKS_VIEW_PROJECT_ASSIGNED->value)
            && $this->projects->userHasAccessToProject($user, $project)
        ) {
            return;
        }

        if (
            $user->can(UserPermission::TASKS_VIEW_ASSIGNED->value)
            && $this->isTaskVisibleByAssignedTree($task, $user)
        ) {
            return;
        }

        throw new NotFoundHttpException();
    }

    private function assertTaskCompanyAccess(User $user, Task $task): void
    {
        $project = $task->project()->first();

        if (! $project || (! $user->isSuperAdmin() && (string) $project->company_id !== (string) $user->company_id)) {
            throw new NotFoundHttpException();
        }
    }

    private function canDeleteComment(User $user, TaskComment $comment): bool
    {
        if ($user->can(UserPermission::PROJECTS_TABS_TASKS_COMMENTS_DELETE_ALL->value)) {
            return true;
        }

        return $user->can(UserPermission::PROJECTS_TABS_TASKS_COMMENTS_DELETE_SELF->value)
            && (string) $comment->author_id === (string) $user->id;
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
