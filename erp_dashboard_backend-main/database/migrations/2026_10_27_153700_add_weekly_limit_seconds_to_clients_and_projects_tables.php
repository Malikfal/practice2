<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table): void {
            $table
                ->unsignedInteger('weekly_limit_seconds')
                ->nullable()
                ->comment('Недельный лимит клиента, общий на все его проекты. Главнее лимита проекта в отчёте «Лимитные проекты».');
        });

        Schema::table('projects', function (Blueprint $table): void {
            $table
                ->unsignedInteger('weekly_limit_seconds')
                ->nullable()
                ->comment('Недельный лимит проекта. Не учитывается, если лимит задан у клиента.');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn('weekly_limit_seconds');
        });

        Schema::table('clients', function (Blueprint $table): void {
            $table->dropColumn('weekly_limit_seconds');
        });
    }
};
