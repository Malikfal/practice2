<?php

namespace App\Services\Workspace;

use App\Enums\ProjectStatus;
use App\Enums\UserPermission;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\TaskAttachment;
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
use Illuminate\Validation\ValidationException;

class TaskAttachmentService
{
    public function __construct(
        private readonly ProjectRepository $projects,
        private readonly TaskActivityService $taskActivityService,
        private readonly TaskNotificationService $notifications,
    ) {}


    public function list(User $user, Task $task): Collection
    {
        $this->assertTaskAccess($user, $task);

        return TaskAttachment::query()
            ->with(['uploader'])
            ->where('task_id', $task->id)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function upload(User $user, Task $task, UploadedFile $file): TaskAttachment
    {
        $this->assertTaskAccess($user, $task);

        $task->loadMissing('project');
        $project = $task->project;

        if (! $project instanceof Project) {
            throw new NotFoundHttpException('Проект не найден.');
        }

        if ($project->status === ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'project_id' => ['Нельзя редактировать задачи в архивированном проекте.'],
            ]);
        }

        $storedPath = null;

        DB::beginTransaction();

        try {
            $storedPath = $this->storeAttachmentFile($project, $task, $file);
            $originalName = $file->getClientOriginalName();
            
            $attachment = TaskAttachment::create([
                'id' => (string) Str::uuid(),
                'company_id' => $project->company_id,
                'task_id' => $task->id,
                'path' => $storedPath,
                'original_name' => $originalName,
                'mime_type' => $file->getClientMimeType(),
                'size' => (int) ($file->getSize() ?: 0),
                'uploaded_by' => $user->id,
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            if (is_string($storedPath) && $storedPath !== '') {
                Storage::disk('local')->delete($storedPath);
            }

            throw $e;
        }

        // Файл и запись уже сохранены: ошибка истории не должна удалять файл и отвечать 500.
        try {
            $this->taskActivityService->uploadAttachment($task, $originalName);
        } catch (\Throwable $e) {
            report($e);
        }
        $this->notifications->attachmentAdded($task, $attachment, $user);

        return $attachment->load(['uploader']);
    }

    public function openAttachment(User $user, TaskAttachment $attachment): StreamedResponse
    {
        $task = Task::query()->find($attachment->task_id);

        if (! $task) {
            throw new NotFoundHttpException();
        }

        $this->assertTaskAccess($user, $task);

        if (! Storage::disk('local')->exists($attachment->path)) {
            throw new NotFoundHttpException('Файл физически не найден на сервере.');
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

    public function delete(User $user, Task $task, TaskAttachment $attachment): void
    {
        $this->assertTaskCompanyAccess($user, $task);

        if ((string) $attachment->task_id !== (string) $task->id) {
            throw new NotFoundHttpException();
        }

        if (! $this->canDeleteAttachment($user, $attachment)) {
            abort(403, 'Недостаточно прав для удаления вложения.');
        }

        $path = $attachment->path;

        DB::transaction(static function () use ($attachment): void {
            $attachment->delete();
        });

        $this->taskActivityService->deleteAttachment($task, $attachment->original_name);

        Storage::disk('local')->delete($path);
    }


    private function storeAttachmentFile(Project $project, Task $task, UploadedFile $file): string
    {
        $safeName = $this->safeOriginalName($file);
        $fileName = (string) Str::uuid() . '_' . $safeName;

        $directory = 'task_attachments/' . $project->company_id . '/' . $project->id . '/' . $task->id;

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
            $safeBase = str_starts_with($file->getMimeType(), 'image/') ? 'image' : 'file';
        }

        $safeBase = substr($safeBase, 0, 80);

        if ($extension === '') {
            return $safeBase;
        }

        return $safeBase . '.' . substr($extension, 0, 15);
    }


    private function assertTaskAccess(User $user, Task $task): void
    {
        $task->loadMissing('project');
        $project = $task->project;

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
        $task->loadMissing('project');
        $project = $task->project;

        if (! $project || (! $user->isSuperAdmin() && (string) $project->company_id !== (string) $user->company_id)) {
            throw new NotFoundHttpException();
        }
    }

    private function canDeleteAttachment(User $user, TaskAttachment $attachment): bool
    {
        if ($user->can(UserPermission::PROJECTS_TABS_TASKS_ATTACHMENTS_DELETE_ALL->value)) {
            return true;
        }

        return $user->can(UserPermission::PROJECTS_TABS_TASKS_ATTACHMENTS_DELETE_SELF->value)
            && (string) $attachment->uploaded_by === (string) $user->id;
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
