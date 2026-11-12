<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DeleteProjectDocumentRequest;
use App\Http\Requests\Workspace\ProjectDocumentViewRequest;
use App\Http\Requests\Workspace\StoreProjectDocumentRequest;
use App\Http\Requests\Workspace\UpdateProjectDocumentRequest;
use App\Http\Responses\Workspace\ProjectDocumentIndexResponse;
use App\Http\Responses\Workspace\ProjectDocumentResponse;
use App\Models\ProjectDocument;
use App\Models\Project;
use App\Services\Workspace\ProjectDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProjectDocumentController extends Controller
{
    public function __construct(
        private readonly ProjectDocumentService $documents,
    ) {
    }

    public function index(ProjectDocumentViewRequest $request, Project $project): JsonResponse
    {
        return new ProjectDocumentIndexResponse(
            $this->documents->list($request->user(), $project)
        );
    }

    public function store(StoreProjectDocumentRequest $request, Project $project): JsonResponse
    {
        $document = $this->documents->store(
            $request->user(),
            $project,
            $request->file('document'),
            $request->boolean('is_client_visible', true),
        );

        return new ProjectDocumentResponse($document, 201);
    }

    public function update(UpdateProjectDocumentRequest $request, ProjectDocument $document): JsonResponse
    {
        $document = $this->documents->updateClientVisibility(
            $request->user(),
            $document,
            $request->boolean('is_client_visible'),
        );

        return new ProjectDocumentResponse($document);
    }

    public function download(ProjectDocumentViewRequest $request, ProjectDocument $document): StreamedResponse
    {
        return $this->documents->open($request->user(), $document);
    }

    public function destroy(DeleteProjectDocumentRequest $request, ProjectDocument $document): Response
    {
        $this->documents->delete($request->user(), $document);

        return response()->noContent();
    }
}
