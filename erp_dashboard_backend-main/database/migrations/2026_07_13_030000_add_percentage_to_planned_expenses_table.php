<?php

use App\Enums\PlannedExpenseCalculationPeriod;
use App\Enums\PlannedExpenseFormula;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('planned_expenses', function (Blueprint $table): void {
            $table->decimal('percentage', 7, 4)->nullable()->after('formula');
        });

        DB::table('planned_expenses')->update([
            'formula' => PlannedExpenseFormula::PERCENT_OF_INCOME->value,
            'calculation_period' => PlannedExpenseCalculationPeriod::MONTH->value,
        ]);
    }

    public function down(): void
    {
        Schema::table('planned_expenses', function (Blueprint $table): void {
            $table->dropColumn('percentage');
        });
    }
};
