<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\SyncProjectTagsRequest;
use App\Http\Requests\Workspace\TagIndexRequest;
use App\Http\Responses\Workspace\ProjectResponse;
use App\Http\Responses\Workspace\TagIndexResponse;
use App\Models\Project;
use App\Services\Workspace\TagService;
use Illuminate\Http\JsonResponse;

class TagController extends Controller
{
    public function __construct(private readonly TagService $tagService)
    {
    }

    public function index(TagIndexRequest $request): JsonResponse
    {
        return new TagIndexResponse(
            $this->tagService->list($request->validated(), $this->companyId($request))
        );
    }

    public function syncProjectTags(SyncProjectTagsRequest $request, Project $project): JsonResponse
    {
        return new ProjectResponse(
            $this->tagService->syncProjectTags(
                $request->user(),
                $project,
                $request->validated('tags'),
            )
        );
    }
}
