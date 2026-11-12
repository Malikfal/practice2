<?php

namespace App\Services\Workspace;

use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Task;
use App\Models\TaskClientMessage;
use App\Models\TaskClientMessageAttachment;
use App\Models\TaskPublicLink;
use App\Models\User;
use App\Services\Notifications\TaskNotificationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class TaskClientMessageService
{
    public function __construct(
        private readonly TaskActivityService $taskActivityService,
        private readonly TaskNotificationService $notifications,
    ) {}

    public function create(Task $task, array $data, ?User $user = null, array $files = []): TaskClientMessage
    {
        // Черновик с названием клиент видит как обычную задачу и может в нём переписываться.
        if ($task->is_draft && trim((string) $task->title) === '') {
            throw ValidationException::withMessages([
                'task_id' => ['Нельзя отправлять сообщения, пока задача находится в черновиках'],
            ]);
        }

        $task->loadMissing('statusColumn');
        if ($task->statusColumn?->is_final) {
            throw ValidationException::withMessages([
                'task_id' => ['Нельзя отправлять сообщения в завершенную задачу'],
            ]);
        }

        $storedPaths = [];
        $isFromClient = $user === null || $user->role === UserRole::CLIENT->value;

        DB::beginTransaction();

        try {
            $message = TaskClientMessage::create([
                'task_id' => $task->id,
                'author_id' => $user?->id,
                'text' => $data['text'] ?? null,
                'is_from_client' => $isFromClient,
            ]);

            foreach ($files as $file) {
                if (! $file instanceof UploadedFile) {
                    continue;
                }

                $storedPath = $this->storeAttachment($task, $file);
                $storedPaths[] = $storedPath;

                TaskClientMessageAttachment::create([
                    'message_id' => $message->id,
                    'task_id' => $task->id,
                    'path' => $storedPath,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getClientMimeType(),
                    'uploaded_by' => $user?->id,
                ]);
            }

            DB::commit();

            if (! $task->is_draft) {
                try {
                    $this->taskActivityService->clientMessage($task, $data['text'] ?? '', count($files), $isFromClient);
                } catch (\Throwable $e) {
                    report($e);
                }
            }

            // Уведомления о переписке приходят и по черновику с названием: клиент видит его как обычную задачу.
            $message->load(['author', 'attachments']);
            $this->notifications->clientMessageAdded($task, $message, $user);

            return $message;
        } catch (\Throwable $e) {
            DB::rollBack();

            foreach ($storedPaths as $path) {
                Storage::disk('local')->delete($path);
            }

            throw $e;
        }
    }

    public function generatePublicLink(Task $task, User $user): TaskPublicLink
    {
        if ($task->is_draft) {
            throw ValidationException::withMessages([
                'task_id' => ['Нельзя сгенерировать ссылку для черновика.'],
            ]);
        }

        $task->loadMissing('statusColumn');
        if ($task->statusColumn?->is_final) {
            throw ValidationException::withMessages([
                'task_id' => ['Нельзя сгенерировать ссылку для завершенной задачи.'],
            ]);
        }

        if (! $task->is_client_visible) {
            throw ValidationException::withMessages([
                'task_id' => ['Нельзя сгенерировать ссылку для задачи, скрытой от клиента.'],
            ]);
        }

        $task->loadMissing('project');
        if ($task->project?->status === ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'task_id' => ['Нельзя сгенерировать ссылку для задачи архивного проекта.'],
            ]);
        }

        $task->publicLinks()->delete();

        $link = TaskPublicLink::create([
            'task_id' => $task->id,
            'created_by' => $user->id,
        ]);

        $this->taskActivityService->publicLinkCreated($task);

        return $link;
    }

    public function disablePublicLink(Task $task): void
    {
        $task->publicLinks()->delete();
        $this->taskActivityService->publicLinkDeleted($task);
    }

    public function openAttachment(TaskClientMessageAttachment $attachment): StreamedResponse
    {
        if (! Storage::disk('local')->exists($attachment->path)) {
            throw new NotFoundHttpException;
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

    private function storeAttachment(Task $task, UploadedFile $file): string
    {
        $safeName = $this->safeOriginalName($file);
        $fileName = (string) Str::uuid().'_'.$safeName;

        $directory = 'task-client-messages/'.$task->project_id.'/'.$task->id;

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
        $safeBase = Str::slug($name) ?: 'file';
        $safeBase = substr($safeBase, 0, 80);

        if ($extension === '') {
            return $safeBase;
        }

        return $safeBase.'.'.substr($extension, 0, 15);
    }
}
