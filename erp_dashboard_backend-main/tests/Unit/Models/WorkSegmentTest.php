<?php

namespace Tests\Unit\Models;

use App\Models\WorkSegment;
use Tests\TestCase;

class WorkSegmentTest extends TestCase
{
    public function test_user_relation_includes_blocked_users(): void
    {
        $segment = new WorkSegment(['user_id' => 'archived-user-id']);

        $sql = $segment->user()->toSql();

        $this->assertStringNotContainsString('status', $sql);
    }
}
