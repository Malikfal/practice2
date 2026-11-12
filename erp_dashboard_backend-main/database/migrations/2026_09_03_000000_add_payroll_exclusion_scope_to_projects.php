<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            // ALL сохраняет прежнее поведение exclude_from_payroll=true.
            $table->string('payroll_exclusion_scope')
                ->default('ALL');
        });

        Schema::create('project_payroll_excluded_employees', function (Blueprint $table): void {
            $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['project_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_payroll_excluded_employees');

        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn('payroll_exclusion_scope');
        });
    }
};
