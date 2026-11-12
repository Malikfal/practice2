<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DeleteProjectNoteRequest;
use App\Http\Requests\Workspace\ProjectNoteViewRequest;
use App\Http\Requests\Workspace\StoreProjectNoteImageRequest;
use App\Http\Requests\Workspace\StoreProjectNoteRequest;
use App\Http\Requests\Workspace\UpdateProjectNoteRequest;
use App\Http\Requests\Workspace\ViewProjectNoteImageRequest;
use App\Http\Responses\Workspace\ProjectNoteImageUploadResponse;
use App\Http\Responses\Workspace\ProjectNoteIndexResponse;
use App\Http\Responses\Workspace\ProjectNoteResponse;
use App\Models\Project;
use App\Models\ProjectNote;
use App\Models\ProjectNoteImage;
use App\Services\Workspace\ProjectNoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProjectNoteController extends Controller
{
    public function __construct(
        private readonly ProjectNoteService $notes,
    ) {}

    public function index(ProjectNoteViewRequest $request, Project $project): JsonResponse
    {
        return new ProjectNoteIndexResponse(
            $this->notes->list($request->user(), $project),
        );
    }

    public function store(StoreProjectNoteRequest $request, Project $project): JsonResponse
    {
        return new ProjectNoteResponse(
            $this->notes->store($request->user(), $project, $request->validated()),
            201,
        );
    }

    public function update(UpdateProjectNoteRequest $request, ProjectNote $note): JsonResponse
    {
        return new ProjectNoteResponse(
            $this->notes->update($request->user(), $note, $request->validated()),
        );
    }

    public function destroy(DeleteProjectNoteRequest $request, ProjectNote $note): Response
    {
        $this->notes->delete($request->user(), $note);

        return response()->noContent();
    }

    public function pin(ProjectNoteViewRequest $request, ProjectNote $note): JsonResponse
    {
        return new ProjectNoteResponse(
            $this->notes->pin($request->user(), $note),
            201,
        );
    }

    public function unpin(ProjectNoteViewRequest $request, ProjectNote $note): Response
    {
        $this->notes->unpin($request->user(), $note);

        return response()->noContent();
    }

    public function uploadImage(StoreProjectNoteImageRequest $request, ProjectNote $note): JsonResponse
    {
        return new ProjectNoteImageUploadResponse(
            $this->notes->storeImage($request->user(), $note, $request->imageFile()),
        );
    }

    public function image(ViewProjectNoteImageRequest $request, ProjectNoteImage $image): StreamedResponse
    {
        return $this->notes->openImage($request->user(), $image);
    }
}
