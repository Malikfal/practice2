<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Models\Company;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\EmployeeIndexRequest;
use App\Http\Responses\Workspace\EmployeeIndexResponse;
use App\Services\Workspace\EmployeeService;
use Illuminate\Http\JsonResponse;

class EmployeeController extends Controller
{
    public function __construct(
        private readonly EmployeeService $employees,
    ) {
    }

    public function index(EmployeeIndexRequest $request): JsonResponse
    {

        $companyId = $this->companyId($request);
        $company = Company::with('tariff')->find($companyId);

        $maxEmployees = $company?->tariff?->max_employees;
        $totalActiveEmployees = $company?->employees()->where('status', 'ACTIVE')->count() ?? 0;

        return new EmployeeIndexResponse(
            $this->employees->paginate($request->validated(), $this->companyId($request)),
            $request->user(),
            $maxEmployees,
            $totalActiveEmployees
        );
    }
}
