<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table): void {
            $table
                ->unsignedInteger('unestimated_task_limit_seconds')
                ->default(3 * 3600)
                ->comment('Допустимое время для задач без оценки. Сверх него задача попадает в отчет по перерасходу.');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table): void {
            $table->dropColumn('unestimated_task_limit_seconds');
        });
    }
};
