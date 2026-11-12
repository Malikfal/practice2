<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Уведомления по задачам:
 * - user_notifications — лента пользователя;
 * - notification_rules — настройки компании «событие × связь с задачей», хранятся только отличия от значений по умолчанию;
 * - user_notification_settings — личные настройки: выключенные события и автоподписка;
 * - task_subscriptions — «Следить» и «Не уведомлять» по отдельной задаче.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            // Пусто, если действие выполнено без входа, например согласование по публичной ссылке.
            $table->foreignUuid('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 64);
            $table->foreignUuid('task_id')->nullable()->constrained('tasks')->cascadeOnDelete();
            $table->foreignUuid('project_id')->nullable()->constrained('projects')->cascadeOnDelete();
            $table->jsonb('data')->default(new Expression("'{}'::jsonb"));
            $table->jsonb('reasons')->default(new Expression("'[]'::jsonb"));
            $table->timestampTz('read_at')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'created_at']);
            $table->index(['task_id', 'user_id']);
        });
        // Счётчик непрочитанных запрашивается при каждом открытии панели.
        DB::statement('CREATE INDEX user_notifications_unread_index ON user_notifications (user_id) WHERE read_at IS NULL');

        Schema::create('notification_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('event', 64);
            $table->string('relation', 32);
            $table->boolean('enabled');
            $table->timestampsTz();

            $table->unique(['company_id', 'event', 'relation']);
        });

        Schema::create('user_notification_settings', function (Blueprint $table): void {
            $table->foreignUuid('user_id')->primary()->constrained('users')->cascadeOnDelete();
            $table->jsonb('disabled_events')->default(new Expression("'[]'::jsonb"));
            // Следить за задачей после своего комментария или ответа клиенту.
            $table->boolean('auto_watch')->default(true);
            $table->timestampsTz();
        });

        Schema::create('task_subscriptions', function (Blueprint $table): void {
            $table->foreignUuid('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('mode', 16);
            // manual — пользователь нажал сам, auto — подписка после комментария.
            $table->string('source', 16)->default('manual');
            $table->timestampsTz();

            $table->primary(['task_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_subscriptions');
        Schema::dropIfExists('user_notification_settings');
        Schema::dropIfExists('notification_rules');
        Schema::dropIfExists('user_notifications');
    }
};
