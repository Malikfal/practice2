<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ProjectAboutTabRequest;
use App\Http\Requests\Workspace\ProjectDefaultEntranceArticleBatchRequest;
use App\Http\Requests\Workspace\UpdateProjectDefaultEntranceArticleRequest;
use App\Http\Resources\Workspace\ProjectDefaultEntranceArticleResource;
use App\Models\Project;
use App\Services\Workspace\ProjectDefaultEntranceArticleService;
use Illuminate\Http\JsonResponse;

class ProjectDefaultEntranceArticleController extends Controller
{
    public function __construct(
        private readonly ProjectDefaultEntranceArticleService $articles,
    ) {}

    public function show(ProjectAboutTabRequest $request, Project $project): JsonResponse
    {
        return $this->response($this->articles->show($request->user(), $project));
    }

    public function showMany(ProjectDefaultEntranceArticleBatchRequest $request): JsonResponse
    {
        $projects = $this->articles->showMany($request->user(), $request->validated('project_ids'));

        return response()->json([
            'data' => ProjectDefaultEntranceArticleResource::collection($projects)->resolve($request),
        ]);
    }

    public function update(UpdateProjectDefaultEntranceArticleRequest $request, Project $project): JsonResponse
    {
        return $this->response($this->articles->update(
            $request->user(),
            $project,
            $request->validated('default_entrance_finance_article_id'),
        ));
    }

    private function response(Project $project): JsonResponse
    {
        return response()->json([
            'data' => ProjectDefaultEntranceArticleResource::make($project)->resolve(request()),
        ]);
    }
}
