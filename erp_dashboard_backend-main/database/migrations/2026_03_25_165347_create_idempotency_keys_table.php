<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! $this->pgTypeExists('JobStatus')) {
            DB::statement('CREATE TYPE "JobStatus" AS ENUM (\'IN_PROGRESS\', \'COMPLETED\', \'FAILED\')');
        }

        if (! Schema::hasTable('idempotency_keys')) {
            Schema::create('idempotency_keys', function (Blueprint $table): void {
                $table->uuid('key')->primary();
                $table->timestampTz('created_at')->useCurrent();
                $table->timestampTz('expires_at');
                $table->integer('status_code')->nullable();
                $table->json('response_body')->nullable();
                $table->index('expires_at');
            });
        }

        if (Schema::hasTable('idempotency_keys')) {
            DB::statement('ALTER TABLE "idempotency_keys" ADD COLUMN IF NOT EXISTS "job_status" "JobStatus" NOT NULL DEFAULT \'IN_PROGRESS\'');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');

        DB::statement('DROP TYPE IF EXISTS "JobStatus"');
    }

    private function pgTypeExists(string $type): bool
    {
        return DB::table('pg_type')->where('typname', $type)->exists();
    }
};
