<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class DataImportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'type' => $this->type->value,
            'status' => $this->status->value,
            'original_name' => $this->original_name,
            'extension' => $this->extension,
            'mime_type' => $this->mime_type,
            'file_size' => $this->file_size,
            'progress' => $this->progress,
            'total_rows' => $this->total_rows,
            'processed_rows' => $this->processed_rows,
            'successful_rows' => $this->successful_rows,
            'failed_rows' => $this->failed_rows,
            'skipped_rows' => $this->skipped_rows,
            'metrics' => $this->metrics,
            'error_message' => $this->error_message,
            'started_at' => $this->started_at?->toISOString(),
            'finished_at' => $this->finished_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'logs' => $this->whenLoaded('logs', fn () => $this->logs->map(fn ($log) => [
                'level' => $log->level,
                'message' => $log->message,
                'context' => $log->context,
                'created_at' => $log->created_at?->toISOString(),
            ])),
        ];
    }
}
