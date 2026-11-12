<?php

namespace Tests\Unit\Workspace;

use App\Models\Company;
use App\Models\Project;
use App\Models\ProjectAssignmentHistory;
use App\Models\ProjectMember;
use App\Models\User;
use App\Repositories\Workspace\ProjectAssignmentHistoryRepository;
use App\Services\Workspace\ProjectAssignmentHistoryService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ProjectAssignmentHistoryRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('timezone')->default('Europe/Moscow');
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('name')->default('Employee');
            $table->string('last_name')->default('');
            $table->string('email')->nullable();
            $table->string('status')->default('ACTIVE');
            $table->timestamps();
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('name');
            $table->timestamps();
        });
        Schema::create('project_members', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('project_id');
            $table->uuid('user_id');
            $table->boolean('is_pm')->default(false);
            $table->boolean('is_pm_payroll_enabled')->default(false);
        });
        Schema::create('project_assignment_histories', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('project_id');
            $table->uuid('user_id');
            $table->boolean('is_pm');
            $table->boolean('is_pm_payroll_enabled');
            $table->date('started_on');
            $table->date('ended_on')->nullable();
            $table->timestamps();
        });

        Company::query()->create(['id' => 'company', 'timezone' => 'Asia/Yekaterinburg']);
        User::query()->create(['id' => 'employee', 'company_id' => 'company']);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('project_assignment_histories');
        Schema::dropIfExists('project_members');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_changes_create_non_overlapping_history_and_archive_removes_current_assignment(): void
    {
        $history = new ProjectAssignmentHistoryRepository;
        $member = ProjectMember::query()->create([
            'id' => 'member',
            'project_id' => 'project',
            'user_id' => 'employee',
            'is_pm' => false,
            'is_pm_payroll_enabled' => false,
        ]);

        $history->sync($member, Carbon::parse('2026-09-01'));

        $member->update(['is_pm' => true, 'is_pm_payroll_enabled' => true]);
        $history->sync($member, Carbon::parse('2026-09-08'));

        Carbon::setTestNow('2026-09-15 12:00:00');
        $history->closeAllForUser(
            User::query()->findOrFail('employee'),
            Carbon::parse('2026-09-15'),
        );

        $periods = ProjectAssignmentHistory::query()->orderBy('started_on')->get();

        $this->assertCount(2, $periods);
        $this->assertSame('2026-09-01', $periods[0]->started_on->toDateString());
        $this->assertSame('2026-09-08', $periods[0]->ended_on->toDateString());
        $this->assertFalse($periods[0]->is_pm);
        $this->assertSame('2026-09-08', $periods[1]->started_on->toDateString());
        $this->assertSame('2026-09-15', $periods[1]->ended_on->toDateString());
        $this->assertTrue($periods[1]->is_pm);
        $this->assertDatabaseMissing('project_members', ['id' => 'member']);
    }

    public function test_default_assignment_date_uses_payroll_timezone(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01 19:30:00', 'UTC'));
        Project::query()->create([
            'id' => 'project',
            'company_id' => 'company',
            'name' => 'Project',
        ]);
        $member = ProjectMember::query()->create([
            'id' => 'member',
            'project_id' => 'project',
            'user_id' => 'employee',
            'is_pm' => false,
            'is_pm_payroll_enabled' => false,
        ]);

        (new ProjectAssignmentHistoryRepository)->sync($member);

        $this->assertDatabaseHas('project_assignment_histories', [
            'project_id' => 'project',
            'user_id' => 'employee',
            'started_on' => '2026-09-02 00:00:00',
        ]);
    }

    public function test_manual_closed_period_may_touch_but_not_overlap_an_existing_period(): void
    {
        Carbon::setTestNow('2026-09-15 12:00:00');
        $project = $this->projectCreatedOn('2026-09-01 10:00:00');
        ProjectAssignmentHistory::query()->create([
            'id' => 'existing',
            'project_id' => $project->id,
            'user_id' => 'employee',
            'is_pm' => false,
            'is_pm_payroll_enabled' => false,
            'started_on' => '2026-09-01',
            'ended_on' => '2026-09-05',
        ]);

        $service = new ProjectAssignmentHistoryService;
        $created = $service->store([
            'project_id' => $project->id,
            'user_id' => 'employee',
            'started_on' => '2026-09-05',
            'ended_on' => '2026-09-15',
            'is_pm' => true,
            'is_pm_payroll_enabled' => true,
        ]);

        $this->assertSame('2026-09-05', $created->started_on->toDateString());
        $this->assertSame('2026-09-15', $created->ended_on->toDateString());
        $this->assertTrue($created->is_pm_payroll_enabled);

        $this->expectException(ValidationException::class);
        $service->store([
            'project_id' => $project->id,
            'user_id' => 'employee',
            'started_on' => '2026-09-04',
            'ended_on' => '2026-09-06',
        ]);
    }

    public function test_manual_period_cannot_start_before_project_or_be_created_for_today(): void
    {
        Carbon::setTestNow('2026-09-15 12:00:00');
        $project = $this->projectCreatedOn('2026-09-10 10:00:00');
        $service = new ProjectAssignmentHistoryService;

        try {
            $service->store([
                'project_id' => $project->id,
                'user_id' => 'employee',
                'started_on' => '2026-09-09',
                'ended_on' => '2026-09-11',
            ]);
            $this->fail('Expected project creation date validation error.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('started_on', $exception->errors());
        }

        $this->expectException(ValidationException::class);
        $service->store([
            'project_id' => $project->id,
            'user_id' => 'employee',
            'started_on' => '2026-09-15',
            'ended_on' => '2026-09-16',
        ]);
    }

    public function test_open_period_cannot_be_updated_or_deleted(): void
    {
        Carbon::setTestNow('2026-09-15 12:00:00');
        $project = $this->projectCreatedOn('2026-09-01 10:00:00');
        $open = ProjectAssignmentHistory::query()->create([
            'id' => 'open',
            'project_id' => $project->id,
            'user_id' => 'employee',
            'is_pm' => false,
            'is_pm_payroll_enabled' => false,
            'started_on' => '2026-09-05',
            'ended_on' => null,
        ]);
        $service = new ProjectAssignmentHistoryService;

        try {
            $service->update($open, ['started_on' => '2026-09-06']);
            $this->fail('Expected open assignment update validation error.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('assignment', $exception->errors());
        }

        $this->expectException(ValidationException::class);
        $service->destroy($open);
    }

    public function test_closed_period_can_be_updated_and_deleted(): void
    {
        Carbon::setTestNow('2026-09-15 12:00:00');
        $project = $this->projectCreatedOn('2026-09-01 10:00:00');
        $closed = ProjectAssignmentHistory::query()->create([
            'id' => 'closed',
            'project_id' => $project->id,
            'user_id' => 'employee',
            'is_pm' => false,
            'is_pm_payroll_enabled' => false,
            'started_on' => '2026-09-02',
            'ended_on' => '2026-09-05',
        ]);
        $service = new ProjectAssignmentHistoryService;

        $updated = $service->update($closed, [
            'started_on' => '2026-09-03',
            'ended_on' => '2026-09-08',
            'is_pm' => true,
            'is_pm_payroll_enabled' => true,
        ]);
        $this->assertSame('2026-09-08', $updated->ended_on->toDateString());
        $this->assertTrue($updated->is_pm_payroll_enabled);

        $service->destroy($updated);
        $this->assertDatabaseMissing('project_assignment_histories', ['id' => 'closed']);
    }

    private function projectCreatedOn(string $createdAt): Project
    {
        $project = Project::query()->create([
            'id' => 'project',
            'company_id' => 'company',
            'name' => 'Project',
        ]);
        $project->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();

        return $project->fresh();
    }
}
