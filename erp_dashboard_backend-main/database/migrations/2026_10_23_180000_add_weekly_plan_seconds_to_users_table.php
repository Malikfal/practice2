<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table
                ->unsignedInteger('weekly_plan_seconds')
                ->nullable()
                ->comment('Недельный план сотрудника. Сравнивается со временем за текущую неделю на странице сотрудников.');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('weekly_plan_seconds');
        });
    }
};
