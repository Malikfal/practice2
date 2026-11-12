<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Согласование клиента запрашивается у каждой задачи: по умолчанию «Ожидает согласования».
 * Значение по умолчанию задаём в базе, потому что задачи создаёт и основной API.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE tasks ALTER COLUMN client_approval_status SET DEFAULT 'pending'");
        DB::table('tasks')->whereNull('client_approval_status')->update(['client_approval_status' => 'pending']);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE tasks ALTER COLUMN client_approval_status DROP DEFAULT');
    }
};
