<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\FinanceAnalyticsRequest;
use App\Http\Resources\Workspace\FinanceAnalyticsClientsResource;
use App\Http\Resources\Workspace\FinanceAnalyticsEmployeesResource;
use App\Http\Resources\Workspace\FinanceAnalyticsManagersResource;
use App\Http\Resources\Workspace\FinanceAnalyticsOverviewResource;
use App\Http\Resources\Workspace\FinanceAnalyticsProjectsResource;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsService;
use Illuminate\Http\JsonResponse;

class FinanceAnalyticsController extends Controller
{
    public function __construct(
        private readonly FinanceAnalyticsService $analytics,
    ) {}

    public function overview(FinanceAnalyticsRequest $request): JsonResponse
    {
        return FinanceAnalyticsOverviewResource::make(
            $this->analytics->overview($request->validated(), $this->companyId($request)),
        )->response();
    }

    public function projects(FinanceAnalyticsRequest $request): JsonResponse
    {
        return FinanceAnalyticsProjectsResource::make(
            $this->analytics->projects($request->validated(), $this->companyId($request)),
        )->response();
    }

    public function managers(FinanceAnalyticsRequest $request): JsonResponse
    {
        return FinanceAnalyticsManagersResource::make(
            $this->analytics->managers($request->validated(), $this->companyId($request)),
        )->response();
    }

    public function clients(FinanceAnalyticsRequest $request): JsonResponse
    {
        return FinanceAnalyticsClientsResource::make(
            $this->analytics->clients($request->validated(), $this->companyId($request)),
        )->response();
    }

    public function employees(FinanceAnalyticsRequest $request): JsonResponse
    {
        return FinanceAnalyticsEmployeesResource::make(
            $this->analytics->employees($request->validated(), $this->companyId($request)),
        )->response();
    }
}
