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
        Schema::create('project_rates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->unsignedBigInteger('rate')->nullable();
            $table->unsignedBigInteger('vat')->nullable();
            $table->date('effective_from');
            $table->foreignUuId('changed_by')->constrained('users');
            $table->timestamps();
            $table->unique(['project_id', 'effective_from']);
            $table->index(['project_id', 'effective_from']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_rates');
    }
};
