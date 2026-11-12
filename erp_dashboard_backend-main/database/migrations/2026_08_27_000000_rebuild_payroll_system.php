<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Добавляет актуальные настройки payroll и переводит очередь на перерасчет компании за период.
     */
    public function up(): void
    {
        Schema::table('employee_rates', function (Blueprint $table): void {
            $table->string('salary_distribution_scope')
                ->default('COMPANY')
                ->after('salary')
                ->comment('Область часов для распределения оклада по проектам');
        });

        Schema::table('companies', function (Blueprint $table): void {
            $table->foreignUuid('default_fixed_absence_finance_article_id')
                ->nullable()
                ->after('default_salary_finance_article_id')
                ->constrained('finance_article')
                ->nullOnDelete();
            $table->boolean('calculate_daily_payroll')->default(false);
        });

        // Старые source отсутствуют в новом FinanceSource, поэтому их необходимо заменить.
        DB::table('finance')
            ->where('source', 'PAYROLL_ABSENCE_FIXED')
            ->update(['source' => 'PAYROLL_DAILY']);
        DB::table('finance')
            ->whereIn('source', [
                'PAYROLL_WEEKLY_CORRECTION',
                'PAYROLL_WEEKLY_RECALCULATION',
            ])
            ->update(['source' => 'PAYROLL_RECALCULATION']);

        // данные по перерасчетам компаний
        Schema::table('payroll_week_recalculations', function (Blueprint $table): void {
            $table->dropUnique('payroll_week_recalc_employee_week_unique');
            $table->dropIndex('payroll_week_recalc_company_status_idx');
            $table->dropConstrainedForeignId('employee_id');
            $table->renameColumn('week_start', 'period_from');
            $table->date('period_to')->nullable();
        });
        Schema::rename('payroll_week_recalculations', 'payroll_recalculations');
        Schema::table('payroll_recalculations', function (Blueprint $table): void {
            $table->unique(
                ['company_id', 'period_from', 'period_to'],
                'payroll_recalc_company_period_unique',
            );
            $table->index(['company_id', 'status'], 'payroll_recalc_company_status_idx');
        });
    }

    /**
     * Возвращает прежнюю схему без удаления сохраненных состояний задач.
     */
    public function down(): void
    {
        if (Schema::hasTable('payroll_recalculations')) {
            Schema::table('payroll_recalculations', function (Blueprint $table): void {
                $table->dropUnique('payroll_recalc_company_period_unique');
                $table->dropIndex('payroll_recalc_company_status_idx');
            });
            Schema::rename('payroll_recalculations', 'payroll_week_recalculations');
            Schema::table('payroll_week_recalculations', function (Blueprint $table): void {
                $table->renameColumn('period_from', 'week_start');
                $table->dropColumn('period_to');
                $table->foreignUuid('employee_id')->nullable()->constrained('users')->cascadeOnDelete();
                $table->unique(['employee_id', 'week_start'], 'payroll_week_recalc_employee_week_unique');
                $table->index(['company_id', 'status'], 'payroll_week_recalc_company_status_idx');
            });
        }

        if (Schema::hasColumn('companies', 'default_fixed_absence_finance_article_id')) {
            Schema::table('companies', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('default_fixed_absence_finance_article_id');
            });
        }
        if (Schema::hasColumn('companies', 'calculate_daily_payroll')) {
            Schema::table('companies', function (Blueprint $table): void {
                $table->dropColumn('calculate_daily_payroll');
            });
        }

        if (Schema::hasColumn('employee_rates', 'salary_distribution_scope')) {
            Schema::table('employee_rates', function (Blueprint $table): void {
                $table->dropColumn('salary_distribution_scope');
            });
        }

    }
};
