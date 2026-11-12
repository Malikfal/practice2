<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Responses\Workspace\PinnedProjectIndexResponse;
use App\Http\Responses\Workspace\PinnedProjectResponse;
use App\Models\Project;
use App\Services\Workspace\PinnedProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PinnedProjectController extends Controller
{
    public function __construct(private readonly PinnedProjectService $pinnedProjects)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return new PinnedProjectIndexResponse(
            $this->pinnedProjects->list($request->user())
        );
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $project = $this->pinnedProjects->pin($request->user(), $project);

        return new PinnedProjectResponse($project, 201);
    }

    public function destroy(Request $request, Project $project): Response
    {
        $this->pinnedProjects->unpin($request->user(), $project);

        return response()->noContent();
    }
}
