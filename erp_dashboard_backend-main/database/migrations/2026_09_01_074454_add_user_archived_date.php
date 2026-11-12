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
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('archived_at')->nullable()->after('status')->comment('Дата архивирования пользователя');
        });

        DB::table('users')
            ->where('status', 'BLOCKED')
            ->whereNull('archived_at')
            ->update(['archived_at' => now()]);

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('archived_at');
        });
    }
};
