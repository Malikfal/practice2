<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->foreignUuid('default_entrance_finance_article_id')
                ->nullable()
                ->comment('Статья расходов по умолчанию для входящих платежей в проект, используется просто как пресет')
                ->constrained('finance_article')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('default_entrance_finance_article_id');
        });
    }
};
