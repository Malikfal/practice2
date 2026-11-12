<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', static function (Blueprint $table): void {
            $table->index(['company_id', 'last_name', 'name', 'email'], 'users_company_sort_idx');
            $table->index(['company_id', 'status'], 'users_company_status_idx');
        });

        Schema::table('projects', static function (Blueprint $table): void {
            $table->index(['company_id', 'name'], 'projects_company_name_idx');
            $table->index('client_id', 'projects_client_id_idx');
        });

        Schema::table('finance', static function (Blueprint $table): void {
            $table->index(['company_id', 'dateOfPayment'], 'finance_company_date_of_payment_idx');
            $table->index(['company_id', 'type', 'dateOfPayment'], 'finance_company_type_date_of_payment_idx');
            $table->index(['company_id', 'project_id', 'dateOfPayment'], 'finance_company_project_date_idx');
            $table->index(['company_id', 'employee_id', 'dateOfPayment'], 'finance_company_employee_date_idx');
            $table->index(['company_id', 'finance_article_id', 'dateOfPayment'], 'finance_company_article_date_idx');
        });
    }

    public function down(): void
    {
        Schema::table('users', static function (Blueprint $table): void {
            $table->dropIndex('users_company_sort_idx');
            $table->dropIndex('users_company_status_idx');
        });

        Schema::table('projects', static function (Blueprint $table): void {
            $table->dropIndex('projects_company_name_idx');
            $table->dropIndex('projects_client_id_idx');
        });

        Schema::table('finance', static function (Blueprint $table): void {
            $table->dropIndex('finance_company_date_of_payment_idx');
            $table->dropIndex('finance_company_type_date_of_payment_idx');
            $table->dropIndex('finance_company_project_date_idx');
            $table->dropIndex('finance_company_employee_date_idx');
            $table->dropIndex('finance_company_article_date_idx');
        });
    }
};
