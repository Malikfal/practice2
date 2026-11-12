<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\CompanyPayrollCalculationRequest;
use App\Http\Requests\Workspace\CompanyPayrollSummaryRequest;
use App\Http\Requests\Workspace\EmployeePayrollCalculationRequest;
use App\Http\Responses\Workspace\CompanyPayrollCalculationResponse;
use App\Http\Responses\Workspace\CompanyPayrollSummaryResponse;
use App\Http\Responses\Workspace\EmployeePayrollCalculationResponse;
use App\Models\Company;
use App\Models\User;
use App\Services\Workspace\CompanyPayrollSummaryService;
use App\Services\Workspace\EmployeePayrollCalculationService;
use Illuminate\Http\JsonResponse;

class EmployeePayrollCalculationController extends Controller
{
    public function __construct(
        private readonly EmployeePayrollCalculationService $payrollCalculations,
        private readonly CompanyPayrollSummaryService $payrollSummary,
    ) {}

    public function index(EmployeePayrollCalculationRequest $request, User $employee): JsonResponse
    {
        $report = $this->payrollCalculations->calculate(
            $request->user(),
            $employee,
            $request->validated(),
        );

        return new EmployeePayrollCalculationResponse(
            $report['rows'],
            $report['from'],
            $report['to'],
            $report['meta'],
        );
    }

    public function companyIndex(CompanyPayrollCalculationRequest $request): JsonResponse
    {
        $company = Company::query()->findOrFail($this->companyId($request));
        $report = $this->payrollCalculations->calculateForCompany(
            $request->user(),
            $company,
            $request->validated(),
        );

        return new CompanyPayrollCalculationResponse(
            $report['rows'],
            $report['from'],
            $report['to'],
            $report['meta'],
        );
    }

    /** Расчёт ФОТ компании с группировкой по неделям, месяцам, кварталам или годам. */
    public function companySummary(CompanyPayrollSummaryRequest $request): JsonResponse
    {
        $company = Company::query()->findOrFail($this->companyId($request));

        return new CompanyPayrollSummaryResponse(
            $this->payrollSummary->summarize($request->user(), $company, $request->validated()),
        );
    }
}
