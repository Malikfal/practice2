<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\EmployeeDayTimelineRequest;
use App\Http\Requests\Workspace\HoursChartReportRequest;
use App\Http\Requests\Workspace\LimitReportRequest;
use App\Http\Requests\Workspace\ManagerReportRequest;
use App\Http\Requests\Workspace\OverrunReportRequest;
use App\Http\Requests\Workspace\StaleTasksReportRequest;
use App\Http\Requests\Workspace\TaskReportRequest;
use App\Http\Requests\Workspace\TimeReportRequest;
use App\Http\Responses\Workspace\EmployeeDayTimelineResponse;
use App\Http\Responses\Workspace\TimeReportResponse;
use App\Services\Workspace\Reports\EmployeeDayTimelineService;
use App\Services\Workspace\Reports\HoursChartReportService;
use App\Services\Workspace\Reports\LimitReportService;
use App\Services\Workspace\Reports\ManagerReport\ManagerReportService;
use App\Services\Workspace\Reports\StaleTasksReportService;
use App\Services\Workspace\Reports\TaskReportService;
use App\Services\Workspace\Reports\TimeReportService;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    public function __construct(
        private readonly TimeReportService $timeReports,
        private readonly TaskReportService $taskReports,
        private readonly EmployeeDayTimelineService $dayTimelines,
        private readonly ManagerReportService $managerReports,
    ) {}

    /** Финансовые показатели отчета по менеджерам видят только пользователи с доступом к финансам. */
    public function managers(ManagerReportRequest $request): JsonResponse
    {
        $user = $request->user();
        $withFinance = $user->can(UserPermission::FINANCE_VIEW->value)
            || $user->can(UserPermission::FINANCE_MANAGE->value);

        return response()->json(
            $this->managerReports->build($request->validated(), $this->companyId($request), $withFinance),
        );
    }

    public function time(TimeReportRequest $request): JsonResponse
    {
        $payload = $request->validated();

        if ((string) $request->user()?->role === UserRole::WORKER->value) {
            $payload['user_ids'] = [(string) $request->user()->id];
        }

        $report = $this->timeReports->build(
            $payload,
            $this->companyId($request),
            $request->user(),
        );

        return new TimeReportResponse($report);
    }

    public function overrun(OverrunReportRequest $request): JsonResponse
    {
        $payload = $request->validated();

        if ((string) $request->user()?->role === UserRole::WORKER->value) {
            $payload['user_ids'] = [(string) $request->user()->id];
        }

        $report = $this->timeReports->overrun($payload, $this->companyId($request), $request->user());

        return response()->json([
            ...$report,
            'from' => $report['from']->toDateString(),
            'to' => $report['to']->toDateString(),
        ]);
    }

    public function staleTasks(StaleTasksReportRequest $request, StaleTasksReportService $staleTasks): JsonResponse
    {
        $payload = $request->validated();

        if ((string) $request->user()?->role === UserRole::WORKER->value) {
            $payload['user_ids'] = [(string) $request->user()->id];
        }

        return response()->json($staleTasks->build($payload, $this->companyId($request), $request->user()));
    }

    public function limits(LimitReportRequest $request, LimitReportService $limitReports): JsonResponse
    {
        $payload = $request->validated();

        // Как в отчете по времени: сотруднику доступно только свое время.
        if ((string) $request->user()?->role === UserRole::WORKER->value) {
            $payload['user_ids'] = [(string) $request->user()->id];
        }

        $report = $limitReports->build($payload, $this->companyId($request), $request->user());

        return response()->json([
            ...$report,
            'from' => $report['from']->toDateString(),
            'to' => $report['to']->toDateString(),
        ]);
    }

    public function hoursChart(HoursChartReportRequest $request, HoursChartReportService $hoursChart): JsonResponse
    {
        $payload = $request->validated();

        if ((string) $request->user()?->role === UserRole::WORKER->value) {
            $payload['user_ids'] = [(string) $request->user()->id];
        }

        return response()->json($hoursChart->build($payload, $this->companyId($request), $request->user()));
    }

    public function tasks(TaskReportRequest $request): JsonResponse
    {
        $payload = $request->validated();

        if ((string) $request->user()?->role === UserRole::WORKER->value) {
            $payload['user_id'] = (string) $request->user()->id;
            $payload['user_ids'] = [(string) $request->user()->id];
        }

        $report = $this->taskReports->build($payload, $this->companyId($request), $request->user());

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

        if ((string) $request->user()?->role === UserRole::WORKER->value) {
            $payload['user_id'] = (string) $request->user()->id;
        }

        $payload['include_segment_details'] = (string) $request->user()?->role !== UserRole::WORKER->value;

        $timeline = $this->dayTimelines->build($payload, $this->companyId($request));

        return new EmployeeDayTimelineResponse(
            $timeline['user_id'],
            $timeline['from'],
            $timeline['to'],
            $timeline['segments'],
            $timeline['total_seconds'],
        );
    }
}
