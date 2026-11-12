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
        if (!Schema::hasTable('employee_rates')) {
            Schema::create('employee_rates', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuId('employee_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedBigInteger('salary')->nullable();
                $table->unsignedBigInteger('hourly_rate')->nullable();
                $table->unsignedBigInteger('supervised_hourly_rate')->nullable();
                $table->date('effective_from');
                $table->foreignUuId('changed_by')->constrained('users');
                $table->timestamps();
                $table->unique(['employee_id', 'effective_from']);
                $table->index(['employee_id', 'effective_from']);
            });
        }
        
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_rates');
    }
};
