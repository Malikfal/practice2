<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE work_segments ALTER COLUMN started_at TYPE INTEGER USING EXTRACT(EPOCH FROM started_at)::INTEGER');
        DB::statement('ALTER TABLE work_segments ALTER COLUMN ended_at TYPE INTEGER USING EXTRACT(EPOCH FROM ended_at)::INTEGER');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE work_segments ALTER COLUMN started_at TYPE TIMESTAMP USING to_timestamp(started_at)');
        DB::statement('ALTER TABLE work_segments ALTER COLUMN ended_at TYPE TIMESTAMP USING to_timestamp(ended_at)');
    }
};
