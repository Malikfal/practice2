<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\SkillIndexRequest;
use App\Http\Responses\Workspace\SkillIndexResponse;
use App\Services\Workspace\SkillService;
use Illuminate\Http\JsonResponse;

class SkillController extends Controller
{
    public function __construct(private readonly SkillService $skills)
    {
    }

    public function index(SkillIndexRequest $request): JsonResponse
    {
        return new SkillIndexResponse(
            $this->skills->list($request->validated(), $this->companyId($request))
        );
    }
}

