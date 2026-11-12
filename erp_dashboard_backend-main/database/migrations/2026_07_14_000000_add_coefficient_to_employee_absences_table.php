<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_absences', function (Blueprint $table): void {
            $table->decimal('coefficient', 10, 4)->default(1)->after('fixed_daily_amount');
        });
    }

    public function down(): void
    {
        Schema::table('employee_absences', function (Blueprint $table): void {
            $table->dropColumn('coefficient');
        });
    }
};
