<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('user_project_orders')) {
            Schema::create('user_project_orders', function (Blueprint $table): void {
                $table->id();
                $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
                $table->unsignedInteger('position');
                $table->timestamps();

                $table->unique(['user_id', 'project_id']);
                $table->index(['user_id', 'position']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_project_orders');
    }
};
