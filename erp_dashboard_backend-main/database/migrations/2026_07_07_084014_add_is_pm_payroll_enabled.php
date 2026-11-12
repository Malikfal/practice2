<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('project_members', 'is_pm_payroll_enabled')) {
            Schema::table('project_members', function (Blueprint $table): void {
                $table->boolean('is_pm_payroll_enabled')->default(true)->after('is_pm');
            });

            DB::table('project_members')
                ->where('is_pm', false)
                ->update(['is_pm_payroll_enabled' => false]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('project_members', 'is_pm_payroll_enabled')) {
            Schema::table('project_members', function (Blueprint $table): void {
                $table->dropColumn('is_pm_payroll_enabled');
            });
        }
    }
};
