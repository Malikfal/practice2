<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ShowFinanceSettingsRequest;
use App\Http\Requests\Workspace\UpdateFinanceSettingsRequest;
use App\Services\Workspace\FinanceSettingsService;
use Illuminate\Http\JsonResponse;

class FinanceSettingsController extends Controller
{
    public function __construct(
        private readonly FinanceSettingsService $financeSettings,
    ) {
    }

    public function show(ShowFinanceSettingsRequest $request): JsonResponse
    {
        return response()->json($this->financeSettings->show($request->user()));
    }

    public function update(UpdateFinanceSettingsRequest $request): JsonResponse
    {
        return response()->json(
            $this->financeSettings->update($request->user(), $request->validated())
        );
    }
}
