<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('work_segments')) {
            return;
        }

        Schema::table('work_segments', function (Blueprint $table): void {
            if (Schema::hasColumn('work_segments', 'duration_seconds')) {
                $table->dropColumn('duration_seconds');
            }

            if (! Schema::hasColumn('work_segments', 'intermediate_ended_at')) {
                $table->timestampTz('intermediate_ended_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('work_segments')) {
            return;
        }

        Schema::table('work_segments', function (Blueprint $table): void {
            if (Schema::hasColumn('work_segments', 'intermediate_ended_at')) {
                $table->dropColumn('intermediate_ended_at');
            }

            if (! Schema::hasColumn('work_segments', 'duration_seconds')) {
                $table->integer('duration_seconds')->nullable();
            }
        });
    }
};
