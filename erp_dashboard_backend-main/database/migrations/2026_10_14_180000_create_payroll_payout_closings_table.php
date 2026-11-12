<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_payout_closings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained()->cascadeOnDelete();
            $table->string('period_month', 7)->comment('Зафиксированный месяц ведомости в формате ГГГГ-ММ');
            $table->foreignUuid('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->comment('Зафиксированные месяцы ведомости выплат ФОТ: суммы аванса и расчета закреплены и не меняются, пока фиксацию не снимут.');

            $table->unique(['company_id', 'period_month'], 'payroll_payout_closings_company_month_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_payout_closings');
    }
};
