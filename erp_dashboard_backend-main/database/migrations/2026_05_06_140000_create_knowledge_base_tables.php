<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('knowledge_base_folders', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name', 255);
            $table->boolean('is_archive')->default(false);
            $table->timestamps();
        });

        Schema::create('knowledge_base_articles', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('folder_id')->nullable()->constrained('knowledge_base_folders')->cascadeOnDelete();
            $table->foreignUuid('author_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 255);
            $table->longText('content');
            $table->boolean('is_draft')->default(true);
            $table->boolean('is_archive')->default(false);
            $table->boolean('is_pinned')->default(false);
            $table->timestamps();
        });

        Schema::create('knowledge_base_documents', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('article_id')->constrained('knowledge_base_articles')->cascadeOnDelete();
            $table->string('disk', 64)->default('knowledge_base');
            $table->string('path', 1024);
            $table->string('original_name', 255);
            $table->string('mime_type', 255)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->foreignUuid('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('knowledge_base_folder_accesses', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('folder_id')->constrained('knowledge_base_folders')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('role', 32)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_base_folder_accesses');
        Schema::dropIfExists('knowledge_base_documents');
        Schema::dropIfExists('knowledge_base_articles');
        Schema::dropIfExists('knowledge_base_folders');
    }
};
