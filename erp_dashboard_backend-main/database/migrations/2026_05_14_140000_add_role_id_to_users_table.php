<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'role_id')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->unsignedBigInteger('role_id')->nullable()->after('role');
                $table->index('role_id');
                $table->foreign('role_id')->references('id')->on('roles')->nullOnDelete();
            });
        }

        DB::statement('UPDATE "users" u SET "role_id" = r."id" FROM "roles" r WHERE u."role_id" IS NULL AND r."guard_name" = \'' . 'web' . '\' AND r."name"::text = u."role"::text AND ((u."company_id" IS NULL AND r."company_id" IS NULL) OR (u."company_id" = r."company_id"))');
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'role_id')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropForeign(['role_id']);
                $table->dropIndex(['role_id']);
                $table->dropColumn('role_id');
            });
        }
    }
};
