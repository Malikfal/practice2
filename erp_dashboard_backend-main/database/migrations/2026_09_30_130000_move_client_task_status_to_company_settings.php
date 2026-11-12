<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Статус задач, созданных клиентом, задаётся одной настройкой компании вместо отметки колонки в каждом проекте.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table): void {
            $table->string('client_task_status_name')->nullable()->after('tracker_default_task_status_name');
        });

        // Переносим уже отмеченные колонки: берём имя первой из них в компании.
        DB::table('task_status_columns')
            ->where('is_client_intake', true)
            ->whereRaw("TRIM(name) <> ''")
            ->groupBy('company_id')
            ->selectRaw('company_id, MIN(TRIM(name)) as name')
            ->get()
            ->each(static function (object $row): void {
                DB::table('companies')
                    ->where('id', $row->company_id)
                    ->whereNull('client_task_status_name')
                    ->update(['client_task_status_name' => $row->name]);
            });

        Schema::table('task_status_columns', fn (Blueprint $table) => $table->dropColumn('is_client_intake'));
        Schema::table('template_task_status_columns', fn (Blueprint $table) => $table->dropColumn('is_client_intake'));
    }

    public function down(): void
    {
        Schema::table('task_status_columns', function (Blueprint $table): void {
            $table->boolean('is_client_intake')->default(false);
        });
        Schema::table('template_task_status_columns', function (Blueprint $table): void {
            $table->boolean('is_client_intake')->default(false);
        });
        Schema::table('companies', fn (Blueprint $table) => $table->dropColumn('client_task_status_name'));
    }
};
