<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('project_members', 'is_pm')) {
            Schema::table('project_members', function (Blueprint $table): void {
                $table->boolean('is_pm')->default(false)->after('user_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('project_members', 'is_pm')) {
            Schema::table('project_members', function (Blueprint $table): void {
                $table->dropColumn('is_pm');
            });
        }
    }
};
