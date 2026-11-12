<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DeleteFinanceRequest;
use App\Http\Requests\Workspace\FinanceExportRequest;
use App\Http\Requests\Workspace\FinanceIndexRequest;
use App\Http\Requests\Workspace\FinanceSummaryRequest;
use App\Http\Requests\Workspace\FinanceViewRequest;
use App\Http\Requests\Workspace\StoreFinanceRequest;
use App\Http\Requests\Workspace\UpdateFinanceRequest;
use App\Http\Responses\Workspace\FinanceIndexResponse;
use App\Http\Responses\Workspace\FinanceResponse;
use App\Models\Finance;
use App\Services\Workspace\FinanceExportService;
use App\Services\Workspace\FinanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class FinanceController extends Controller
{
    public function __construct(
        private readonly FinanceService $finances,
        private readonly FinanceExportService $exports,
    ) {}

    public function index(FinanceIndexRequest $request): JsonResponse
    {
        return new FinanceIndexResponse(
            $this->finances->paginate($request->validated(), $this->companyId($request)),
        );
    }

    public function summary(FinanceSummaryRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->finances->summary($request->validated(), $this->companyId($request)),
        ]);
    }

    public function export(FinanceExportRequest $request): BinaryFileResponse
    {
        return $this->exports->download($request->validated(), $this->companyId($request));
    }

    public function store(StoreFinanceRequest $request): JsonResponse
    {
        return new FinanceResponse(
            $this->finances->create($request->validated(), $this->companyId($request)),
            201,
        );
    }

    public function show(FinanceViewRequest $request, Finance $finance): JsonResponse
    {
        return new FinanceResponse(
            $this->finances->show($finance, $this->companyId($request)),
        );
    }

    public function update(UpdateFinanceRequest $request, Finance $finance): JsonResponse
    {
        return new FinanceResponse(
            $this->finances->update($finance, $request->validated(), $this->companyId($request)),
        );
    }

    public function destroy(DeleteFinanceRequest $request, Finance $finance): Response
    {
        $this->finances->delete($finance, $this->companyId($request));

        return response()->noContent();
    }
}
