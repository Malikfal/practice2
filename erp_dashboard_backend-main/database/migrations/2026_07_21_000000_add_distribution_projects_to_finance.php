<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('finance_article', function (Blueprint $table): void {
            $table->string('default_distribution_project_mode')
                ->default('ALL')
                ->after('default_distribution_period');
            $table->jsonb('default_distribution_project_ids')
                ->nullable()
                ->after('default_distribution_project_mode');
        });

        Schema::table('finance', function (Blueprint $table): void {
            // Null marks a legacy payment whose project allocation must remain unchanged.
            $table->string('distribution_project_mode')
                ->nullable()
                ->after('distribution_to');
            $table->jsonb('distribution_project_ids')
                ->nullable()
                ->after('distribution_project_mode');
        });
    }

    public function down(): void
    {
        Schema::table('finance', function (Blueprint $table): void {
            $table->dropColumn([
                'distribution_project_mode',
                'distribution_project_ids',
            ]);
        });

        Schema::table('finance_article', function (Blueprint $table): void {
            $table->dropColumn([
                'default_distribution_project_mode',
                'default_distribution_project_ids',
            ]);
        });
    }
};
