<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->foreignUuid('client_id')
                ->nullable()
                ->after('company_id')
                ->constrained('clients')
                ->nullOnDelete();
            $table->timestampTz('starts_at')->nullable()->after('client_id');
            $table->timestampTz('ends_at')->nullable()->after('starts_at');
            $table->unsignedBigInteger('budget')->nullable()->after('ends_at');

            $table->index(['company_id', 'client_id']);
            $table->index(['starts_at', 'ends_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropIndex(['company_id', 'client_id']);
            $table->dropIndex(['starts_at', 'ends_at']);
            $table->dropForeign(['client_id']);
            $table->dropColumn(['client_id', 'starts_at', 'ends_at', 'budget']);
        });
    }
};
