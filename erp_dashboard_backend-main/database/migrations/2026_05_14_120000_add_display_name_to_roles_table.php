<?php

use App\Enums\UserRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('roles', 'display_name')) {
            Schema::table('roles', function (Blueprint $table): void {
                $table->string('display_name', 120)->nullable()->after('name');
            });
        }

        DB::table('roles')
            ->whereNull('display_name')
            ->update(['display_name' => DB::raw('name')]);

        DB::table('roles')->where('name', UserRole::ADMIN->value)->update(['display_name' => UserRole::ADMIN->label()]);
        DB::table('roles')->where('name', UserRole::MANAGER->value)->update(['display_name' => UserRole::MANAGER->label()]);
        DB::table('roles')->where('name', UserRole::WORKER->value)->update(['display_name' => UserRole::WORKER->label()]);
        DB::table('roles')->where('name', UserRole::SUPERADMIN->value)->update(['display_name' => UserRole::SUPERADMIN->label()]);
    }

    public function down(): void
    {
        if (Schema::hasColumn('roles', 'display_name')) {
            Schema::table('roles', function (Blueprint $table): void {
                $table->dropColumn('display_name');
            });
        }
    }
};
