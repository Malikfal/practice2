<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;

final class PinnedTemplateResource extends TemplateResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'pinned_at' => $this->pivot?->created_at?->toISOString(),
        ];
    }
}
