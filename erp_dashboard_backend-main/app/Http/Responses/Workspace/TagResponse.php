<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TagResource;
use App\Models\Tag;
use Illuminate\Http\JsonResponse;

final class TagResponse extends JsonResponse
{
    public function __construct(Tag $tag, int $status = 200)
    {
        parent::__construct(self::data($tag), $status);
    }

    public static function data(Tag $tag): array
    {
        return TagResource::make($tag)->resolve(request());
    }
}
