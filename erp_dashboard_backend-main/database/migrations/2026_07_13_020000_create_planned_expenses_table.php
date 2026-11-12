<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('planned_expenses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('finance_article_id')->constrained('finance_article')->cascadeOnDelete();
            $table->text('formula');
            $table->string('calculation_period');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'is_active'], 'planned_expenses_company_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('planned_expenses');
    }
};
