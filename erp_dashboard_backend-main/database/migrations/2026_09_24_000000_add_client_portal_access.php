<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TYPE \"Role\" ADD VALUE IF NOT EXISTS 'CLIENT'");
        Schema::table('users', function (Blueprint $table): void {
            $table->uuid('client_id')->nullable()->index();
            $table->boolean('client_all_projects')->default(true);
            $table->timestampTz('last_login_at')->nullable();
        });
        Schema::create('client_account_projects', function (Blueprint $table): void {
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->timestampsTz();
            $table->primary(['user_id', 'project_id']);
            $table->index('project_id');
        });
        Schema::table('tasks', function (Blueprint $table): void {
            $table->boolean('is_client_visible')->default(true)->index();
        });
        Schema::table('task_status_columns', function (Blueprint $table): void {
            $table->boolean('is_client_intake')->default(false);
        });
        Schema::table('template_task_status_columns', function (Blueprint $table): void {
            $table->boolean('is_client_intake')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('template_task_status_columns', fn (Blueprint $table) => $table->dropColumn('is_client_intake'));
        Schema::table('task_status_columns', fn (Blueprint $table) => $table->dropColumn('is_client_intake'));
        Schema::table('tasks', fn (Blueprint $table) => $table->dropColumn('is_client_visible'));
        Schema::dropIfExists('client_account_projects');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn([
            'client_id', 'client_all_projects', 'last_login_at',
        ]));
    }
};
