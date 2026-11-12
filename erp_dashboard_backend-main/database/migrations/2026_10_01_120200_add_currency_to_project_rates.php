<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Валюта почасовой ставки проекта. Существующие ставки остаются в рублях.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_rates', function (Blueprint $table): void {
            $table->string('currency', 3)->default('RUB');
        });
    }

    public function down(): void
    {
        Schema::table('project_rates', fn (Blueprint $table) => $table->dropColumn('currency'));
    }
};
