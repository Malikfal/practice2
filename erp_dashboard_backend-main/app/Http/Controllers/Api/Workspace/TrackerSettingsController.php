<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ShowTrackerSettingsRequest;
use App\Http\Requests\Workspace\UpdateTrackerSettingsRequest;
use App\Services\Workspace\TrackerSettingsService;
use Illuminate\Http\JsonResponse;

class TrackerSettingsController extends Controller
{
    public function __construct(
        private readonly TrackerSettingsService $trackerSettings,
    ) {
    }

    public function show(ShowTrackerSettingsRequest $request): JsonResponse
    {
        return response()->json($this->trackerSettings->show($request->user()));
    }

    public function update(UpdateTrackerSettingsRequest $request): JsonResponse
    {
        return response()->json(
            $this->trackerSettings->update($request->user(), $request->validated())
        );
    }
}
