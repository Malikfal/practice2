<?php

namespace Tests\Unit\Imports;

use App\Enums\DataImportRowStatus;
use App\Enums\DataImportStatus;
use App\Enums\DataImportType;
use App\Enums\FinanceType;
use App\Enums\UserPermission;
use App\Models\DataImport;
use App\Models\DataImportRow;
use App\Models\EmployeeRate;
use App\Models\PayrollPayoutOpening;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\PayrollPayoutRepository;
use App\Services\Imports\Processors\EmployeePayrollImportProcessor;
use App\Services\Imports\SpreadsheetReader;
use App\Services\Payroll\Finance\PayrollFinanceArticleService;
use App\Services\Workspace\EmployeePayrollSettingsService;
use App\Services\Workspace\EmployeeRateService;
use App\Services\Workspace\PayrollPayoutService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Mockery;
use ReflectionClass;
use Tests\TestCase;

/**
 * Импорт оплаты труда: ставки идут через EmployeeRateService, статья через настройки
 * оплаты труда сотрудника, остаток через PayrollPayoutService.
 */
class EmployeePayrollImportProcessorTest extends TestCase
{
    private const HEADER = 'Email;ФИО;Дата начала действия;Оклад (неделя);Распределять оклад по часам;Ставка за час;Ставка за часы под контролем;Ставка за часы всей компании;Не учитывать часы как подконтрольные;Продвинутая ставка;Финансовая статья;Остаток к выплате на начало учета';

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-27 09:00:00', 'UTC'));
        Storage::fake('local');
        $this->createSchema();

        DB::table('companies')->insert([
            ['id' => 'c1', 'status' => 'ACTIVE', 'timezone' => 'Europe/Moscow', 'default_salary_finance_article_id' => 'fot'],
            ['id' => 'c2', 'status' => 'ACTIVE', 'timezone' => 'Europe/Moscow', 'default_salary_finance_article_id' => null],
        ]);
        DB::table('finance_article')->insert([
            ['id' => 'fot', 'company_id' => 'c1', 'name' => 'Фонд оплаты труда', 'type' => FinanceType::EXPENDITURE->value, 'parent_id' => null],
            ['id' => 'fot-pm', 'company_id' => 'c1', 'name' => 'ФОТ PM', 'type' => FinanceType::EXPENDITURE->value, 'parent_id' => 'fot'],
            ['id' => 'rent', 'company_id' => 'c1', 'name' => 'Аренда', 'type' => FinanceType::EXPENDITURE->value, 'parent_id' => null],
        ]);
        DB::table('users')->insert([
            ['id' => 'admin', 'company_id' => 'c1', 'client_id' => null, 'name' => 'Анна', 'last_name' => 'Смирнова', 'email' => 'admin@example.com', 'status' => 'ACTIVE'],
            ['id' => 'e1', 'company_id' => 'c1', 'client_id' => null, 'name' => 'Илья', 'last_name' => 'Кузнецов', 'email' => 'ilya@example.com', 'status' => 'ACTIVE'],
            ['id' => 'e2', 'company_id' => 'c1', 'client_id' => null, 'name' => 'Пётр', 'last_name' => 'Петров', 'email' => 'petr@example.com', 'status' => 'ACTIVE'],
            ['id' => 'blocked', 'company_id' => 'c1', 'client_id' => null, 'name' => 'Олег', 'last_name' => 'Архивный', 'email' => 'old@example.com', 'status' => 'BLOCKED'],
            ['id' => 'x1', 'company_id' => 'c2', 'client_id' => null, 'name' => 'Чужой', 'last_name' => 'Сотрудник', 'email' => 'alien@example.com', 'status' => 'ACTIVE'],
        ]);
        DB::table('projects')->insert(['id' => 'p1', 'company_id' => 'c1']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Mockery::close();

        parent::tearDown();
    }

