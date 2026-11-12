<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Внутренние документы проекта можно скрыть от клиента. По умолчанию документ виден.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_documents', function (Blueprint $table): void {
            $table->boolean('is_client_visible')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('project_documents', fn (Blueprint $table) => $table->dropColumn('is_client_visible'));
    }
};
