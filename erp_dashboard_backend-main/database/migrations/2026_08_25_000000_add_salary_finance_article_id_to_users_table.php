<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Добавляет индивидуальную зарплатную статью сотрудника.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->foreignUuid('salary_finance_article_id')
                ->nullable()
                ->after('company_id')
                ->constrained('finance_article')
                ->nullOnDelete();
        });
    }

    /**
     * Удаляет индивидуальную зарплатную статью сотрудника.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('salary_finance_article_id');
        });
    }
};
