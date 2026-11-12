<?php

namespace App\Http\Resources\Workspace;

use App\Models\EmployeeDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin EmployeeDocument
 */
final class EmployeeDocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $uploader = $this->uploader;

        return [
            'id' => (string) $this->id,
            'employee_id' => (string) $this->employee_id,
            'original_name' => (string) $this->original_name,
            'mime_type' => $this->mime_type,
            'size' => (int) $this->size,
            'author' => $uploader ? [
                'id' => (string) $uploader->id,
                'name' => $uploader->name,
                'last_name' => $uploader->last_name,
                'email' => $uploader->email,
            ] : null,
            'download_url' => '/employee-documents/'.$this->id,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
