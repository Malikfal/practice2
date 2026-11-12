<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->boolean('is_internal')->default(false)->after('manager_payment_method');
            $table->boolean('exclude_from_payroll')->default(false)->after('is_internal');
            $table->index(['company_id', 'is_internal']);
            $table->index(['company_id', 'exclude_from_payroll']);
        });

        Schema::table('employee_rates', function (Blueprint $table): void {
            $table->unsignedBigInteger('company_hourly_rate')->nullable()->after('supervised_hourly_rate');
            $table->boolean('exclude_from_supervised_hours')->default(false)->after('company_hourly_rate');
            $table->jsonb('rate_settings')->nullable()->after('exclude_from_supervised_hours');
        });
    }

    public function down(): void
    {
        Schema::table('employee_rates', function (Blueprint $table): void {
            $table->dropColumn(['company_hourly_rate', 'exclude_from_supervised_hours', 'rate_settings']);
        });

        Schema::table('projects', function (Blueprint $table): void {
            $table->dropIndex(['company_id', 'exclude_from_payroll']);
            $table->dropIndex(['company_id', 'is_internal']);
            $table->dropColumn(['is_internal', 'exclude_from_payroll']);
        });
    }
};
