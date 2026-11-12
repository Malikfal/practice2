<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\PinnedProjectResource;
use App\Models\Project;
use Illuminate\Http\JsonResponse;

final class PinnedProjectResponse extends JsonResponse
{
    public function __construct(Project $project, int $status = 200)
    {
        parent::__construct(self::data($project), $status);
    }

    public static function data(Project $project): array
    {
        return PinnedProjectResource::make($project)->resolve(request());
    }
}
