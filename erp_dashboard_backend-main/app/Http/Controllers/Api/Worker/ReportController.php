<?php

namespace App\Http\Controllers\Api\Worker;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\EmployeeDayTimelineRequest;
use App\Http\Requests\Workspace\TaskReportRequest;
use App\Http\Requests\Workspace\TimeReportRequest;
use App\Http\Responses\Workspace\EmployeeDayTimelineResponse;
use App\Http\Responses\Workspace\TimeReportResponse;
use App\Services\Workspace\Reports\EmployeeDayTimelineService;
use App\Services\Workspace\Reports\TaskReportService;
use App\Services\Workspace\Reports\TimeReportService;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    public function __construct(
        private readonly TimeReportService $timeReports,
        private readonly TaskReportService $taskReports,
        private readonly EmployeeDayTimelineService $dayTimelines,
    ) {}

    public function time(TimeReportRequest $request): JsonResponse
    {
        $payload = $request->validated();
        $payload['user_ids'] = [(string) $request->user()->id];
        $report = $this->timeReports->build($payload, (string) $request->user()->company_id);

        return new TimeReportResponse($report);
    }

    public function tasks(TaskReportRequest $request): JsonResponse
    {
        $payload = $request->validated();
        $payload['user_ids'] = [(string) $request->user()->id];
        $report = $this->taskReports->build($payload, (string) $request->user()->company_id, $request->user());

        return response()->json([
            'from' => $report['from'],
            'to' => $report['to'],
            'rows' => $report['rows'],
            'total_seconds' => $report['total_seconds'],
        ]);
    }

    public function dayTimeline(EmployeeDayTimelineRequest $request): JsonResponse
    {
        $payload = $request->validated();
        $payload['user_id'] = (string) $request->user()->id;
        $timeline = $this->dayTimelines->build($payload, (string) $request->user()->company_id);

        return new EmployeeDayTimelineResponse(
            $timeline['user_id'],
            $timeline['from'],
            $timeline['to'],
            $timeline['segments'],
            $timeline['total_seconds'],
        );
    }
}
