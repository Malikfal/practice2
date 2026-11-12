<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement('ALTER TYPE "Role" ADD VALUE IF NOT EXISTS \'SUPERADMIN\'');

        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 255);
            $table->string('status', 32)->default('ACTIVE');
            $table->foreignUuid('owner_user_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('blocked_at')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->foreignUuid('company_id')->nullable()->references('id')->on('companies')->nullOnDelete();
            $table->index('company_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });

        Schema::table('companies', function (Blueprint $table): void {
            $table->dropForeign(['owner_user_id']);
        });

        Schema::dropIfExists('companies');
    }
};
