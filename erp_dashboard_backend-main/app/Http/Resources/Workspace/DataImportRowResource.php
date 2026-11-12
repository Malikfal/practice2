<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class DataImportRowResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'row_number' => $this->row_number,
            'status' => $this->status->value,
            'raw_data' => $this->raw_data,
            'normalized_data' => $this->normalized_data,
            'errors' => $this->errors,
            'warnings' => $this->warnings,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
        ];
    }
}
