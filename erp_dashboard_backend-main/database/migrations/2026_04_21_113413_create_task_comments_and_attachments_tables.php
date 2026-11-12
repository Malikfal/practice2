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
        $hasCommentsTable = Schema::hasTable('task_comments');
        $hasCommentAttachmentsTable = Schema::hasTable('task_comment_attachments');
        if (! $hasCommentsTable) {
            Schema::create('task_comments', static function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('task_id')->constrained('tasks')->cascadeOnDelete();
                $table->foreignUuid('author_id')->constrained('users')->cascadeOnDelete();
                $table->text('text')->nullable();
                $table->timestamps();

                $table->index(['task_id', 'created_at'], 'task_comments_task_created_idx');
            });
        }
        if (! $hasCommentAttachmentsTable) {
            Schema::create('task_comment_attachments', static function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('comment_id')->constrained('task_comments')->cascadeOnDelete();
                $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
                $table->foreignUuid('task_id')->constrained('tasks')->cascadeOnDelete();
                $table->string('path', 1024);
                $table->string('original_name', 255);
                $table->string('mime_type', 255)->nullable();
                $table->foreignUuid('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['task_id', 'created_at'], 'task_comment_attachments_task_created_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_comment_attachments');
        Schema::dropIfExists('task_comments');
    }
};
