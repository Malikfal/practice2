<?php

namespace App\Http\Resources\Workspace;

use App\Models\TaskAttachment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TaskAttachment
 */

final class TaskAttachmentResource extends JsonResource {
    public function toArray(Request $request) {
        return [
            'id' => (string) $this->id,
            'task_id' => (string) $this->task_id,
            'company_id' => (string) $this->company_id,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size' => (int) $this->size,
            'download_url' => '/task-attachments/'.$this->id,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'uploader' => $this->uploader ? [
                'id' => (string) $this->uploader->id,
                'name' => $this->uploader->name,
                'last_name' => $this->uploader->last_name,
            ] : null,
        ];
    }
}