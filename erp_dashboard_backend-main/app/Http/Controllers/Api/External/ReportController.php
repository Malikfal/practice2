<?php

namespace App\Http\Controllers\Api\External;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\WorkSegmentsReportRequest;
use App\Http\Responses\External\WorkSegmentsReportResponse;
use App\Services\Workspace\Reports\WorkSegmentsReportService;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    public function __construct(
        private readonly WorkSegmentsReportService $reports,
    ) {}

    public function workSegments(WorkSegmentsReportRequest $request): JsonResponse
    {
        $payload = $request->validated();
        $companyId = (string) $request->attributes->get('company_id', '');
        $report = $this->reports->build($payload, $companyId);

        if (isset($payload['userId'])) {
            $report = $report[(string) $payload['userId']] ?? [];
        }

        return new WorkSegmentsReportResponse(
            $report,
        );
    }
}
