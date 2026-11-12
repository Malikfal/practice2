<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $hasEstimationColumn = Schema::hasColumn('tasks', 'estimation');
        if (!$hasEstimationColumn) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->integer('estimation')->nullable();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $hasEstimationColumn = Schema::hasColumn('tasks', 'estimation');
        if ($hasEstimationColumn) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropColumn('estimation');
            });
        }
    }
};
