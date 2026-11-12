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
        if (! Schema::hasTable('task_status_columns')) {
                Schema::create('task_status_columns', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
                $table->string('name', 255);
                $table->string('slug', 255);
                $table->string('color', 32)->nullable();
                $table->unsignedInteger('position')->default(0);
                $table->boolean('is_final')->default(false);
                $table->boolean('is_default')->default(false);
                $table->timestamps();

                $table->unique(['project_id', 'slug']);
                $table->index(['project_id', 'position']);
                $table->index(['company_id', 'project_id']);
            });
        }  
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_status_columns');
    }
};
