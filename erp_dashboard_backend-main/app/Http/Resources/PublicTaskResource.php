<?php

namespace App\Http\Resources;

use App\Enums\ProjectStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicTaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $task = $this->task;
        $token = $this->id;

        $description = $task->description;
        if ($description) {
            $description = str_replace(
                '/api/task-description-images/',
                '/api/public/tasks/' . $token . '/description-images/',
                $description
            );
        }

        return [
            'task' => [
                'title' => $task->title,
                'description' => $description,
                'estimation' => $task->estimation,
                'deadline' => $task->deadline,
                'client_approval_status' => $task->client_approval_status,
                'project_name' => $task->project?->name,
                // Задача архивного проекта открыта только для просмотра.
                'is_read_only' => $task->project?->status === ProjectStatus::ARCHIVED,
                'attachments' => $task->attachments->map(fn($att) => [
                    'id' => $att->id,
                    'original_name' => $att->original_name,
                    'mime_type' => $att->mime_type,
                    'size' => $att->size,
                ]),
            ],
            'messages' => $task->clientMessages->map(fn($msg) => new PublicTaskMessageResource($msg, $token)),
        ];
    }
}
