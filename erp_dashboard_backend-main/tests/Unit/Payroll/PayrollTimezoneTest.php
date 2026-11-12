<?php

namespace Tests\Unit\Payroll;

use App\Jobs\Payroll\RecalculateCompanyPayrollPeriodJob;
use App\Models\Company;
use App\Services\Payroll\Period\PayrollPeriod;
use App\Services\Payroll\Recalculation\CompanyPayrollRecalculationService;
use App\Services\Payroll\Recalculation\Data\PayrollRecalculationResult;
use App\Services\Workspace\PayrollRecalculationService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use ReflectionMethod;
use Tests\TestCase;

class PayrollTimezoneTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Schema::dropIfExists('payroll_recalculations');
        Schema::dropIfExists('companies');

        parent::tearDown();
    }

    public function test_api_period_validation_uses_payroll_timezone(): void
    {
        config()->set('payroll.timezone', 'Europe/Moscow');
        config()->set('app.timezone', 'Europe/Moscow');
        Carbon::setTestNow(Carbon::parse('2026-09-06 21:30:00', 'UTC'));

        $method = new ReflectionMethod(PayrollRecalculationService::class, 'period');
        $company = new Company(['timezone' => 'Europe/Moscow']);
        $period = $method->invoke(new PayrollRecalculationService, $company, '2026-09-01', '2026-09-06');

        $this->assertSame('2026-09-01', $period->from->toDateString());
        $this->assertSame('2026-09-06', $period->paymentDate()->toDateString());
        $this->assertSame('Europe/Moscow', $period->from->timezoneName);
    }

    public function test_company_uses_payroll_timezone_when_its_timezone_is_not_set(): void
    {
        config()->set('app.timezone', 'UTC');
        config()->set('payroll.timezone', 'Europe/Moscow');

        $company = new Company(['timezone' => null]);

        $this->assertSame('Europe/Moscow', $company->payrollTimezone());
    }

    public function test_queued_recalculation_rebuilds_period_in_payroll_timezone(): void
    {
        config()->set('payroll.timezone', 'Europe/Moscow');
        config()->set('app.timezone', 'Europe/Moscow');
        $this->createJobTables();

        DB::table('companies')->insert([
            'id' => 'company',
            'status' => 'ACTIVE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('payroll_recalculations')->insert([
            'id' => 'recalculation',
            'company_id' => 'company',
            'period_from' => '2026-09-01',
            'period_to' => '2026-09-06',
            'status' => 'QUEUED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $capturedPeriod = null;
        $recalculations = Mockery::mock(CompanyPayrollRecalculationService::class);
        $recalculations->shouldReceive('recalculate')
            ->once()
            ->andReturnUsing(static function (object $company, PayrollPeriod $period) use (&$capturedPeriod): PayrollRecalculationResult {
                $capturedPeriod = $period;

                return new PayrollRecalculationResult($period, 0, 0, 0, 0);
            });

        (new RecalculateCompanyPayrollPeriodJob('recalculation'))->handle($recalculations);

        $this->assertSame('2026-09-01', $capturedPeriod?->from->toDateString());
        $this->assertSame('2026-09-06', $capturedPeriod?->paymentDate()->toDateString());
        $this->assertSame('Europe/Moscow', $capturedPeriod?->from->timezoneName);
        $this->assertSame('COMPLETED', DB::table('payroll_recalculations')->value('status'));
    }

    private function createJobTables(): void
    {
        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status');
            $table->timestamps();
        });
        Schema::create('payroll_recalculations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('requested_by')->nullable();
            $table->date('period_from');
            $table->date('period_to');
            $table->string('status');
            $table->text('error_message')->nullable();
            $table->dateTime('started_at')->nullable();
            $table->dateTime('finished_at')->nullable();
            $table->timestamps();
        });
    }
}
