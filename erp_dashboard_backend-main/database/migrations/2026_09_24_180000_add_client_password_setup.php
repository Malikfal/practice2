<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->timestampTz('password_set_at')->nullable();
        });

        DB::table('users')->whereNotNull('password_hash')->update(['password_set_at' => now()]);

        Schema::create('client_password_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->index();
            $table->string('token_hash', 64)->unique();
            $table->timestampTz('expires_at');
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_password_tokens');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('password_set_at'));
    }
};
