<?php

namespace App\Http\Controllers\Api;

use App\Enums\ProjectStatus;
use App\Enums\TariffFeature;
use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\TaskClientMessageAttachment;
use App\Models\TaskDescriptionImage;
use App\Models\TaskPublicLink;
use App\Services\Notifications\TaskNotificationService;
use App\Services\Workspace\TaskActivityService;
use App\Services\Workspace\TaskClientMessageService;
use App\Http\Resources\PublicTaskResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PublicTaskController extends Controller
{
    public function __construct(
        private readonly TaskActivityService $taskActivityService,
        private readonly TaskClientMessageService $service,
        private readonly TaskNotificationService $notifications,
    ) {}

    public function show(string $token): PublicTaskResource
    {
        $link = $this->link($token);
        $link->task->load([
            'project',
            'clientMessages.author',
            'clientMessages.attachments',
            'attachments',
        ]);

        return new PublicTaskResource($link);
    }

    public function taskAttachment(string $token, TaskAttachment $attachment): StreamedResponse
    {
        $link = $this->link($token);
        
        if ((string)$attachment->task_id !== (string)$link->task_id) {
            abort(403);
        }
        if (! Storage::disk('local')->exists($attachment->path)) {
            abort(404, 'Файл не найден');
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
    
    public function descriptionImage(string $token, TaskDescriptionImage $image): StreamedResponse 
    {
        $link = $this->link($token);

        if ((string)$image->task_id !== (string)$link->task_id) {
            abort(403);
        }

        if (!Storage::disk($image->disk)->exists($image->path)) {
            abort(404, 'Файл не найден');
        }

        return Storage::disk($image->disk)->response(
            $image->path,
            $image->original_name,
            [
                'Content-Type' => $image->mime_type ?: 'application/octet-stream',
                'Cache-Control' => 'private, max-age=3600',
            ]
        );
    }

    public function approve(string $token): JsonResponse
    {
        $link = $this->link($token);
        $this->assertWritable($link);
        // Согласование необратимо и возможно только после запроса. Условное обновление защищает от двойного клика.
        $updated = Task::query()
            ->whereKey($link->task_id)
            ->where('client_approval_status', 'pending')
            ->update(['client_approval_status' => 'approved']);
        abort_if($updated === 0, 409, 'Согласование не запрошено или уже получено.');
        $link->task->refresh();
        try {
            $this->taskActivityService->clientApprovalStatusUpdated($link->task, 'approved');
        } catch (\Throwable $e) {
            report($e);
        }
        $this->notifications->clientApproved($link->task, null, viaPublicLink: true);

        return response()->json(['message' => 'Approved']);
    }

    public function storeMessage(Request $request, string $token): JsonResponse
    {
        $request->validate([
            'text' => 'required_without:files|nullable|string',
            'files' => 'nullable|array',
            'files.*' => 'file|max:20480|mimes:jpg,jpeg,png,pdf,doc,docx,odt,xls,xlsx,zip,rar,csv,svg,webp,ico,txt,ppt,pptx,7z,mp4,mp3',
        ]);
        
        $link = $this->link($token);
        $this->assertWritable($link);

        $message = $this->service->create(
            $link->task,
            ['text' => $request->text],
            null,
            $request->file('files', [])
        );
        return response()->json(['data' => $message]);
    }
    public function attachment(string $token, TaskClientMessageAttachment $attachment): StreamedResponse
    {
        $link = $this->link($token);
        
        if ((string)$attachment->task_id !== (string)$link->task_id) {
            abort(403);
        }
        return $this->service->openAttachment($attachment);
    }

    /**
     * Ссылка на задачу, которую клиенту можно показывать. Скрытая от клиента задача по ссылке не открывается.
     */
    private function link(string $token): TaskPublicLink
    {
        $link = TaskPublicLink::with('task.project')->findOrFail($token);
        abort_unless($link->task?->is_client_visible, 404);

        // На ФРИ клиентский доступ закрыт, ссылки, выданные на ПРО, перестают открываться.
        $company = Company::with('tariff')->find($link->task->project?->company_id);
        abort_if($company && ! $company->hasTariffFeature(TariffFeature::CLIENT_ACCESS), 403, 'Ссылка временно недоступна.');

        return $link;
    }

    /**
     * Задачу архивного проекта по ссылке можно только просматривать.
     */
    private function assertWritable(TaskPublicLink $link): void
    {
        abort_if($link->task->project?->status === ProjectStatus::ARCHIVED, 409, 'Проект в архиве, изменения недоступны.');
    }
}
