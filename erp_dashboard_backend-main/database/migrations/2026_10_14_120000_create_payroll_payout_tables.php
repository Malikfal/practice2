<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_payout_settings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('start_month', 7)->comment('Месяц начала учета выплат в формате ГГГГ-ММ');
            $table->timestamps();
            $table->comment('Настройки учета выплат ФОТ. Начисления и выплаты до месяца начала учета в задолженность не входят.');
        });

        Schema::create('payroll_payout_articles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->timestamp('archived_at')->nullable()->comment('Статья с выплатами не удаляется, а уходит в архив');
            $table->timestamps();
            $table->comment('Статьи выплаты ФОТ: основания выплат сотрудникам. В ОФР и аналитику не попадают.');

            $table->index('company_id', 'payroll_payout_articles_company_idx');
        });

        Schema::create('payroll_payouts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('users')->cascadeOnDelete();
            $table->string('period_month', 7)->comment('Месяц ведомости, к которому относится выплата, в формате ГГГГ-ММ');
            $table->string('kind', 16)->comment('ADVANCE - аванс, SETTLEMENT - расчет');
            $table->unsignedBigInteger('amount')->comment('Сумма выплаты в копейках');
            $table->date('paid_at')->comment('Дата выплаты, может не совпадать с месяцем ведомости');
            $table->foreignUuid('payroll_payout_article_id')->constrained('payroll_payout_articles');
            $table->text('comment')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->comment('Фактические выплаты сотрудникам по ведомости. Хранятся отдельно от finance, чтобы не задваивать расход.');

            $table->index(['company_id', 'period_month'], 'payroll_payouts_period_idx');
            $table->index(['company_id', 'employee_id'], 'payroll_payouts_employee_idx');
        });

        Schema::create('payroll_payout_plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('users')->cascadeOnDelete();
            $table->string('period_month', 7);
            $table->unsignedBigInteger('advance_amount')->nullable()->comment('Зафиксированная сумма аванса в копейках; null - считается по начислениям');
            $table->boolean('advance_is_manual')->default(false);
            $table->unsignedBigInteger('settlement_amount')->nullable()->comment('Зафиксированная сумма расчета в копейках; null - считается по начислениям');
            $table->boolean('settlement_is_manual')->default(false);
            $table->timestamps();
            $table->comment('Зафиксированные суммы аванса и расчета сотрудника за месяц: введены вручную или закреплены после полной выплаты.');

            $table->unique(['employee_id', 'period_month'], 'payroll_payout_plans_employee_month_unique');
            $table->index(['company_id', 'period_month'], 'payroll_payout_plans_period_idx');
        });

        Schema::create('payroll_payout_openings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('employee_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->bigInteger('amount')->comment('Долг компании перед сотрудником на начало учета в копейках; минус - переплата');
            $table->timestamps();
            $table->comment('Остаток задолженности по сотруднику на месяц начала учета выплат.');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_payout_openings');
        Schema::dropIfExists('payroll_payout_plans');
        Schema::dropIfExists('payroll_payouts');
        Schema::dropIfExists('payroll_payout_articles');
        Schema::dropIfExists('payroll_payout_settings');
    }
};
