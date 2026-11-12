<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('work_segments')) {
            return;
        }

        Schema::table('work_segments', function (Blueprint $table): void {
            if (Schema::hasColumn('work_segments', 'intermediate_ended_at')) {
                $table->dropColumn('intermediate_ended_at');
            }

            if (! Schema::hasColumn('work_segments', 'completed')) {
                $table->boolean('completed')->default(false);
            }
        });

        if (Schema::hasColumn('work_segments', 'ended_at') && $this->columnIsNullable('work_segments', 'ended_at')) {
            DB::statement('ALTER TABLE "work_segments" ALTER COLUMN "ended_at" SET NOT NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('work_segments')) {
            return;
        }

        Schema::table('work_segments', function (Blueprint $table): void {
            if (Schema::hasColumn('work_segments', 'completed')) {
                $table->dropColumn('completed');
            }

            if (! Schema::hasColumn('work_segments', 'intermediate_ended_at')) {
                $table->timestampTz('intermediate_ended_at')->nullable();
            }
        });

        if (Schema::hasColumn('work_segments', 'ended_at') && ! $this->columnIsNullable('work_segments', 'ended_at')) {
            DB::statement('ALTER TABLE "work_segments" ALTER COLUMN "ended_at" DROP NOT NULL');
        }
    }

    private function columnIsNullable(string $table, string $column): bool
    {
        return DB::table('information_schema.columns')
            ->where('table_name', $table)
            ->where('column_name', $column)
            ->value('is_nullable') === 'YES';
    }
};
