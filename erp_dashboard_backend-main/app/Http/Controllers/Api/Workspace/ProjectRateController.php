<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ProjectAboutTabRequest;
use App\Http\Requests\Workspace\StoreProjectRateRequest;
use App\Http\Responses\Workspace\ProjectRateIndexResponse;
use App\Http\Responses\Workspace\ProjectRateResponse;
use App\Services\Workspace\ProjectRateService;
use App\Models\User;
use App\Models\ProjectRate;
use App\Models\Project;
use Illuminate\Http\JsonResponse;

class ProjectRateController extends Controller {
    public function __construct(
        private readonly ProjectRateService $projectRates,
    ) {}

    public function index(ProjectAboutTabRequest $request, Project $project): JsonResponse  {
        return new ProjectRateIndexResponse(
            $this->projectRates->list($request->user(), $project)
        );
    }

    public function store(StoreProjectRateRequest $request, Project $project): JsonResponse {
        $rate = $this->projectRates->store(
            $request->user(),
            $project,
            $request->validated()
        );

        return new ProjectRateResponse($rate, 201);
    }

    public function current(ProjectAboutTabRequest $request, Project $project): JsonResponse
    {
        $rate = $this->projectRates->current($request->user(), $project);

        return response()->json([
            'data' => $rate ? ProjectRateResponse::data($rate) : null,
        ]);
    }
}
