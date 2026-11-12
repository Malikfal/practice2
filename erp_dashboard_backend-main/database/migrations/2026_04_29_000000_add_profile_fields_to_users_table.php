<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('position')->nullable();
            $table->date('birthday')->nullable();
            $table->string('phone')->nullable();
            $table->json('socials')->nullable();
            $table->text('skills')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('position');
            $table->dropColumn('birthday');
            $table->dropColumn('phone');
            $table->dropColumn('socials');
            $table->dropColumn('skills');
        });
    }
};
