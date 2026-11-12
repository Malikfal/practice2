<?php

use App\Enums\FinanceSource;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('finance', function (Blueprint $table): void {
            $table->string('source')->default(FinanceSource::MANUAL->value)->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('finance', function (Blueprint $table): void {
            $table->dropColumn('source');
        });
    }
};
