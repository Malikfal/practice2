<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $hasStatus = Schema::hasColumn('tasks', 'status');
        $hasPosition = Schema::hasColumn('tasks', 'position');
        $hasDescription = Schema::hasColumn('tasks', 'description');

        if ($hasStatus && $hasPosition && $hasDescription) {
            return;
        }

        Schema::table('tasks', function (Blueprint $table) use ($hasStatus, $hasPosition, $hasDescription): void {
            if (! $hasStatus) {
                $table->string('status', 20)->default('TODO')->after('project_id');
            }

            if (! $hasPosition) {
                $table->float('position')->default(0)->after('status');
            }

            if (! $hasDescription) {
                $table->text('description')->nullable()->after('position');
            }
        });
    }

    public function down(): void
    {
        $hasStatus = Schema::hasColumn('tasks', 'status');
        $hasPosition = Schema::hasColumn('tasks', 'position');
        $hasDescription = Schema::hasColumn('tasks', 'description');

        if (! $hasStatus && ! $hasPosition && ! $hasDescription) {
            return;
        }

        Schema::table('tasks', function (Blueprint $table) use ($hasStatus, $hasPosition, $hasDescription): void {
            if ($hasDescription) {
                $table->dropColumn('description');
            }

            if ($hasPosition) {
                $table->dropColumn('position');
            }

            if ($hasStatus) {
                $table->dropColumn('status');
            }
        });
    }
};
