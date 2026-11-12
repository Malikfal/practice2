<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('task_client_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignUuid('author_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->text('text')->nullable();
            $table->boolean('is_from_client')->default(false);
            $table->timestamps();

            $table->index(['task_id', 'created_at'], 'task_client_messages_task_id_created_at_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_client_messages');
    }
};
