<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ReorderProjectSidebarRequest;
use App\Services\Workspace\ProjectSidebarOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectSidebarOrderController extends Controller
{
    public function __construct(
        private readonly ProjectSidebarOrderService $projectSidebarOrder,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->projectSidebarOrder->list($request->user()),
        ]);
    }

    public function update(ReorderProjectSidebarRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->projectSidebarOrder->reorder(
                $request->user(),
                $request->validated('project_ids', []),
            ),
        ]);
    }
}
