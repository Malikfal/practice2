<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_notes', function (Blueprint $table): void {
            $table->string('visibility', 32)->default('project');
        });

        Schema::create('project_note_users', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('project_note_id')->constrained('project_notes')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['project_note_id', 'user_id']);
            $table->index(['company_id', 'project_note_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_note_users');

        Schema::table('project_notes', function (Blueprint $table): void {
            $table->dropColumn('visibility');
        });
    }
};
