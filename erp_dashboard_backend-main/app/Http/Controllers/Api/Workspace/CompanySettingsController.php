<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ShowCompanySettingsRequest;
use App\Http\Requests\Workspace\UpdateCompanySettingsRequest;
use App\Http\Requests\Workspace\UpdateCompanyTimezoneRequest;
use App\Http\Requests\Workspace\UpdateCompanyUnestimatedTaskLimitRequest;
use App\Services\Workspace\CompanySettingsService;
use Illuminate\Http\JsonResponse;

class CompanySettingsController extends Controller
{
    public function __construct(
        private readonly CompanySettingsService $companySettings,
    ) {}

    public function show(ShowCompanySettingsRequest $request): JsonResponse
    {
        return response()->json($this->companySettings->show($request->user()));
    }

    public function update(UpdateCompanySettingsRequest $request): JsonResponse
    {
        return response()->json(
            $this->companySettings->update($request->user(), $request->validated())
        );
    }

    public function updateTimezone(UpdateCompanyTimezoneRequest $request): JsonResponse
    {
        return response()->json(
            $this->companySettings->updateTimezone($request->user(), $request->validated('timezone'))
        );
    }

    public function updateUnestimatedTaskLimit(UpdateCompanyUnestimatedTaskLimitRequest $request): JsonResponse
    {
        return response()->json(
            $this->companySettings->updateUnestimatedTaskLimit(
                $request->user(),
                (int) $request->validated('unestimated_task_limit_seconds'),
            )
        );
    }
}