    public function test_imports_rates_article_and_opening_through_existing_services(): void
    {
        // Прежняя ставка с отдельной ставкой по проекту: импорт должен ее сохранить.
        EmployeeRate::query()->create([
            'id' => 'old-rate',
            'employee_id' => 'e1',
            'salary' => null,
            'salary_distribution_scope' => 'OWN',
            'hourly_rate' => 40000,
            'exclude_from_supervised_hours' => true,
            'rate_settings' => ['HOURLY' => [
                'rate_type' => 'HOURLY',
                'is_advanced' => false,
                'project_rates' => [['project_id' => 'p1', 'rate' => 90000]],
            ]],
            'effective_from' => '2026-10-01',
            'changed_by' => 'admin',
        ]);
        DB::table('payroll_payout_settings')->insert(['id' => 's1', 'company_id' => 'c1', 'start_month' => '2026-09']);

        $import = $this->import([
            'ilya@example.com;;01.11.2026;"30 000";;500;;;;"Ставка за час: 0-40 = 500; 40+ = 700,50";Фонд оплаты труда / ФОТ PM;"-1 500,50"',
            ';петров петр;2026-11-02;;Часы под контролем;;300;;Нет;;;',
        ]);

        $this->processor()->process($import);

        $rows = DataImportRow::query()->orderBy('row_number')->get();
        $this->assertSame([DataImportRowStatus::CREATED, DataImportRowStatus::CREATED], $rows->pluck('status')->all(), json_encode($rows->pluck('errors')));

        $rate = EmployeeRate::query()->where('employee_id', 'e1')->whereDate('effective_from', '2026-11-01')->firstOrFail();
        $this->assertSame(3000000, $rate->salary);
        $this->assertSame(50000, $rate->hourly_rate);
        $this->assertNull($rate->supervised_hourly_rate);
        $this->assertSame('admin', $rate->changed_by);
        // Пустые колонки настроек берутся из прежней ставки, как в форме изменения ставки.
        $this->assertSame('OWN', $rate->salary_distribution_scope->value);
        $this->assertTrue($rate->exclude_from_supervised_hours);
        $hourly = $rate->rate_settings['HOURLY'];
        $this->assertTrue($hourly['is_advanced']);
        $this->assertSame(50000, $hourly['default_rate']);
        $this->assertSame('THRESHOLD', $hourly['range_calculation_method']);
        // Часы проходят через JSON, поэтому 40.0 возвращается как 40.
        $this->assertEquals([[0, 40, 50000], [40, null, 70050]], array_map(
            static fn (array $range): array => [$range['from_hours'], $range['to_hours'], $range['rate']],
            $hourly['ranges'],
        ));
        $this->assertSame([['project_id' => 'p1', 'rate' => 90000]], $hourly['project_rates']);
        $this->assertNotEmpty($rows[0]->warnings);
        $this->assertSame((string) $rate->id, $rows[0]->entity_id);

        $this->assertSame(2, EmployeeRate::query()->where('employee_id', 'e1')->count());
        $this->assertSame('fot-pm', User::query()->findOrFail('e1')->salary_finance_article_id);
        $this->assertSame(-150050, PayrollPayoutOpening::query()->where('employee_id', 'e1')->value('amount'));

        $second = EmployeeRate::query()->where('employee_id', 'e2')->firstOrFail();
        $this->assertSame(30000, $second->supervised_hourly_rate);
        $this->assertSame('SUPERVISED', $second->salary_distribution_scope->value);
        $this->assertFalse($second->exclude_from_supervised_hours);
        $this->assertSame('2026-11-02', $second->effective_from->toDateString());
    }

    public function test_same_date_updates_latest_rate_and_earlier_date_is_rejected(): void
    {
        EmployeeRate::query()->create([
            'id' => 'latest',
            'employee_id' => 'e1',
            'hourly_rate' => 40000,
            'effective_from' => '2026-11-01',
            'changed_by' => 'admin',
        ]);

        $import = $this->import([
            'ilya@example.com;;01.11.2026;;;450;;;;;;',
            'ilya@example.com;;15.10.2026;;;460;;;;;;',
        ]);

        $this->processor()->process($import);

        $rows = DataImportRow::query()->orderBy('row_number')->get();
        $this->assertSame(DataImportRowStatus::CREATED, $rows[0]->status);
        $this->assertSame(DataImportRowStatus::FAILED, $rows[1]->status);
        $this->assertArrayHasKey('effective_from', $rows[1]->errors);
        $this->assertSame(1, EmployeeRate::query()->where('employee_id', 'e1')->count());
        $this->assertSame(45000, EmployeeRate::query()->findOrFail('latest')->hourly_rate);
    }

    public function test_invalid_rows_fail_without_partial_changes(): void
    {
        $import = $this->import([
            // Чужая компания и архивный сотрудник не находятся.
            'alien@example.com;;01.11.2026;;;500;;;;;;',
            'old@example.com;;01.11.2026;;;500;;;;;;',
            // Продвинутая ставка без стандартной ставки в своей колонке.
            'ilya@example.com;;01.11.2026;;;;300;;;Ставка за час: 0-40 = 500; 40+ = 700;;',
            // Статья вне фонда оплаты труда.
            'ilya@example.com;;01.11.2026;;;500;;;;;Аренда;',
            // Ставка без даты начала действия.
            'ilya@example.com;;;;;500;;;;;;',
            // Остаток без права управления финансами откатывает и ставку.
            'petr@example.com;;01.11.2026;;;500;;;;;;10000',
        ]);

        $this->processor(canManageFinance: false)->process($import);

        $rows = DataImportRow::query()->orderBy('row_number')->get();
        $this->assertSame(array_fill(0, 6, DataImportRowStatus::FAILED), $rows->pluck('status')->all());
        $this->assertArrayHasKey('email', $rows[0]->errors);
        $this->assertArrayHasKey('email', $rows[1]->errors);
        $this->assertArrayHasKey('advanced', $rows[2]->errors);
        $this->assertArrayHasKey('finance_article', $rows[3]->errors);
        $this->assertArrayHasKey('effective_from', $rows[4]->errors);
        $this->assertArrayHasKey('opening_balance', $rows[5]->errors);
        $this->assertSame(0, EmployeeRate::query()->count());
        $this->assertSame(0, PayrollPayoutOpening::query()->count());
    }

