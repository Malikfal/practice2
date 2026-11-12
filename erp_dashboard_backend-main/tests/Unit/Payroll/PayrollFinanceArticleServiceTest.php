<?php

namespace Tests\Unit\Payroll;

use App\Enums\FinanceType;
use App\Models\Company;
use App\Models\User;
use App\Services\Payroll\Finance\PayrollFinanceArticleService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PayrollFinanceArticleServiceTest extends TestCase
{
    /**
     * Создает минимальную таблицу статей для проверки иерархии.
     */
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('finance_article', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('parent_id')->nullable();
            $table->string('name');
            $table->string('type');
            $table->timestamps();
        });
    }

    /**
     * Удаляет созданную тестовую таблицу.
     */
    protected function tearDown(): void
    {
        Schema::dropIfExists('finance_article');

        parent::tearDown();
    }

    /**
     * Проверяет выбор дефолтной статьи и потомка произвольной глубины.
     */
    public function test_default_article_and_nested_descendants_are_selectable(): void
    {
        $this->insertArticle('root', null);
        $this->insertArticle('child', 'root');
        $this->insertArticle('grandchild', 'child');
        $this->insertArticle('sibling', null);

        $company = (new Company)->forceFill([
            'id' => 'company',
            'default_salary_finance_article_id' => 'root',
        ]);
        $service = new PayrollFinanceArticleService;

        $this->assertTrue($service->isSelectable($company, 'root'));
        $this->assertTrue($service->isSelectable($company, 'grandchild'));
        $this->assertFalse($service->isSelectable($company, 'sibling'));
    }

    /**
     * Проверяет откат к статье компании при пустой или недоступной статье сотрудника.
     */
    public function test_resolver_falls_back_to_company_article(): void
    {
        $this->insertArticle('root', null);
        $this->insertArticle('outside', null);

        $company = (new Company)->forceFill([
            'id' => 'company',
            'default_salary_finance_article_id' => 'root',
        ]);
        $employee = (new User)->forceFill([
            'id' => 'employee',
            'salary_finance_article_id' => 'outside',
        ]);

        $this->assertSame('root', (new PayrollFinanceArticleService)->resolveId($company, $employee));
    }

    /**
     * Добавляет финансовую статью в тестовую иерархию.
     */
    private function insertArticle(string $id, ?string $parentId): void
    {
        DB::table('finance_article')->insert([
            'id' => $id,
            'company_id' => 'company',
            'parent_id' => $parentId,
            'name' => $id,
            'type' => FinanceType::EXPENDITURE->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
