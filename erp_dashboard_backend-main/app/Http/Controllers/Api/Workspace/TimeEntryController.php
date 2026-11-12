<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DeleteTimeEntryRequest;
use App\Http\Requests\Workspace\MoveTimeEntryRequest;
use App\Http\Requests\Workspace\StoreTimeEntryRequest;
use App\Http\Responses\Workspace\DeletedTimeEntryResponse;
use App\Http\Responses\Workspace\MoveTimeEntryResponse;
use App\Http\Responses\Workspace\TimeEntryConflictResponse;
use App\Http\Responses\Workspace\TimeEntryResponse;
use App\Models\WorkSegment;
use App\Services\Workspace\TimeEntryService;
use Illuminate\Http\JsonResponse;

class TimeEntryController extends Controller
{
    public function __construct(
        private readonly TimeEntryService $entries,
    ) {}

    public function store(StoreTimeEntryRequest $request): JsonResponse
    {
        $result = $this->entries->create(
            $request->validated(),
            (string) $request->user()->id,
            $this->companyId($request),
        );

        if ($result['conflict']) {
            return new TimeEntryConflictResponse($result['started_at'], $result['ended_at']);
        }

        return new TimeEntryResponse($result['entry'], 201);
    }

    public function move(MoveTimeEntryRequest $request, WorkSegment $segment): JsonResponse
    {
        $result = $this->entries->moveSegmentInterval(
            $segment,
            $request->validated(),
            (string) $request->user()->id,
            $this->companyId($request),
        );

        return new MoveTimeEntryResponse($result);
    }

    public function deleteInterval(DeleteTimeEntryRequest $request, WorkSegment $segment): JsonResponse
    {
        $result = $this->entries->deleteSegmentInterval(
            $segment,
            $request->validated(),
            (string) $request->user()->id,
            $this->companyId($request),
        );

        return new DeletedTimeEntryResponse($result);
    }
}
