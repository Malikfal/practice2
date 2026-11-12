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
        if (! Schema::hasTable('project_notes')) {
            Schema::create('project_notes', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
                $table->foreignUuid('author_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignUuid('changed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('title', 255)->nullable();
                $table->longText('content');
                $table->timestamps();

                $table->index(['project_id', 'created_at'], 'project_notes_project_created_idx');
                $table->index(['company_id', 'created_at'], 'project_notes_company_created_idx');
            });
        }

        if (! Schema::hasTable('user_pinned_project_notes')) {
            Schema::create('user_pinned_project_notes', function (Blueprint $table) {
                $table->id();
                $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignUuid('project_note_id')->constrained('project_notes')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['user_id', 'project_note_id']);
                $table->index(['user_id', 'created_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_pinned_project_notes');
        Schema::dropIfExists('project_notes');
    }
};
