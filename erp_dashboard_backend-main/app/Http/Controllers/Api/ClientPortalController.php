<?php

namespace App\Http\Controllers\Api;

use App\Enums\ProjectStatus;
use App\Enums\TaskPriority;
use App\Enums\UserPermission;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectDocument;
use App\Models\Task;
use App\Models\TaskClientMessageAttachment;
use App\Models\TaskDescriptionImage;
use App\Models\User;
use App\Services\ClientPortal\ClientPortalService;
use App\Services\Notifications\TaskNotificationService;
use App\Services\Workspace\TaskActivityService;
use App\Services\Workspace\TaskClientMessageService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * API клиентского кабинета. Все проверки доступа выполняются здесь и в ClientPortalService.
 */
class ClientPortalController extends Controller
{
    private const ATTACHMENT_RULES = ['file', 'max:20480', 'mimes:jpg,jpeg,png,pdf,doc,docx,odt,xls,xlsx,zip,rar,csv,svg,webp,ico,txt,ppt,pptx,7z,mp4,mp3'];

    public function __construct(
        private readonly ClientPortalService $portal,
        private readonly TaskClientMessageService $messages,
        private readonly TaskActivityService $activity,
        private readonly TaskNotificationService $notifications,
    ) {}

    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'id' => (string) $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'role' => $user->role,
            'company_id' => $user->company_id,
            'client_id' => $user->client_id,
            'permissions' => $user->effectivePermissionNames()->values()->all(),
        ]);
    }

    public function portal(Request $request): JsonResponse
    {
        $user = $request->user();
        $pinnedIds = $user->pinnedProjects()->pluck('projects.id')->map(fn ($id) => (string) $id)->all();
        $projects = $this->portal->projectsQuery($user)
            ->with(['taskStatusColumns:id,project_id,name,color,position,is_final'])
            ->orderBy('name')
            ->get(['id', 'name', 'client_id', 'status']);
        $tasks = $this->portal->visibleTasksQuery($user)
            ->with(['project:id,name', 'statusColumn:id,name,is_final'])
            ->orderBy('position')
            ->get();
        $taskPayloads = $this->portal->taskPayloads($user, $tasks)->groupBy('project_id');

        return response()->json(['data' => $projects->map(fn (Project $project): array => [
            'id' => (string) $project->id,
            'name' => $project->name,
            'is_archived' => $project->status === ProjectStatus::ARCHIVED,
            'pinned' => in_array((string) $project->id, $pinnedIds, true),
            'columns' => $project->taskStatusColumns->sortBy('position')->map(fn ($column): array => [
                'id' => (string) $column->id,
                'name' => $column->name,
                'color' => $column->color,
                'position' => (int) $column->position,
                'is_final' => (bool) $column->is_final,
            ])->values(),
            'tasks' => ($taskPayloads[(string) $project->id] ?? collect())->values(),
        ])]);
    }

    public function pinProject(Request $request, Project $project): JsonResponse
    {
        $user = $request->user();
        $this->portal->assertProjectAccess($user, $project);
        $user->pinnedProjects()->syncWithoutDetaching([$project->id]);

        return response()->json(['id' => $project->id]);
    }

    public function unpinProject(Request $request, Project $project): JsonResponse
    {
        $user = $request->user();
        $user->pinnedProjects()->detach($project->id);

        return response()->json(['id' => $project->id]);
    }

    public function task(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();
        $this->portal->assertTaskAccess($user, $task);
        $task->load(['project:id,name', 'statusColumn:id,name,is_final']);

        return response()->json(['data' => $this->portal->taskPayloads($user, collect([$task]))->first()]);
    }

    public function storeTask(Request $request, Project $project): JsonResponse
    {
        $user = $request->user();
        $this->assertPermission($user, UserPermission::TASKS_CREATE_UPDATE);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['nullable', 'string', Rule::enum(TaskPriority::class)],
            'deadline' => ['nullable', 'date', 'after:now'],
        ]);
        if (($data['priority'] ?? null) !== null) {
            $this->assertPermission($user, UserPermission::CLIENT_PORTAL_TASK_PRIORITY_UPDATE);
        }
        if (($data['deadline'] ?? null) !== null) {
            $this->assertPermission($user, UserPermission::CLIENT_PORTAL_TASK_DEADLINE_SET);
        }

        $task = $this->portal->createTask($user, $project, $data);

        return response()->json(['data' => $this->portal->taskPayloads($user, collect([$task]))->first()], 201);
    }

    public function updateTask(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'priority' => ['sometimes', 'nullable', 'string', Rule::enum(TaskPriority::class)],
            'deadline' => ['sometimes', 'required', 'date', 'after:now'],
        ]);
        if (array_key_exists('priority', $data)) {
            $this->assertPermission($user, UserPermission::CLIENT_PORTAL_TASK_PRIORITY_UPDATE);
        }
        if (array_key_exists('deadline', $data)) {
            $this->assertPermission($user, UserPermission::CLIENT_PORTAL_TASK_DEADLINE_SET);
        }
        abort_if($data === [], 422, 'Нет изменений.');

        $task = $this->portal->updateTask($user, $task, $data);

        return response()->json(['data' => $this->portal->taskPayloads($user, collect([$task]))->first()]);
    }

    public function tasksReport(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->assertPermission($user, UserPermission::REPORTS_TASKS_VIEW);
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'project_id' => ['nullable', 'uuid'],
            'status_column_id' => ['nullable', 'uuid'],
        ]);

        return response()->json(['data' => $this->portal->tasksReport(
            $user,
            CarbonImmutable::parse($data['from'])->startOfDay(),
            CarbonImmutable::parse($data['to'])->endOfDay(),
            $data['project_id'] ?? null,
            $data['status_column_id'] ?? null,
        )]);
    }

    public function documents(Request $request, Project $project): JsonResponse
    {
        $user = $request->user();
        $this->assertPermission($user, UserPermission::PROJECTS_TABS_DOCUMENTS_VIEW);

        return response()->json(['data' => $this->portal->documents($user, $project)->map(
            fn (ProjectDocument $document): array => [
                'id' => (string) $document->id,
                'project_id' => (string) $document->project_id,
                'original_name' => (string) $document->original_name,
                'mime_type' => $document->mime_type,
                'size' => (int) $document->size,
                // Клиенту не отдаём email сотрудника, только имя.
                'author' => $document->uploader ? [
                    'id' => (string) $document->uploader->id,
                    'name' => $document->uploader->name,
                    'last_name' => $document->uploader->last_name,
                ] : null,
                'download_url' => '/client/documents/'.$document->id,
                'created_at' => $document->created_at?->toISOString(),
                'updated_at' => $document->updated_at?->toISOString(),
            ],
        )->values()]);
    }

    public function document(Request $request, ProjectDocument $document): StreamedResponse
    {
        $user = $request->user();
        $this->assertPermission($user, UserPermission::PROJECTS_TABS_DOCUMENTS_VIEW);
        $this->portal->assertDocumentAccess($user, $document);
        abort_unless(Storage::disk($document->disk)->exists($document->path), 404);

        return Storage::disk($document->disk)->response($document->path, $document->original_name, [
            'Content-Type' => $document->mime_type ?: 'application/octet-stream',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function messages(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();
        $this->assertPermission($user, UserPermission::PROJECTS_TABS_TASKS_CLIENT_COMMENTS_VIEW);
        $this->portal->assertTaskAccess($user, $task);
        $messages = $task->clientMessages()->with('attachments')->orderBy('created_at')->get()->map(fn ($message) => [
            'id' => $message->id,
            'text' => $message->text,
            'is_from_client' => (bool) $message->is_from_client,
            'created_at' => $message->created_at,
            'attachments' => $message->attachments->map(fn ($attachment) => [
                'id' => $attachment->id,
                'name' => $attachment->original_name,
                'url' => route('api.client.task-message-attachment', [$task->id, $attachment->id]),
            ]),
        ]);

        return response()->json(['data' => $messages, 'client_approval_status' => $task->client_approval_status]);
    }

    public function storeMessage(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();
        $this->assertPermission($user, UserPermission::PROJECTS_TABS_TASKS_CLIENT_REPLY);
        $this->portal->assertTaskAccess($user, $task);
        $this->portal->assertProjectWritable($task->project);
        $data = $request->validate([
            'text' => ['required_without:files', 'nullable', 'string'],
            'files' => ['nullable', 'array'],
            'files.*' => self::ATTACHMENT_RULES,
        ]);
        $files = $request->file('files', []);
        if ($files !== []) {
            $this->assertPermission($user, UserPermission::CLIENT_PORTAL_ATTACHMENTS_UPLOAD);
        }
        $message = $this->messages->create($task, ['text' => $data['text'] ?? null], $user, $files);

        return response()->json(['data' => $message], 201);
    }

    public function approve(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();
        $this->assertPermission($user, UserPermission::PROJECTS_TABS_TASKS_CLIENT_STATUS_UPDATE);
        $this->portal->assertTaskAccess($user, $task);
        $this->portal->assertProjectWritable($task->project);
        // Согласование необратимо: клиент только переводит «Ожидает согласования» в «Согласовано».
        $status = $request->validate(['status' => ['required', 'in:approved']])['status'];
        // Условное обновление: при двойном клике второй запрос получит 409, а не вторую запись истории.
        $updated = Task::query()
            ->whereKey($task->id)
            ->where('client_approval_status', 'pending')
            ->update(['client_approval_status' => $status]);
        abort_if($updated === 0, 409, 'Согласование не запрошено или уже получено.');
        $task->refresh();
        try {
            $this->activity->clientApprovalStatusUpdated($task, $status);
        } catch (\Throwable $e) {
            report($e);
        }
        $this->notifications->clientApproved($task, $user);

        return response()->json(['client_approval_status' => $status]);
    }

    public function messageAttachment(Request $request, Task $task, TaskClientMessageAttachment $attachment): StreamedResponse
    {
        $this->assertPermission($request->user(), UserPermission::PROJECTS_TABS_TASKS_CLIENT_COMMENTS_VIEW);
        $this->portal->assertTaskAccess($request->user(), $task);
        abort_unless((string) $attachment->task_id === (string) $task->id, 404);

        return $this->messages->openAttachment($attachment);
    }

    public function descriptionImage(Request $request, Task $task, TaskDescriptionImage $image): StreamedResponse
    {
        $this->assertPermission($request->user(), UserPermission::CLIENT_PORTAL_TASK_DESCRIPTION_VIEW);
        $this->portal->assertTaskAccess($request->user(), $task);
        abort_unless((string) $image->task_id === (string) $task->id, 404);
        abort_unless(Storage::disk($image->disk)->exists($image->path), 404);

        return Storage::disk($image->disk)->response($image->path, $image->original_name, [
            'Content-Type' => $image->mime_type ?: 'application/octet-stream',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate(['current_password' => ['required', 'string'], 'password' => ['required', 'string', 'min:8', 'confirmed']]);
        if (! Hash::check($data['current_password'], $user->password_hash)) {
            throw ValidationException::withMessages(['current_password' => ['Текущий пароль указан неверно.']]);
        }
        $user->update(['password_hash' => Hash::make($data['password'])]);

        return response()->json(['message' => 'Пароль обновлен.']);
    }

    private function assertPermission(User $user, UserPermission $permission): void
    {
        abort_unless($user->effectivePermissionNames()->contains($permission->value), 403, 'Недостаточно прав.');
    }
}
