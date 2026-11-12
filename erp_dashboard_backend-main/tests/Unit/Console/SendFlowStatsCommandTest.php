<?php

namespace Tests\Unit\Console;

use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SendFlowStatsCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        DB::connection()->getPdo()->sqliteCreateFunction('GREATEST', max(...), -1);
        DB::connection()->getPdo()->sqliteCreateFunction('LEAST', min(...), -1);
        $this->createSchema();
        DB::table('companies')->insert(['id' => 'company', 'timezone' => 'Europe/Moscow']);
        DB::table('users')->insert(['id' => 'ivan', 'company_id' => 'company', 'name' => 'Иван', 'last_name' => 'Петров', 'email' => 'ivan@example.test']);
        DB::table('projects')->insert(['id' => 'shop', 'company_id' => 'company', 'name' => 'Shop', 'is_internal' => false]);
        DB::table('tasks')->insert(['id' => 'task', 'project_id' => 'shop']);
        DB::table('work_segments')->insert([
            'task_id' => 'task',
            'user_id' => 'ivan',
            'started_at' => CarbonImmutable::parse('2026-11-04 09:00', 'Europe/Moscow')->timestamp,
            'ended_at' => CarbonImmutable::parse('2026-11-04 10:00', 'Europe/Moscow')->timestamp,
        ]);

        config()->set('services.flow_stats.company_id', 'company');
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true])]);
    }

    protected function tearDown(): void
    {
        foreach (['work_segments', 'tasks', 'projects', 'users', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_dry_run_prints_messages_and_sends_nothing(): void
    {
        config()->set('services.flow_stats.bot_token', 'token');
        config()->set('services.flow_stats.chat_ids', '-100');

        $this->artisan('reports:send-flow-stats', ['--report' => 'daily', '--at' => '2026-11-04 12:00', '--dry-run' => true])
            ->expectsOutputToContain('daily, 2026-11-04 12:00 MSK, company')
            ->expectsOutputToContain('Иван Петров              1.0     1.0       1.0')
            ->assertSuccessful();

        Http::assertNothingSent();
    }

    public function test_messages_are_sent_as_html_to_every_chat(): void
    {
        config()->set('services.flow_stats.bot_token', 'token');
        config()->set('services.flow_stats.chat_ids', '-100, -200');

        $this->artisan('reports:send-flow-stats', ['--report' => 'daily', '--at' => '2026-11-04 12:00'])
            ->assertSuccessful();

        // Два сообщения дневной статистики в каждый чат: внутренних проектов нет.
        Http::assertSentCount(4);
        Http::assertSent(static fn (Request $request): bool => $request->url() === 'https://api.telegram.org/bottoken/sendMessage'
            && $request['chat_id'] === '-200'
            && $request['parse_mode'] === 'HTML'
            && str_contains($request['text'], '<pre>'));
    }

    public function test_connection_error_is_logged_without_bot_token(): void
    {
        config()->set('services.flow_stats.bot_token', 'secret-token');
        config()->set('services.flow_stats.chat_ids', '-100');
        Http::fake(['api.telegram.org/*' => static fn () => throw new ConnectionException(
            'cURL error 28: Connection timed out for https://api.telegram.org/botsecret-token/sendMessage',
        )]);
        Log::shouldReceive('error')->once()->withArgs(
            static fn (string $message, array $context): bool => ! str_contains($context['message'], 'secret-token'),
        );

        $this->artisan('reports:send-flow-stats', ['--report' => 'daily', '--at' => '2026-11-04 12:00'])
            ->assertFailed();
    }

    public function test_sending_fails_without_telegram_settings(): void
    {
        $this->artisan('reports:send-flow-stats', ['--report' => 'top'])->assertFailed();

        Http::assertNothingSent();
    }

    public function test_unknown_report_is_rejected(): void
    {
        $this->artisan('reports:send-flow-stats', ['--report' => 'monthly', '--dry-run' => true])
            ->assertExitCode(2);
    }

    public function test_schedule_is_registered_only_when_enabled_and_uses_company_timezone(): void
    {
        $this->assertSame([], $this->flowStatsEvents());

        DB::table('companies')->where('id', 'company')->update(['timezone' => 'Asia/Novosibirsk']);
        config()->set('services.flow_stats.enabled', true);
        $events = $this->flowStatsEvents();

        $this->assertSame([
            ['--report=top', '10 9 * * 1', 'Asia/Novosibirsk'],
            ['--report=daily', '10 9,13,17 * * *', 'Asia/Novosibirsk'],
            ['--report=weekly', '59 20 * * 0', 'Asia/Novosibirsk'],
        ], $events);
    }

    public function test_schedule_falls_back_to_moscow_when_database_is_unavailable(): void
    {
        Schema::drop('companies');
        config()->set('services.flow_stats.enabled', true);

        $this->assertSame(['Europe/Moscow'], array_values(array_unique(array_column($this->flowStatsEvents(), 2))));
    }

    /**
     * @return list<array{0: string, 1: string, 2: string}>
     */
    private function flowStatsEvents(): array
    {
        $this->app->forgetInstance(Schedule::class);
        $events = array_filter(
            $this->app->make(Schedule::class)->events(),
            static fn (Event $event): bool => str_contains((string) $event->command, 'reports:send-flow-stats'),
        );

        return array_values(array_map(static fn (Event $event): array => [
            substr((string) $event->command, (int) strpos((string) $event->command, '--report=')),
            $event->expression,
            (string) $event->timezone,
        ], $events));
    }

    private function createSchema(): void
    {
        Schema::create('companies', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('timezone')->nullable();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->string('last_name')->nullable();
            $table->string('email');
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->boolean('is_internal')->default(false);
        });
        Schema::create('tasks', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
        });
        Schema::create('work_segments', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('task_id');
            $table->string('user_id');
            $table->unsignedBigInteger('started_at');
            $table->unsignedBigInteger('ended_at');
        });
    }
}
