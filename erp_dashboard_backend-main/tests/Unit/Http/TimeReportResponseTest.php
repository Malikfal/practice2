<?php

namespace Tests\Unit\Http;

use App\Http\Responses\Workspace\TimeReportResponse;
use Carbon\Carbon;
use Tests\TestCase;

class TimeReportResponseTest extends TestCase
{
    public function test_response_exposes_plural_filters_and_own_hours(): void
    {
        $response = new TimeReportResponse([
            'group_by' => 'project',
            'from' => Carbon::parse('2026-07-01', 'Europe/Moscow'),
            'to' => Carbon::parse('2026-07-31', 'Europe/Moscow'),
            'project_ids' => ['project-1'],
            'task_ids' => [],
            'user_ids' => ['user-1'],
            'project_kinds' => ['internal'],
            'manager_ids' => ['manager-1'],
            'rows' => collect([[
                'project_id' => 'project-1',
                'project_name' => 'Project',
                'own_seconds' => 3600,
            ]]),
            'own_seconds' => 3600,
        ]);

        $payload = $response->getData(true);

        $this->assertArrayNotHasKey('project_id', $payload);
        $this->assertArrayNotHasKey('task_id', $payload);
        $this->assertArrayNotHasKey('user_id', $payload);
        $this->assertSame(['project-1'], $payload['project_ids']);
        $this->assertSame(['internal'], $payload['project_kinds']);
        $this->assertSame(['manager-1'], $payload['manager_ids']);
        $this->assertSame(3600, $payload['own_seconds']);
        $this->assertArrayNotHasKey('supervised_seconds', $payload);
        $this->assertArrayNotHasKey('total_seconds', $payload);
        $this->assertArrayNotHasKey('timezone', $payload);
        $this->assertArrayNotHasKey('supervised_seconds', $payload['rows'][0]);
        $this->assertArrayNotHasKey('total_seconds', $payload['rows'][0]);
    }
}
