<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('finance_article', function (Blueprint $table): void {
            $table->string('default_distribution_period')
                ->default('CURRENT_DAY')
                ->after('distribution_method');
        });

        Schema::table('finance', function (Blueprint $table): void {
            $table->date('distribution_from')->nullable()->after('dateOfPayment');
            $table->date('distribution_to')->nullable()->after('distribution_from');
            $table->index(
                ['company_id', 'distribution_from', 'distribution_to'],
                'finance_company_distribution_period_idx',
            );
        });

        $paymentDateColumn = DB::connection()->getQueryGrammar()->wrap('dateOfPayment');

        DB::table('finance')->update([
            'distribution_from' => DB::raw($paymentDateColumn),
            'distribution_to' => DB::raw($paymentDateColumn),
        ]);
    }

    public function down(): void
    {
        Schema::table('finance', function (Blueprint $table): void {
            $table->dropIndex('finance_company_distribution_period_idx');
            $table->dropColumn(['distribution_from', 'distribution_to']);
        });

        Schema::table('finance_article', function (Blueprint $table): void {
            $table->dropColumn('default_distribution_period');
        });
    }
};
