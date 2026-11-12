<?php

namespace App\Services\Workspace\Reports;

use App\Repositories\Workspace\Reports\EmployeeDayTimelineRepository;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class EmployeeDayTimelineService
{
    public function __construct(
        private readonly EmployeeDayTimelineRepository $reports,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{
     *     user_id: string,
     *     from: Carbon,
     *     to: Carbon,
     *     segments: Collection<int, array<string, mixed>>,
     *     total_seconds: int
     * }
     */
    public function build(array $data, string $companyId): array
    {
        $from = Carbon::parse($data['from']);
        $to = Carbon::parse($data['to']);
        $userId = (string) $data['user_id'];
        $includeDetails = (bool) ($data['include_segment_details'] ?? false);

        $segments = $this->reports
            ->build($companyId, $userId, $from, $to)
            ->map(function (object $segment) use ($from, $to, $includeDetails): array {
                $startedAt = (int) $segment->started_at;
                $endedAt = (int) $segment->ended_at;
                $clampedStartedAt = max($startedAt, $from->timestamp);
                $clampedEndedAt = min($endedAt, $to->timestamp);

                /** @var array<string, mixed> $payload */
                $payload = [
                    'id' => $segment->id,
                    'task_id' => $segment->task_id,
                    'task_name' => $segment->task_name,
                    'project_id' => $segment->project_id,
                    'project_name' => $segment->project_name,
                    'started_at' => $startedAt,
                    'ended_at' => $endedAt,
                    'clamped_started_at' => $clampedStartedAt,
                    'clamped_ended_at' => $clampedEndedAt,
                    'duration_seconds' => max(0, $clampedEndedAt - $clampedStartedAt),
                ];

                if ($includeDetails) {
                    $payload['note'] = $segment->note;
                    $payload['created_by'] = $segment->created_by;
                    $payload['created_by_name'] = $segment->created_by_name;
                }

                return $payload;
            })
            ->filter(static fn (array $segment): bool => $segment['duration_seconds'] > 0)
            ->values();

        return [
            'user_id' => $userId,
            'from' => $from,
            'to' => $to,
            'segments' => $segments,
            'total_seconds' => (int) $segments->sum('duration_seconds'),
        ];
    }
}
