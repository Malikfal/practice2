<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicTaskMessageResource extends JsonResource
{
    private string $token;

    public function __construct($resource, string $token)
    {
        parent::__construct($resource);
        $this->token = $token;
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'text' => $this->text,
            'is_from_client' => (bool) $this->is_from_client,
            'created_at' => $this->created_at,
            'author_name' => $this->author ? trim($this->author->name . ' ' . $this->author->last_name) : null,
            'attachments' => $this->attachments->map(fn($att) => [
                'id' => $att->id,
                'original_name' => $att->original_name,
                'mime_type' => $att->mime_type,
            ]),
        ];
    }
}
