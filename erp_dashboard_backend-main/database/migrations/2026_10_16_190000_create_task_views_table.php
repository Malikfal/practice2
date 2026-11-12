<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Последнее изменение из истории задачи или комментарий: по нему доска показывает метку "Есть изменения".
        Schema::table('tasks', function (Blueprint $table): void {
            $table->timestampTz('last_activity_at')->nullable();
            $table->foreignUuid('last_activity_by_id')->nullable()->constrained('users')->nullOnDelete();
        });

        // Когда пользователь последний раз открывал задачу.
        Schema::create('task_views', function (Blueprint $table): void {
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->timestampTz('viewed_at');

            $table->primary(['user_id', 'task_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_views');

        Schema::table('tasks', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('last_activity_by_id');
            $table->dropColumn('last_activity_at');
        });
    }
};
