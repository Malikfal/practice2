<?php

namespace Tests\Unit\Http;

use App\Http\Requests\Workspace\StaleTasksReportRequest;
use Tests\TestCase;

class StaleTasksReportRequestTest extends TestCase
{
    public function test_filters_of_time_report_without_period_and_grouping_plus_status_names(): void
    {
        $rules = (new StaleTasksReportRequest)->rules();

        $this->assertArrayNotHasKey('from', $rules);
        $this->assertArrayNotHasKey('to', $rules);
        $this->assertArrayNotHasKey('group_by', $rules);
        foreach (['project_ids.*', 'task_ids.*', 'user_ids.*', 'project_kinds.*', 'manager_ids.*', 'status_names.*'] as $key) {
            $this->assertArrayHasKey($key, $rules);
        }
        $this->assertContains('distinct', $rules['status_names.*']);
    }

    public function test_status_names_are_trimmed_and_single_value_becomes_list(): void
    {
        $request = new class extends StaleTasksReportRequest
        {
            public function prepare(): void
            {
                $this->prepareForValidation();
            }
        };

        $request->initialize(['status_names' => ' В работе ']);
        $request->prepare();
        $this->assertSame(['В работе'], $request->input('status_names'));

        $request->initialize(['status_names' => ['Сделать', '  ', 'Ревью']]);
        $request->prepare();
        $this->assertSame(['Сделать', 'Ревью'], $request->input('status_names'));
        $this->assertSame([], $request->input('project_ids'));
    }
}
