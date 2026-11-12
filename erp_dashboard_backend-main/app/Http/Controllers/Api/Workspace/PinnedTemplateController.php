<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Responses\Workspace\PinnedTemplateIndexResponse;
use App\Http\Responses\Workspace\PinnedTemplateResponse;
use App\Models\Template;
use App\Services\Workspace\PinnedTemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PinnedTemplateController extends Controller
{
    public function __construct(private readonly PinnedTemplateService $pinnedTemplates)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return new PinnedTemplateIndexResponse(
            $this->pinnedTemplates->list($request->user())
        );
    }

    public function store(Request $request, Template $template): JsonResponse
    {
        $template = $this->pinnedTemplates->pin($request->user(), $template);

        return new PinnedTemplateResponse($template, 201);
    }

    public function destroy(Request $request, Template $template): Response
    {
        $this->pinnedTemplates->unpin($request->user(), $template);

        return response()->noContent();
    }
}
