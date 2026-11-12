<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'last_name')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('last_name')->nullable()->after('name');
            });
        }

        if (Schema::hasTable('work_segments') && Schema::hasColumn('work_segments', 'ended_at') && ! $this->columnIsNullable('work_segments', 'ended_at')) {
            DB::statement('ALTER TABLE "work_segments" ALTER COLUMN "ended_at" DROP NOT NULL');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('work_segments') && Schema::hasColumn('work_segments', 'ended_at') && $this->columnIsNullable('work_segments', 'ended_at')) {
            DB::statement('ALTER TABLE "work_segments" ALTER COLUMN "ended_at" SET NOT NULL');
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'last_name')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropColumn('last_name');
            });
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
