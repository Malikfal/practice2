<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('planned_expenses', function (Blueprint $table): void {
            $table->bigInteger('fixed_amount')->nullable()->after('percentage');
        });
    }

    public function down(): void
    {
        Schema::table('planned_expenses', function (Blueprint $table): void {
            $table->dropColumn('fixed_amount');
        });
    }
};
