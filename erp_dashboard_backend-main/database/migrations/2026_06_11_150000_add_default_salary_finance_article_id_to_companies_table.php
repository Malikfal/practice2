<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table): void {
            $table->foreignUuid('default_salary_finance_article_id')
                ->nullable()
                ->after('tracker_default_task_status_name')
                ->constrained('finance_article')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table): void {
            $table->dropForeign(['default_salary_finance_article_id']);
            $table->dropColumn('default_salary_finance_article_id');
        });
    }
};
