<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('bank_details')) {
            Schema::create('bank_details', static function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('employee_id')->constrained('users')->cascadeOnDelete();
                $table->text('details');
                $table->timestamps();

                $table->unique('employee_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_details');
    }
};
