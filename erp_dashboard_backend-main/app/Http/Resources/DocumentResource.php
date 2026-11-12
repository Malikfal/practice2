<?php

namespace App\Http\Resources;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Document
 */

class DocumentResource extends JsonResource {

    public function toArray(Request $request): array {
        $isWorkspace = $request->is('api/workspace/*');
        $routeName = $isWorkspace 
            ? 'api.documents.private.download' 
            : 'api.documents.public.download';

        return [
            'id' => $this->id,
            'title' => $this->title,
            'is_public' => $this->is_public,
            'download_url' => route($routeName, $this->id),
        ];
    }
}