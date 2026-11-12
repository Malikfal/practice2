<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('manager_report_stats', function (Blueprint $table): void {
            $table->unsignedBigInteger('team_seconds')->default(0)->after('developer_seconds')
                ->comment('Время всех участников проекта, кроме его PM, с исключениями проекта из оплаты');
            $table->unsignedBigInteger('own_seconds')->default(0)->after('team_seconds')
                ->comment('Собственное время менеджера на проекте');
            $table->unsignedBigInteger('team_cost')->default(0)->after('developer_cost')
                ->comment('Начисления всем участникам проекта, кроме PM, в копейках');
        });
    }

    public function down(): void
    {
        Schema::table('manager_report_stats', function (Blueprint $table): void {
            $table->dropColumn(['team_seconds', 'own_seconds', 'team_cost']);
        });
    }
};
