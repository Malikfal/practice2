<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('finance_article')
            ->where('distribution_method', 'NONE')
            ->update(['distribution_method' => 'BY_TERM']);

        DB::statement("ALTER TABLE finance_article ALTER COLUMN distribution_method SET DEFAULT 'BY_TERM'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE finance_article ALTER COLUMN distribution_method SET DEFAULT 'NONE'");

        DB::table('finance_article')
            ->where('distribution_method', 'BY_TERM')
            ->update(['distribution_method' => 'NONE']);
    }
};
