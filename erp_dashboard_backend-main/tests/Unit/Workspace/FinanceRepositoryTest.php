<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Repositories\Workspace\FinanceRepository;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FinanceRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('client_id')->nullable();
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
        });

        DB::table('projects')->insert([
            ['id' => 'project', 'company_id' => 'company', 'client_id' => 'client'],
            ['id' => 'other-project', 'company_id' => 'company', 'client_id' => 'other-client'],
        ]);
        DB::table('finance')->insert([
            $this->row('income', 100, FinanceType::ENTRANCE),
            $this->row('expense', 40, FinanceType::EXPENDITURE),
            $this->row('outside-period', 200, FinanceType::ENTRANCE, date: '2026-10-01'),
            $this->row('outside-company', 300, FinanceType::ENTRANCE, companyId: 'other-company'),
            $this->row('other-project', 400, FinanceType::EXPENDITURE, projectId: 'other-project'),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('finance');
        Schema::dropIfExists('projects');
        parent::tearDown();
    }

    public function test_summary_uses_all_index_filters_without_pagination(): void
    {
        $summary = (new FinanceRepository)->summary('company', [
            'from' => '2026-09-01',
            'to' => '2026-09-30',
            'sources' => [FinanceSource::MANUAL->value],
            'finance_article_ids' => ['article'],
            'project_ids' => ['project'],
            'client_ids' => ['client'],
            'employee_ids' => ['employee'],
            'amount_from' => 40,
            'amount_to' => 100,
            'per_page' => 20,
        ]);

        $this->assertSame([
            'income' => 100,
            'expenses' => 40,
            'profit' => 60,
        ], $summary);
    }

    public function test_summary_applies_type_filter(): void
    {
        $summary = (new FinanceRepository)->summary('company', [
            'type' => FinanceType::EXPENDITURE->value,
            'project_ids' => ['project'],
        ]);

        $this->assertSame([
            'income' => 0,
            'expenses' => 40,
            'profit' => -40,
        ], $summary);
    }

    /** @return array<string, mixed> */
    private function row(
        string $id,
        int $amount,
        FinanceType $type,
        string $date = '2026-09-15',
        string $companyId = 'company',
        string $projectId = 'project',
    ): array {
        return [
            'id' => $id,
            'company_id' => $companyId,
            'project_id' => $projectId,
            'finance_article_id' => 'article',
            'employee_id' => 'employee',
            'amount' => $amount,
            'type' => $type->value,
            'source' => FinanceSource::MANUAL->value,
            'dateOfPayment' => $date,
        ];
    }
}
