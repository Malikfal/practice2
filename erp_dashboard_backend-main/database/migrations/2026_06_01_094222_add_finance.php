<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('finance_article', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->string('type');
            $table->timestamps();
        });

        Schema::create('finance_article_services', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('finance_article_id')->constrained('finance_article')->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('finance', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignUuid('finance_article_id')->nullable()->constrained('finance_article')->nullOnDelete();
            $table->foreignUuid('employee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('amount');
            $table->string('type');
            $table->text('comment')->nullable();
            $table->date('dateOfPayment');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('finance');
        Schema::dropIfExists('finance_article_services');
        Schema::dropIfExists('finance_article');
    }
};
