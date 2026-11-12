<?php

namespace App\Http\Responses\Workspace;

use App\Models\KnowledgeBaseFolder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class KnowledgeBaseFolderIndexResponse extends JsonResponse
{
    public function __construct(Collection $folders)
    {
        $folders->loadMissing(['accesses.user']);

        parent::__construct([
            'data' => $folders->map(
                static fn (KnowledgeBaseFolder $folder): array => KnowledgeBaseFolderResponse::data($folder)
            )->values(),
        ]);
    }
}
