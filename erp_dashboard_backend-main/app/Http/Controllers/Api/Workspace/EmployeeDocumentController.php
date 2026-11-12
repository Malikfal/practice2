<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\EmployeeDocumentsViewRequest;
use App\Http\Requests\Workspace\StoreEmployeeDocumentRequest;
use App\Http\Responses\Workspace\EmployeeDocumentIndexResponse;
use App\Http\Responses\Workspace\EmployeeDocumentResponse;
use App\Models\EmployeeDocument;
use App\Models\User;
use App\Services\Workspace\EmployeeDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmployeeDocumentController extends Controller
{
    public function __construct(
        private readonly EmployeeDocumentService $documents,
    ) {
    }

    public function index(EmployeeDocumentsViewRequest $request, User $employee): JsonResponse
    {
        return new EmployeeDocumentIndexResponse(
            $this->documents->list($request->user(), $employee)
        );
    }

    public function store(StoreEmployeeDocumentRequest $request, User $employee): JsonResponse
    {
        $document = $this->documents->store(
            $request->user(),
            $employee,
            $request->file('document')
        );

        return new EmployeeDocumentResponse($document, 201);
    }

    public function download(EmployeeDocumentsViewRequest $request, EmployeeDocument $document): StreamedResponse
    {
        return $this->documents->open($request->user(), $document);
    }

    public function destroy(EmployeeDocumentsViewRequest $request, EmployeeDocument $document): Response
    {
        $this->documents->delete($request->user(), $document);

        return response()->noContent();
    }
}
