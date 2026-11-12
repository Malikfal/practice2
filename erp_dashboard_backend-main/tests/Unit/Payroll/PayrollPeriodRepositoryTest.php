<?php

namespace Tests\Unit\Payroll;

use App\Models\Company;
use App\Repositories\Workspace\PayrollRepositories\PayrollPeriodRepository;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PayrollPeriodRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
        });
        Schema::create('employee_rates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->date('effective_from');
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
        });
        Schema::create('project_assignment_histories', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('project_id');
            $table->boolean('is_pm');
            $table->date('started_on');
            $table->date('ended_on')->nullable();
        });

        DB::table('projects')->insert([
            ['id' => 'project-a', 'company_id' => 'company'],
            ['id' => 'project-b', 'company_id' => 'company'],
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('project_assignment_histories');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('employee_rates');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_supervised_slices_are_sorted_and_deduplicated_after_assignment_boundaries_are_added(): void
    {
        DB::table('project_assignment_histories')->insert([
            [
                'id' => 'assignment-1',
                'project_id' => 'project-a',
                'is_pm' => true,
                'started_on' => '2026-04-20',
                'ended_on' => '2026-09-10',
            ],
            [
                'id' => 'assignment-2',
                'project_id' => 'project-b',
                'is_pm' => true,
                'started_on' => '2026-04-20',
                'ended_on' => '2026-09-08',
            ],
            [
                'id' => 'assignment-3',
                'project_id' => 'project-a',
                'is_pm' => true,
                'started_on' => '2026-09-10',
                'ended_on' => null,
            ],
            [
                'id' => 'assignment-4',
                'project_id' => 'project-b',
                'is_pm' => true,
                'started_on' => '2026-09-08',
                'ended_on' => null,
            ],
        ]);

        $company = new Company;
        $company->id = 'company';

        $slices = app(PayrollPeriodRepository::class)->supervisedSlices(
            $company,
            Carbon::parse('2026-09-07 00:00:00', 'Europe/Moscow'),
            Carbon::parse('2026-09-14 00:00:00', 'Europe/Moscow'),
        );

        $this->assertSame([
            ['from' => '2026-09-07', 'to' => '2026-09-08'],
            ['from' => '2026-09-08', 'to' => '2026-09-10'],
            ['from' => '2026-09-10', 'to' => '2026-09-14'],
        ], $slices->map(static fn (array $slice): array => [
            'from' => $slice['from']->toDateString(),
            'to' => $slice['to']->toDateString(),
        ])->all());
    }
}
