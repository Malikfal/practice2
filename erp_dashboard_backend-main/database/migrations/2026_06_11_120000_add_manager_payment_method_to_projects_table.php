<?php

use App\Enums\ProjectManagerPaymentMethod;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->string('manager_payment_method')
                ->default(ProjectManagerPaymentMethod::ACCRUE_ALL->value)
                ->after('budget');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn('manager_payment_method');
        });
    }
};
