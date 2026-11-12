<?php

namespace App\Http\Resources\Workspace;

use App\Models\TaskComment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TaskComment
 */
final class TaskCommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'task_id' => (string) $this->task_id,
            'text' => $this->text,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'author' => $this->author ? [
                'id' => (string) $this->author->id,
                'name' => $this->author->name,
                'last_name' => $this->author->last_name,
                'email' => $this->author->email,
            ] : null,
            'attachments' => $this->attachments->map(
                static fn (object $attachment): array => [
                    'id' => (string) $attachment->id,
                    'comment_id' => (string) $attachment->comment_id,
                    'project_id' => (string) $attachment->project_id,
                    'task_id' => (string) $attachment->task_id,
                    'original_name' => (string) $attachment->original_name,
                    'mime_type' => $attachment->mime_type,
                    'download_url' => '/task-comment-attachments/'.$attachment->id,
                    'created_at' => $attachment->created_at?->toISOString(),
                ]
            )->values(),
        ];
    }
}
