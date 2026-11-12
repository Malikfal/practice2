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
        if (! Schema::hasTable('tags')) {
            Schema::create('tags', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('name');
                $table->string('normalized_name');
                $table->timestamps();

                $table->unique(['company_id', 'normalized_name']);
                $table->index(['company_id', 'name']);
            });
        }

        if (! Schema::hasTable('project_tags')) {
            Schema::create('project_tags', function (Blueprint $table) {
                $table->id();
                $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
                $table->foreignUuid('tag_id')->constrained('tags')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['project_id', 'tag_id']);
                $table->index(['project_id', 'tag_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_tags');
        Schema::dropIfExists('tags');
    }
};
