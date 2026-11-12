<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', static function (Blueprint $table): void {
            $table->boolean('is_draft')->default(false)->after('created_by_id');
            $table->timestamp('published_at')->nullable()->after('is_draft');
            $table->index(['project_id', 'is_draft']);
        });
    }

    public function down(): void
    {
        Schema::table('tasks', static function (Blueprint $table): void {
            $table->dropIndex(['project_id', 'is_draft']);
            $table->dropColumn(['is_draft', 'published_at']);
        });
    }
};
