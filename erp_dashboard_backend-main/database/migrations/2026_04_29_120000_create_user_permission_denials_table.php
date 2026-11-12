<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_permission_denials', static function (Blueprint $table): void {
            $table->uuid('user_id');
            $table->unsignedBigInteger('permission_id');
            $table->timestamps();

            $table->primary(['user_id', 'permission_id']);
            $table->index('user_id');
            $table->foreign('permission_id')
                ->references('id')
                ->on(config('permission.table_names.permissions', 'permissions'))
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_permission_denials');
    }
};
