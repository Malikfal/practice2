<?php

namespace Tests\Unit\Notifications;

use App\Enums\NotificationEvent;
use App\Models\Task;
use App\Models\User;
use App\Services\Notifications\NotificationAccess;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionProperty;
use Tests\TestCase;

/**
 * Схема SQLite и участники типичной задачи: PM, исполнитель, автор, участник, наблюдатель, посторонний и клиенты.
 */
abstract class NotificationTestCase extends TestCase
{
    protected const COMPANY = 'company-a';

    protected const PROJECT = 'project-1';

    protected const TASK = 'task-1';

    protected const CLIENT = 'client-1';

    private const TABLES = [
        'user_notifications', 'user_notification_settings', 'notification_rules', 'task_subscriptions',
        'client_account_projects', 'task_status_columns', 'task_users', 'tasks', 'project_members',
        'projects', 'users', 'roles', 'companies',
    ];

    protected AllowingNotificationAccess $access;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resetUserSchemaCache();

        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name')->default('ALT Studio');
            $table->string('timezone')->default('Europe/Moscow');
            $table->timestamps();
        });
        Schema::create('roles', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('guard_name')->default('web');
            $table->uuid('company_id')->nullable();
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('name')->default('Сотрудник');
            $table->string('last_name')->default('');
            $table->string('email')->nullable();
            $table->string('status')->default('ACTIVE');
            $table->unsignedBigInteger('role_id')->nullable();
            $table->uuid('client_id')->nullable();
            $table->boolean('client_all_projects')->default(true);
            $table->timestamps();
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->uuid('client_id')->nullable();
            $table->string('name')->default('Сайт');
            $table->string('status')->default('ACTIVE');
            $table->timestamps();
        });
        Schema::create('project_members', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('project_id');
            $table->uuid('user_id');
            $table->boolean('is_pm')->default(false);
            $table->boolean('is_pm_payroll_enabled')->default(false);
        });
        Schema::create('tasks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('project_id');
            $table->uuid('parent_task_id')->nullable();
            $table->uuid('created_by_id')->nullable();
            $table->uuid('task_status_column_id')->nullable();
            $table->string('title')->default('');
            $table->text('description')->nullable();
            $table->string('priority')->nullable();
            $table->integer('estimation')->nullable();
            $table->timestamp('deadline')->nullable();
            $table->boolean('is_draft')->default(false);
            $table->boolean('is_client_visible')->default(true);
            $table->string('client_approval_status')->nullable();
            $table->float('position')->default(0);
            $table->string('status')->default('TODO');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
        Schema::create('task_users', function (Blueprint $table): void {
            $table->uuid('task_id');
            $table->uuid('user_id');
        });
        Schema::create('task_status_columns', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('project_id');
            $table->uuid('company_id')->nullable();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('color')->nullable();
            $table->integer('position')->default(0);
            $table->boolean('is_final')->default(false);
            $table->timestamps();
        });
        Schema::create('client_account_projects', function (Blueprint $table): void {
            $table->uuid('user_id');
            $table->uuid('project_id');
            $table->timestamps();
        });
        Schema::create('task_subscriptions', function (Blueprint $table): void {
            $table->uuid('task_id');
            $table->uuid('user_id');
            $table->string('mode');
            $table->string('source')->default('manual');
            $table->timestamps();
            $table->primary(['task_id', 'user_id']);
        });
        Schema::create('notification_rules', function (Blueprint $table): void {
            $table->id();
            $table->uuid('company_id');
            $table->string('event');
            $table->string('relation');
            $table->boolean('enabled');
            $table->timestamps();
            $table->unique(['company_id', 'event', 'relation']);
        });
        Schema::create('user_notification_settings', function (Blueprint $table): void {
            $table->uuid('user_id')->primary();
            $table->json('disabled_events')->nullable();
            $table->boolean('auto_watch')->default(true);
            $table->timestamps();
        });
        Schema::create('user_notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('user_id');
            $table->uuid('actor_id')->nullable();
            $table->string('type');
            $table->uuid('task_id')->nullable();
            $table->uuid('project_id')->nullable();
            $table->json('data')->nullable();
            $table->json('reasons')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        $this->seedTeam();

        $this->access = new AllowingNotificationAccess;
        $this->app->instance(NotificationAccess::class, $this->access);
    }

    protected function tearDown(): void
    {
        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
        $this->resetUserSchemaCache();

        parent::tearDown();
    }

    /**
     * Участники задачи task-1 проекта project-1 (клиент client-1).
     */
    private function seedTeam(): void
    {
        DB::table('companies')->insert(['id' => self::COMPANY, 'name' => 'ALT Studio']);
        DB::table('roles')->insert([
            ['id' => 1, 'name' => 'MANAGER'],
            ['id' => 2, 'name' => 'WORKER'],
            ['id' => 3, 'name' => 'CLIENT'],
            ['id' => 4, 'name' => 'ADMIN'],
        ]);
        DB::table('projects')->insert(['id' => self::PROJECT, 'company_id' => self::COMPANY, 'client_id' => self::CLIENT]);

        foreach (['pm', 'assignee', 'creator', 'member', 'watcher', 'outsider', 'actor'] as $id) {
            $this->staff($id);
        }
        $this->client('client-user');

        DB::table('project_members')->insert([
            ['id' => 'pm-member', 'project_id' => self::PROJECT, 'user_id' => 'pm', 'is_pm' => true],
            ['id' => 'assignee-member', 'project_id' => self::PROJECT, 'user_id' => 'assignee', 'is_pm' => false],
            ['id' => 'creator-member', 'project_id' => self::PROJECT, 'user_id' => 'creator', 'is_pm' => false],
            ['id' => 'member-member', 'project_id' => self::PROJECT, 'user_id' => 'member', 'is_pm' => false],
            ['id' => 'actor-member', 'project_id' => self::PROJECT, 'user_id' => 'actor', 'is_pm' => false],
        ]);
        DB::table('tasks')->insert([
            'id' => self::TASK,
            'project_id' => self::PROJECT,
            'created_by_id' => 'creator',
            'title' => 'Главная страница',
        ]);
        DB::table('task_users')->insert(['task_id' => self::TASK, 'user_id' => 'assignee']);
        $this->subscribe('watcher', 'watch');
    }

    protected function staff(string $id, array $attributes = []): void
    {
        DB::table('users')->insert([
            'id' => $id,
            'company_id' => self::COMPANY,
            'name' => ucfirst($id),
            'role_id' => 2,
            ...$attributes,
        ]);
    }

    protected function admin(string $id, array $attributes = []): void
    {
        $this->staff($id, ['role_id' => 4, ...$attributes]);
    }

    protected function client(string $id, array $attributes = []): void
    {
        DB::table('users')->insert([
            'id' => $id,
            'company_id' => self::COMPANY,
            'name' => 'Клиент '.$id,
            'role_id' => 3,
            'client_id' => self::CLIENT,
            'client_all_projects' => true,
            ...$attributes,
        ]);
    }

    protected function subscribe(string $userId, string $mode, string $taskId = self::TASK): void
    {
        DB::table('task_subscriptions')->insert([
            'task_id' => $taskId,
            'user_id' => $userId,
            'mode' => $mode,
            'source' => 'manual',
        ]);
    }

    protected function rule(NotificationEvent $event, string $relation, bool $enabled): void
    {
        DB::table('notification_rules')->insert([
            'company_id' => self::COMPANY,
            'event' => $event->value,
            'relation' => $relation,
            'enabled' => $enabled,
        ]);
    }

    protected function task(): Task
    {
        return Task::query()->with('project')->findOrFail(self::TASK);
    }

    protected function user(string $id): User
    {
        return User::query()->findOrFail($id);
    }

    /**
     * Флаги наличия колонок модель User кеширует на весь процесс, а схема у тестов разная.
     */
    private function resetUserSchemaCache(): void
    {
        foreach (['usersHasRoleIdColumn', 'usersHasRoleColumn'] as $property) {
            (new ReflectionProperty(User::class, $property))->setValue(null, null);
        }
    }
}
