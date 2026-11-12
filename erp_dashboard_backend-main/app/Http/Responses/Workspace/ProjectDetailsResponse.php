<?php

namespace App\Http\Responses\Workspace;

use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class ProjectDetailsResponse extends JsonResponse
{
    public function __construct(Project $project, Collection $byEmployee)
    {
        parent::__construct([
            'project' => ProjectResponse::data($project),
            'by_employee' => $byEmployee->values(),
        ]);
    }
}
