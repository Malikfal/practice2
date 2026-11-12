<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DeleteTemplateRequest;
use App\Http\Requests\Workspace\TemplateIndexRequest;
use App\Http\Requests\Workspace\StoreTemplateRequest;
use App\Http\Responses\Workspace\TemplateIndexResponse;
use App\Http\Responses\Workspace\TemplateResponse;
use App\Models\Template;
use App\Services\Workspace\TemplateService;
use Illuminate\Http\JsonResponse;

class TemplateController extends Controller
{
    public function __construct(
        private readonly TemplateService $templates,
    ) {
    }

    public function index(TemplateIndexRequest $request): JsonResponse
    {
        return new TemplateIndexResponse(
            $this->templates->paginate($request->validated(), $this->companyId($request))
        );
    }

    public function store(StoreTemplateRequest $request): JsonResponse
    {
        return new TemplateResponse(
            $this->templates->create($request->user(), $request->validated()),
            201,
        );
    }

    public function update(StoreTemplateRequest $request, Template $template): JsonResponse 
    {
        return new TemplateResponse(
            $this->templates->update($template, $request->validated())
        );
    }

    public function destroy(DeleteTemplateRequest $request, Template $template): JsonResponse
    {
        $this->templates->delete($template);

        return new JsonResponse(null, 204);
    }
}
