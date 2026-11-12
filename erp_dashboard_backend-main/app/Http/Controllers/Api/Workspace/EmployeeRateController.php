<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\EmployeeCurrentRateIndexRequest;
use App\Http\Requests\Workspace\EmployeeSalaryTabRequest;
use App\Http\Requests\Workspace\StoreEmployeeRateRequest;
use App\Http\Responses\Workspace\EmployeeCurrentRateIndexResponse;
use App\Http\Responses\Workspace\EmployeeRateIndexResponse;
use App\Http\Responses\Workspace\EmployeeRateResponse;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Services\Workspace\EmployeeRateService;
use Illuminate\Http\JsonResponse;

class EmployeeRateController extends Controller {
    public function __construct(
        private readonly EmployeeRateService $employeeRates,
    ) {}

    public function employees(EmployeeCurrentRateIndexRequest $request): JsonResponse
    {
        return new EmployeeCurrentRateIndexResponse(
            $this->employeeRates->paginateEmployeesWithCurrentRates(
                $request->user(),
                $this->companyId($request),
                $request->validated(),
            )
        );
    }

    public function index(EmployeeSalaryTabRequest $request, User $employee)  {
        return new EmployeeRateIndexResponse(
            $this->employeeRates->list($request->user(), $employee)
        );
    }

    public function store(StoreEmployeeRateRequest $request, User $employee): JsonResponse {
        $rate = $this->employeeRates->store(
            $request->user(),
            $employee,
            $request->validated()
        );

        return new EmployeeRateResponse($rate, 201);
    }

    public function update(StoreEmployeeRateRequest $request, EmployeeRate $rate): JsonResponse
    {
        $rate = $this->employeeRates->update(
            $request->user(),
            $rate,
            $request->validated()
        );

        return new EmployeeRateResponse($rate);
    }

    public function current(EmployeeSalaryTabRequest $request, User $employee): JsonResponse
    {
        $rate = $this->employeeRates->current($request->user(), $employee);

        return response()->json([
            'data' => $rate ? EmployeeRateResponse::data($rate) : null,
        ]);
    }

    public function destroy(EmployeeSalaryTabRequest $request, EmployeeRate $rate): JsonResponse
    {
        $this->employeeRates->destroy($request->user(), $rate);

        return response()->json(null, 204);
    }
}
