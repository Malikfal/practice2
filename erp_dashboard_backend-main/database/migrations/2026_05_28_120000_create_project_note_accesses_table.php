<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_note_accesses', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('project_note_id')->constrained('project_notes')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('role', 32)->nullable();
            $table->timestamps();

            $table->unique(['project_note_id', 'user_id']);
            $table->unique(['project_note_id', 'role']);
            $table->index(['company_id', 'project_note_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_note_accesses');
    }
};
