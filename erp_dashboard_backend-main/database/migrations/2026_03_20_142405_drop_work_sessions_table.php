<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('work_segments') && Schema::hasColumn('work_segments', 'work_session_id')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                if ($this->hasForeignKey('work_segments', 'work_segments_work_session_id_foreign')) {
                    $table->dropForeign(['work_session_id']);
                }

                if ($this->hasIndex('work_segments', 'work_segments_work_session_id_started_at_idx')) {
                    $table->dropIndex('work_segments_work_session_id_started_at_idx');
                }

                $table->dropColumn('work_session_id');
            });
        }

        if (Schema::hasTable('work_sessions')) {
            Schema::drop('work_sessions');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('work_sessions')) {
            Schema::create('work_sessions', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->timestamps();
                $table->timestampTz('started_at');
                $table->timestampTz('ended_at')->nullable();
                $table->foreignUuid('user_id')->constrained('users')->restrictOnDelete();
            });
        }

        if (Schema::hasTable('work_segments') && ! Schema::hasColumn('work_segments', 'work_session_id')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                $table->foreignUuid('work_session_id')->nullable()->constrained('work_sessions')->cascadeOnDelete();
                $table->index(['work_session_id', 'started_at'], 'work_segments_work_session_id_started_at_idx');
            });
        }
    }

    private function hasForeignKey(string $table, string $constraint): bool
    {
        return DB::table('information_schema.table_constraints')
            ->where('table_name', $table)
            ->where('constraint_name', $constraint)
            ->where('constraint_type', 'FOREIGN KEY')
            ->exists();
    }

    private function hasIndex(string $table, string $index): bool
    {
        return DB::table('pg_indexes')
            ->where('tablename', $table)
            ->where('indexname', $index)
            ->exists();
    }
};
