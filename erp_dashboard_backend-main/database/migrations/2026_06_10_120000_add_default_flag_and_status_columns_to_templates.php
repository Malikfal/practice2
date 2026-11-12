<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('templates', function (Blueprint $table): void {
            if (! Schema::hasColumn('templates', 'is_default')) {
                $table->boolean('is_default')->default(false)->after('name');
            }
        });

        if (! Schema::hasTable('template_task_status_columns')) {
            Schema::create('template_task_status_columns', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('template_id')->constrained('templates')->cascadeOnDelete();
                $table->string('name');
                $table->string('slug');
                $table->string('color', 32)->nullable();
                $table->unsignedInteger('position')->default(1);
                $table->boolean('is_default')->default(false);
                $table->boolean('is_final')->default(false);
                $table->timestamps();

                $table->unique(['template_id', 'slug']);
                $table->unique(['template_id', 'position']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('template_task_status_columns');

        Schema::table('templates', function (Blueprint $table): void {
            if (Schema::hasColumn('templates', 'is_default')) {
                $table->dropColumn('is_default');
            }
        });
    }
};
