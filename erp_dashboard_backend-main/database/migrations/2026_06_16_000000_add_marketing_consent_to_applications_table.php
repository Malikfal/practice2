<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('applications') && !Schema::hasColumn('applications', 'marketing_consent')) {
            Schema::table('applications', function (Blueprint $table) {
                $table->boolean('marketing_consent')->default(false)->after('personal_data_consent');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('applications') && Schema::hasColumn('applications', 'marketing_consent')) {
            Schema::table('applications', function (Blueprint $table) {
                $table->dropColumn('marketing_consent');
            });
        }
    }
};
