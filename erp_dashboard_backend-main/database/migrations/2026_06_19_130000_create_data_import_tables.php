<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('data_imports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 32);
            $table->string('status', 40);
            $table->string('disk', 40)->default('local');
            $table->text('path');
            $table->string('original_name');
            $table->string('extension', 10);
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size');
            $table->string('checksum', 64)->nullable();
            $table->unsignedInteger('progress')->default(0);
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('processed_rows')->default(0);
            $table->unsignedInteger('successful_rows')->default(0);
            $table->unsignedInteger('failed_rows')->default(0);
            $table->unsignedInteger('skipped_rows')->default(0);
            $table->jsonb('options')->nullable();
            $table->jsonb('metrics')->nullable();
            $table->text('error_message')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('finished_at')->nullable();
            $table->timestampsTz();

            $table->index(['company_id', 'type', 'created_at']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('data_import_rows', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->foreignUuid('data_import_id')->constrained('data_imports')->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->string('status', 24);
            $table->jsonb('raw_data')->nullable();
            $table->jsonb('normalized_data')->nullable();
            $table->jsonb('errors')->nullable();
            $table->jsonb('warnings')->nullable();
            $table->string('entity_type')->nullable();
            $table->string('entity_id')->nullable();
            $table->timestampsTz();

            $table->unique(['data_import_id', 'row_number']);
            $table->index(['data_import_id', 'status']);
        });

        Schema::create('data_import_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->foreignUuid('data_import_id')->constrained('data_imports')->cascadeOnDelete();
            $table->string('level', 16);
            $table->text('message');
            $table->jsonb('context')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['data_import_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('data_import_logs');
        Schema::dropIfExists('data_import_rows');
        Schema::dropIfExists('data_imports');
    }
};
