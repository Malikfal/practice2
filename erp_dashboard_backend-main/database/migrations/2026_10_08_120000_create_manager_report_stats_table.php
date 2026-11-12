<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manager_report_stats', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->date('period_from')->comment('Первый день расчетного периода: неделя, разрезанная границей месяца');
            $table->date('period_to')->comment('Последний день расчетного периода включительно');
            $table->date('week_start')->comment('Понедельник недели периода');
            $table->foreignUuid('manager_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('project_id')->nullable()->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('developer_seconds')->default(0);
            $table->unsignedBigInteger('supervised_seconds')->default(0);
            $table->unsignedBigInteger('developer_cost')->default(0);
            $table->unsignedBigInteger('controlled_cost')->default(0);
            $table->unsignedBigInteger('manager_cost')->default(0);
            $table->timestamps();
            $table->comment('Накопленная статистика отчета по менеджерам. Строка без project_id хранит начисление менеджеру за период, строки с проектом - показатели проектов, где он был PM.');

            $table->index(['company_id', 'period_from'], 'manager_report_stats_period_idx');
            $table->index(['company_id', 'manager_id', 'period_from'], 'manager_report_stats_manager_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manager_report_stats');
    }
};
