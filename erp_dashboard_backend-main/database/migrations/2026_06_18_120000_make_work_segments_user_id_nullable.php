<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE work_segments DROP CONSTRAINT IF EXISTS work_segments_user_id_fkey');
        DB::statement('ALTER TABLE work_segments ALTER COLUMN user_id DROP NOT NULL');
        DB::statement(
            'ALTER TABLE work_segments ADD CONSTRAINT work_segments_user_id_fkey '
            .'FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL'
        );
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE work_segments DROP CONSTRAINT IF EXISTS work_segments_user_id_fkey');
        DB::statement('ALTER TABLE work_segments ALTER COLUMN user_id SET NOT NULL');
        DB::statement(
            'ALTER TABLE work_segments ADD CONSTRAINT work_segments_user_id_fkey '
            .'FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT'
        );
    }
};
