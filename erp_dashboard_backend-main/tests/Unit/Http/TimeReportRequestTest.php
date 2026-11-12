<?php

namespace Tests\Unit\Http;

use App\Http\Requests\Workspace\TimeReportRequest;
use Tests\TestCase;

class TimeReportRequestTest extends TestCase
{
    public function test_only_plural_id_filters_are_part_of_the_contract(): void
    {
        $rules = (new TimeReportRequest)->rules();

        $this->assertArrayHasKey('project_ids', $rules);
        $this->assertArrayHasKey('task_ids', $rules);
        $this->assertArrayHasKey('user_ids', $rules);
        $this->assertArrayNotHasKey('project_id', $rules);
        $this->assertArrayNotHasKey('task_id', $rules);
        $this->assertArrayNotHasKey('user_id', $rules);
        $this->assertContains('distinct', $rules['project_ids.*']);
        $this->assertContains('uuid', $rules['project_ids.*']);
        $this->assertContains('before_or_equal:to', $rules['from']);
        $this->assertContains('after_or_equal:from', $rules['to']);
        $this->assertArrayHasKey('project_kinds.*', $rules);
        $this->assertContains('uuid', $rules['manager_ids.*']);
    }

    public function test_normalization_does_not_restore_singular_ids_or_hide_invalid_array_types(): void
    {
        $request = new class extends TimeReportRequest
        {
            public function prepare(): void
            {
                $this->prepareForValidation();
            }
        };
        $request->initialize([
            'project_id' => '5b88b5e6-4270-4f6f-88c0-48429aef55ca',
            'project_ids' => 123,
        ]);

        $request->prepare();

        $this->assertSame(123, $request->input('project_ids'));
        $this->assertSame([], $request->input('task_ids'));
        $this->assertSame([], $request->input('user_ids'));
    }
}
