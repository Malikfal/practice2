<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Repositories\Workspace\FinancialResultRepositories\FinancialResultRepository;
use App\Services\Workspace\FinancialResultServices\FinancialResultFilterService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FinancialResultRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('finance_article', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('parent_id')->nullable();
            $table->string('name');
            $table->string('type');
            $table->string('distribution_method')->nullable();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
        });
        Schema::create('finance', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('project_id')->nullable();
            $table->string('finance_article_id')->nullable();
            $table->string('employee_id')->nullable();
            $table->unsignedBigInteger('amount');
            $table->string('type');
            $table->string('source');
            $table->date('dateOfPayment');
            $table->date('distribution_from')->nullable();
            $table->date('distribution_to')->nullable();
        });

        DB::table('finance_article')->insert([
            ['id' => 'parent', 'company_id' => 'company', 'parent_id' => null, 'name' => 'Родитель', 'type' => FinanceType::EXPENDITURE->value],
            ['id' => 'child', 'company_id' => 'company', 'parent_id' => 'parent', 'name' => 'Потомок', 'type' => FinanceType::EXPENDITURE->value],
        ]);
        DB::table('users')->insert(['id' => 'employee', 'name' => 'Анна']);
        DB::table('finance')->insert([
            $this->row('included', 'project', 'parent', 'employee', FinanceSource::MANUAL, '2026-09-03'),
            $this->row('child-article', 'project', 'child', 'employee', FinanceSource::MANUAL, '2026-09-03'),
            $this->row('wrong-source', 'project', 'parent', 'employee', FinanceSource::IMPORT, '2026-09-03'),
            $this->row('outside-period', 'project', 'parent', 'employee', FinanceSource::MANUAL, '2026-10-03'),
            $this->row('without-project', null, 'parent', 'employee', FinanceSource::MANUAL, '2026-09-03'),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('finance');
        Schema::dropIfExists('users');
        Schema::dropIfExists('finance_article');
        parent::tearDown();
    }

    public function test_finances_use_payment_date_and_exact_operation_filters(): void
    {
        $filters = (new FinancialResultFilterService)->fromArray([
            'from' => '2026-09-01',
            'to' => '2026-09-30',
            'finance_article_ids' => ['parent'],
            'sources' => [FinanceSource::MANUAL->value],
            'employee_ids' => ['employee'],
        ]);
        $rows = (new FinancialResultRepository)->finances('company', $filters, collect(['project']));

        $this->assertSame(['included', 'without-project'], $rows->pluck('id')->all());
        $this->assertSame('2030-01-01', DB::table('finance')->where('id', 'included')->value('distribution_from'));
    }

    public function test_project_filter_excludes_finances_without_project(): void
    {
        $filters = (new FinancialResultFilterService)->fromArray([
            'from' => '2026-09-01',
            'to' => '2026-09-30',
            'project_ids' => ['project'],
        ]);

        $rows = (new FinancialResultRepository)->finances('company', $filters, collect(['project']));

        $this->assertNotContains('without-project', $rows->pluck('id')->all());
    }

    public function test_default_period_includes_finances_without_project(): void
    {
        DB::table('finance')->whereNotNull('project_id')->delete();
        DB::table('finance')->where('id', 'without-project')->update(['dateOfPayment' => '2020-01-01']);

        [$from, $to] = (new FinancialResultRepository)->periodBounds('company', 'Europe/Moscow');

        $this->assertSame('2020-01-01', $from->toDateString());
        $this->assertSame('2020-01-01', $to->toDateString());
    }

    /** @return array<string, mixed> */
    private function row(
        string $id,
        ?string $projectId,
        string $articleId,
        string $employeeId,
        FinanceSource $source,
        string $paymentDate,
    ): array {
        return [
            'id' => $id,
            'company_id' => 'company',
            'project_id' => $projectId,
            'finance_article_id' => $articleId,
            'employee_id' => $employeeId,
            'amount' => 100,
            'type' => FinanceType::EXPENDITURE->value,
            'source' => $source->value,
            'dateOfPayment' => $paymentDate,
            // Если репозиторий ошибочно применит аналитический период, строка included исчезнет.
            'distribution_from' => '2030-01-01',
            'distribution_to' => '2030-12-31',
        ];
    }
}
