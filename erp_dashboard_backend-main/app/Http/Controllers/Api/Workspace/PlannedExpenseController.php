<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DeleteFinanceRequest;
use App\Http\Requests\Workspace\FinanceIndexRequest;
use App\Http\Requests\Workspace\FinanceViewRequest;
use App\Http\Requests\Workspace\StorePlannedExpenseRequest;
use App\Http\Requests\Workspace\UpdatePlannedExpenseRequest;
use App\Http\Responses\Workspace\PlannedExpenseIndexResponse;
use App\Http\Responses\Workspace\PlannedExpensePaymentsResponse;
use App\Http\Responses\Workspace\PlannedExpenseResponse;
use App\Models\PlannedExpense;
use App\Services\Workspace\PlannedExpenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class PlannedExpenseController extends Controller
{
    public function __construct(
        private readonly PlannedExpenseService $plannedExpenses,
    ) {}

    public function index(FinanceViewRequest $request): JsonResponse
    {
        return new PlannedExpenseIndexResponse(
            $this->plannedExpenses->all($this->companyId($request)),
        );
    }

    public function store(StorePlannedExpenseRequest $request): JsonResponse
    {
        return new PlannedExpenseResponse(
            $this->plannedExpenses->create($request->validated(), $this->companyId($request)),
            201,
        );
    }

    public function payments(FinanceIndexRequest $request): JsonResponse
    {
        return new PlannedExpensePaymentsResponse(
            $this->plannedExpenses->payments($request->validated(), $this->companyId($request)),
        );
    }

    public function show(FinanceViewRequest $request, PlannedExpense $plannedExpense): JsonResponse
    {
        return new PlannedExpenseResponse(
            $this->plannedExpenses->show($plannedExpense, $this->companyId($request)),
        );
    }

    public function update(
        UpdatePlannedExpenseRequest $request,
        PlannedExpense $plannedExpense,
    ): JsonResponse {
        return new PlannedExpenseResponse(
            $this->plannedExpenses->update(
                $plannedExpense,
                $request->validated(),
                $this->companyId($request),
            ),
        );
    }

    public function destroy(DeleteFinanceRequest $request, PlannedExpense $plannedExpense): Response
    {
        $this->plannedExpenses->delete($plannedExpense, $this->companyId($request));

        return response()->noContent();
    }
}
