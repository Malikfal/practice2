<?php

namespace App\Http\Resources\Workspace;

use App\Models\TaskComment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TaskComment
 */
final class TaskClientMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'task_id' => (string) $this->task_id,
            'text' => $this->text,
            'is_from_client' => (bool) $this->is_from_client,
            'created_at' => $this->created_at?->toISOString(),
            'author' => $this->author ? [
                'id' => (string) $this->author->id,
                'name' => $this->author->name,
                'last_name' => $this->author->last_name,
            ] : null,
            'attachments' => $this->attachments->map(
                static fn (object $attachment): array => [
                    'id' => (string) $attachment->id,
                    'original_name' => (string) $attachment->original_name,
                    'mime_type' => $attachment->mime_type,
                    'download_url' => '/task/'.$attachment->task_id.'/client-messages/attachments/'.$attachment->id,
                ]
            )->values(),
        ];
    }
}
