<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Создает таблицу состояния фоновых недельных перерасчетов.
     */
    public function up(): void
    {
        Schema::create('payroll_week_recalculations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('week_start');
            $table->string('status');
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'week_start'], 'payroll_week_recalc_employee_week_unique');
            $table->index(['company_id', 'status'], 'payroll_week_recalc_company_status_idx');
        });
    }

    /**
     * Удаляет таблицу состояния недельных перерасчетов.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_week_recalculations');
    }
};
