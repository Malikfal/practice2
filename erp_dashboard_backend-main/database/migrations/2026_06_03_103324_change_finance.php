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
        Schema::table('finance_article', function (Blueprint $table): void {
            $table->foreignUuid('parent_id')
                ->nullable()
                ->after('company_id')
                ->constrained('finance_article')
                ->cascadeOnDelete();
        });

        Schema::dropIfExists('finance_article_services');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('finance_article_services', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('finance_article_id')->constrained('finance_article')->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
        });

        Schema::table('finance_article', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('parent_id');
        });
    }
};
