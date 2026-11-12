<?php

namespace App\Http\Resources\Workspace;

use App\Models\ProjectDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProjectDocument
 */
final class ProjectDocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $uploader = $this->uploader;

        return [
            'id' => (string) $this->id,
            'project_id' => (string) $this->project_id,
            'original_name' => (string) $this->original_name,
            'mime_type' => $this->mime_type,
            'size' => (int) $this->size,
            'is_client_visible' => (bool) $this->is_client_visible,
            'author' => $uploader ? [
                'id' => (string) $uploader->id,
                'name' => $uploader->name,
                'last_name' => $uploader->last_name,
                'email' => $uploader->email,
            ] : null,
            'download_url' => '/project-documents/'.$this->id,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
