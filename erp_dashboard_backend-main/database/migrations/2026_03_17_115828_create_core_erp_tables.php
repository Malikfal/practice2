<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! $this->pgTypeExists('Role')) {
            DB::statement('CREATE TYPE "Role" AS ENUM (\'ADMIN\', \'MANAGER\', \'WORKER\')');
        }

        if (! $this->pgTypeExists('UserStatus')) {
            DB::statement('CREATE TYPE "UserStatus" AS ENUM (\'ACTIVE\', \'BLOCKED\')');
        }

        if (! Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->timestamps();
                $table->string('email')->unique();
                $table->string('name');
                $table->string('password_hash');
            });
        }

        if (Schema::hasTable('users')) {
            DB::statement('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT \'WORKER\'');
            DB::statement('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT \'ACTIVE\'');
        }

        if (! Schema::hasTable('projects')) {
            Schema::create('projects', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->timestamps();
                $table->string('name');
                $table->text('description')->nullable();
                $table->foreignUuid('created_by_id')->constrained('users')->restrictOnDelete();
            });
        }

        if (! Schema::hasTable('project_members')) {
            Schema::create('project_members', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
                $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
                $table->unique(['project_id', 'user_id']);
            });
        }

        if (! Schema::hasTable('tasks')) {
            Schema::create('tasks', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->timestamps();
                $table->string('title');
                $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
                $table->foreignUuid('user_id')->constrained('users')->restrictOnDelete();
                $table->index('project_id');
                $table->index('user_id');
            });
        }

        if (! Schema::hasTable('work_sessions')) {
            Schema::create('work_sessions', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->timestamps();
                $table->timestampTz('started_at');
                $table->timestampTz('ended_at')->nullable();
                $table->foreignUuid('user_id')->constrained('users')->restrictOnDelete();
            });
        }

        if (! Schema::hasTable('work_segments')) {
            Schema::create('work_segments', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->timestampTz('started_at');
                $table->timestampTz('ended_at');
                $table->integer('duration_seconds');
                $table->foreignUuid('task_id')->nullable()->constrained('tasks')->nullOnDelete();
                $table->foreignUuid('work_session_id')->constrained('work_sessions')->cascadeOnDelete();
                $table->index(['work_session_id', 'started_at'], 'work_segments_work_session_id_started_at_idx');
                $table->index(['task_id', 'started_at'], 'work_segments_task_id_started_at_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('work_segments');
        Schema::dropIfExists('work_sessions');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('project_members');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('users');

        DB::statement('DROP TYPE IF EXISTS "UserStatus"');
        DB::statement('DROP TYPE IF EXISTS "Role"');
    }

    private function pgTypeExists(string $type): bool
    {
        return DB::table('pg_type')->where('typname', $type)->exists();
    }
};
