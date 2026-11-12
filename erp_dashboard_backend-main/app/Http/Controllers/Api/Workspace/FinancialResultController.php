<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\FinancialResultRequest;
use App\Http\Resources\Workspace\FinancialResultClientsResource;
use App\Http\Resources\Workspace\FinancialResultManagersResource;
use App\Http\Resources\Workspace\FinancialResultOverviewResource;
use App\Http\Resources\Workspace\FinancialResultProjectsResource;
use App\Services\Workspace\FinancialResultServices\FinancialResultService;
use Illuminate\Http\JsonResponse;

class FinancialResultController extends Controller
{
    public function __construct(private readonly FinancialResultService $financialResults) {}

    public function overview(FinancialResultRequest $request): JsonResponse
    {
        return FinancialResultOverviewResource::make(
            $this->financialResults->overview($request->validated(), $this->companyId($request)),
        )->response();
    }

    public function projects(FinancialResultRequest $request): JsonResponse
    {
        return FinancialResultProjectsResource::make(
            $this->financialResults->projects($request->validated(), $this->companyId($request)),
        )->response();
    }

    public function managers(FinancialResultRequest $request): JsonResponse
    {
        return FinancialResultManagersResource::make(
            $this->financialResults->managers($request->validated(), $this->companyId($request)),
        )->response();
    }

    public function clients(FinancialResultRequest $request): JsonResponse
    {
        return FinancialResultClientsResource::make(
            $this->financialResults->clients($request->validated(), $this->companyId($request)),
        )->response();
    }
}
