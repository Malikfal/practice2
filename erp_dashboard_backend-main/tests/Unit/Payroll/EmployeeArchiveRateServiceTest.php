<?php

namespace Tests\Unit\Payroll;

use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Services\Payroll\EmployeeArchiveRateService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmployeeArchiveRateServiceTest extends TestCase
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
            $table->uuid('company_id');
            $table->string('status')->default('ACTIVE');
            $table->timestamps();
        });
        Schema::create('employee_rates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->unsignedBigInteger('salary')->nullable();
            $table->string('salary_distribution_scope')->default('COMPANY');
            $table->unsignedBigInteger('hourly_rate')->nullable();
            $table->unsignedBigInteger('supervised_hourly_rate')->nullable();
            $table->unsignedBigInteger('company_hourly_rate')->nullable();
            $table->boolean('exclude_from_supervised_hours')->default(false);
            $table->json('rate_settings')->nullable();
            $table->date('effective_from');
            $table->uuid('changed_by');
            $table->timestamps();
            $table->unique(['employee_id', 'effective_from']);
        });

        Company::query()->create(['id' => 'company', 'timezone' => 'Asia/Yekaterinburg']);
        User::query()->create(['id' => 'admin', 'company_id' => 'company', 'status' => 'ACTIVE']);
        User::query()->create(['id' => 'employee', 'company_id' => 'company', 'status' => 'ACTIVE']);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('employee_rates');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');

        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_archive_creates_today_rate_and_zeroes_passive_rates(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01 19:30:00', 'UTC'));
        EmployeeRate::query()->create([
            'id' => 'base-rate',
            'employee_id' => 'employee',
            'salary' => 1_000,
            'salary_distribution_scope' => 'COMPANY',
            'hourly_rate' => 2_000,
            'supervised_hourly_rate' => 3_000,
            'company_hourly_rate' => 4_000,
            'exclude_from_supervised_hours' => false,
            'rate_settings' => ['legacy' => ['default_rate' => 5_000]],
            'effective_from' => '2026-08-01',
            'changed_by' => 'admin',
        ]);

        $archiveRate = (new EmployeeArchiveRateService)->archive(
            User::query()->findOrFail('employee'),
            User::query()->findOrFail('admin'),
        );

        $this->assertSame('2026-09-02', $archiveRate->effective_from->toDateString());
        $this->assertNull($archiveRate->salary);
        $this->assertSame(2_000, $archiveRate->hourly_rate);
        $this->assertNull($archiveRate->supervised_hourly_rate);
        $this->assertNull($archiveRate->company_hourly_rate);
        $this->assertNull($archiveRate->rate_settings);
    }
}