    public function test_advanced_rate_syntax(): void
    {
        $processor = (new ReflectionClass(EmployeePayrollImportProcessor::class))->newInstanceWithoutConstructor();
        $method = (new ReflectionClass($processor))->getMethod('advancedSettings');

        $settings = $method->invoke($processor, "Оклад: 0-160 = 50 000; 160+ = 60000\nСтавка за часы под контролем (прогрессивно): 0-10,5 = 100; 10,5+ = 150");
        $this->assertSame(['WEEKLY_SALARY', 'SUPERVISED_HOURLY'], array_keys($settings));
        $this->assertSame('THRESHOLD', $settings['WEEKLY_SALARY']['range_calculation_method']);
        $this->assertSame(5000000, $settings['WEEKLY_SALARY']['ranges'][0]['rate']);
        $this->assertSame('PROGRESSIVE', $settings['SUPERVISED_HOURLY']['range_calculation_method']);
        $this->assertSame(10.5, $settings['SUPERVISED_HOURLY']['ranges'][0]['to_hours']);
        $this->assertSame([], $method->invoke($processor, null));

        $this->expectException(ValidationException::class);
        $method->invoke($processor, 'Ставка за час: от 0 до 40 по 500');
    }

    /**
     * Процессор с инициатором-заглушкой: права проверяются через can(), как в боевом коде.
     */
    private function processor(bool $canManageFinance = true): EmployeePayrollImportProcessor
    {
        $actor = Mockery::mock(User::class)->makePartial();
        $actor->forceFill(['id' => 'admin', 'company_id' => 'c1', 'status' => 'ACTIVE']);
        $actor->shouldReceive('can')->andReturnUsing(
            static fn (string $permission): bool => $permission !== UserPermission::FINANCE_MANAGE->value || $canManageFinance,
        );

        $processor = new class(app(SpreadsheetReader::class), app(EmployeeRateService::class), app(EmployeePayrollSettingsService::class), app(PayrollFinanceArticleService::class), app(PayrollPayoutService::class), app(PayrollPayoutRepository::class)) extends EmployeePayrollImportProcessor
        {
            public User $testActor;

            protected function actor(DataImport $import): User
            {
                return $this->testActor;
            }
        };
        $processor->testActor = $actor;

        return $processor;
    }

    /** @param  array<int, string>  $lines */
    private function import(array $lines): DataImport
    {
        $path = 'imports/payroll.csv';
        Storage::disk('local')->put($path, "\xEF\xBB\xBF".implode("\r\n", [self::HEADER, ...$lines]));

        return DataImport::query()->create([
            'id' => '00000000-0000-4000-8000-000000000001',
            'company_id' => 'c1',
            'created_by_id' => 'admin',
            'type' => DataImportType::EMPLOYEE_PAYROLL,
            'status' => DataImportStatus::PARSING,
            'disk' => 'local',
            'path' => $path,
            'original_name' => 'payroll.csv',
            'extension' => 'csv',
            'file_size' => 1,
        ]);
    }

    private function createSchema(): void
    {
        Schema::create('companies', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('status');
            $table->string('timezone')->nullable();
            $table->string('default_salary_finance_article_id')->nullable();
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('client_id')->nullable();
            $table->string('salary_finance_article_id')->nullable();
            $table->string('name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
            $table->string('role')->nullable();
            $table->string('status');
            $table->date('archived_at')->nullable();
            $table->timestamps();
        });
        Schema::create('finance_article', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->string('type');
            $table->string('parent_id')->nullable();
            $table->timestamps();
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->timestamps();
        });
        Schema::create('employee_rates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('employee_id');
            $table->unsignedBigInteger('salary')->nullable();
            $table->string('salary_distribution_scope')->default('COMPANY');
            $table->unsignedBigInteger('hourly_rate')->nullable();
            $table->unsignedBigInteger('supervised_hourly_rate')->nullable();
            $table->unsignedBigInteger('company_hourly_rate')->nullable();
            $table->boolean('exclude_from_supervised_hours')->default(false);
            $table->json('rate_settings')->nullable();
            $table->date('effective_from');
            $table->string('changed_by');
            $table->timestamps();
            $table->unique(['employee_id', 'effective_from']);
        });

        // Таблицы импорта и выплат создаются боевыми миграциями.
        (require database_path('migrations/2026_06_19_130000_create_data_import_tables.php'))->up();
        (require database_path('migrations/2026_10_14_120000_create_payroll_payout_tables.php'))->up();
    }
}
