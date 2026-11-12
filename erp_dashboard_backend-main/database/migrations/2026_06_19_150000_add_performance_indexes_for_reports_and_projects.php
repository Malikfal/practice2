<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_segments', static function (Blueprint $table): void {
            $table->index(['user_id', 'started_at'], 'work_segments_user_id_started_at_idx');
        });

        Schema::table('project_members', static function (Blueprint $table): void {
            $table->index('user_id', 'project_members_user_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('work_segments', static function (Blueprint $table): void {
            $table->dropIndex('work_segments_user_id_started_at_idx');
        });

        Schema::table('project_members', static function (Blueprint $table): void {
            $table->dropIndex('project_members_user_id_idx');
        });
    }
};
