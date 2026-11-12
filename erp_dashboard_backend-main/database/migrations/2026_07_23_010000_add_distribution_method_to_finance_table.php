<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('finance', function (Blueprint $table): void {
            // Null preserves the article-based method for legacy and automated payments.
            $table->string('distribution_method')
                ->nullable()
                ->after('distribution_to');
        });
    }

    public function down(): void
    {
        Schema::table('finance', function (Blueprint $table): void {
            $table->dropColumn('distribution_method');
        });
    }
};
