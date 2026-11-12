<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop legacy unique constraint: roles(name, guard_name)
        DB::statement('ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_guard_name_unique');

        // Ensure uniqueness for company-scoped roles
        DB::statement('
            CREATE UNIQUE INDEX IF NOT EXISTS roles_name_guard_name_company_id_unique
            ON roles (name, guard_name, company_id)
            WHERE company_id IS NOT NULL
        ');

        // Ensure uniqueness for global roles (company_id IS NULL), e.g. SUPERADMIN
        DB::statement('
            CREATE UNIQUE INDEX IF NOT EXISTS roles_name_guard_name_null_company_unique
            ON roles (name, guard_name)
            WHERE company_id IS NULL
        ');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS roles_name_guard_name_company_id_unique');
        DB::statement('DROP INDEX IF EXISTS roles_name_guard_name_null_company_unique');

        DB::statement('
            ALTER TABLE roles
            ADD CONSTRAINT roles_name_guard_name_unique UNIQUE (name, guard_name)
        ');
    }
};

