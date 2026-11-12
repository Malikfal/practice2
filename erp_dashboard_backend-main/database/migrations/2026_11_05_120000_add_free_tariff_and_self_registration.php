<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // Все прежние тарифы — ПРО, бесплатный ФРИ добавляется отдельной строкой.
        Schema::table('tariffs', function (Blueprint $table): void {
            $table->string('plan', 16)->default('pro');
        });

        if (! DB::table('tariffs')->where('slug', 'free')->exists()) {
            DB::table('tariffs')->insert([
                'id' => (string) Str::uuid(),
                'name' => 'ФРИ',
                'slug' => 'free',
                // Как у «5 + 1»: лимит считает и владельца.
                'max_employees' => 6,
                'is_active' => true,
                'price' => 0,
                'is_public' => true,
                'plan' => 'free',
            ]);
        }

        // Пользователи, созданные не через самостоятельную регистрацию, считаются подтверждёнными:
        // значение по умолчанию заполняет и существующие строки, и новые вставки из других мест.
        Schema::table('users', function (Blueprint $table): void {
            $table->timestampTz('email_verified_at')->nullable()->useCurrent();
        });

        Schema::table('companies', function (Blueprint $table): void {
            $table->timestamp('self_registered_at')->nullable();
        });

        Schema::create('user_action_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->index();
            $table->string('purpose', 32);
            $table->string('token_hash', 64)->unique();
            $table->timestampTz('expires_at');
            $table->timestampsTz();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_action_tokens');
        Schema::table('companies', fn (Blueprint $table) => $table->dropColumn('self_registered_at'));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('email_verified_at'));
        DB::table('tariffs')->where('slug', 'free')->delete();
        Schema::table('tariffs', fn (Blueprint $table) => $table->dropColumn('plan'));
    }
};
