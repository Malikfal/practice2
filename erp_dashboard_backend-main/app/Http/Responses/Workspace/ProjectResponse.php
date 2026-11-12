<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectResource;
use App\Models\Project;
use Illuminate\Http\JsonResponse;

final class ProjectResponse extends JsonResponse
{
    public function __construct(Project $project, int $status = 200)
    {
        parent::__construct(self::data($project), $status);
    }

    public static function data(Project $project): array
    {
        $project->loadMissing('latestActivityHistory');

        return ProjectResource::make($project)->resolve(request());
    }
}
