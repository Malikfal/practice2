<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_segments', function (Blueprint $table): void {
            $table->index('user_id', 'work_segments_user_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('work_segments', function (Blueprint $table): void {
            $table->dropIndex('work_segments_user_id_idx');
        });
    }
};
