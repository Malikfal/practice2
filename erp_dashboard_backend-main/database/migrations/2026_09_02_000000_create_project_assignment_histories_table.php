<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            // Сначала приводим дату архивации к той же дневной точности, что и периоды назначений.
            Schema::table('users', function (Blueprint $table): void {
                $table->date('archived_at')->nullable()->comment('Дата архивирования пользователя')->change();
            });

            Schema::create('project_assignment_histories', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
                $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
                $table->boolean('is_pm')->default(false);
                $table->boolean('is_pm_payroll_enabled')->default(false);
                $table->date('started_on');
                $table->date('ended_on')->nullable();
                $table->timestamps();
                $table->comment('История назначений участников проекта. Каждая запись представляет период, когда пользователь был участником проекта. Если ended_on = null, значит пользователь в данный момент является участником проекта.');

                $table->index(['project_id', 'started_on', 'ended_on'], 'project_assignment_period_idx');
                $table->index(['user_id', 'started_on', 'ended_on'], 'user_assignment_period_idx');
            });

            // Активным сотрудникам создаём открытый период, архивным — закрытый датой архивации.
            DB::table('project_members')
                ->join('projects', 'projects.id', '=', 'project_members.project_id')
                ->join('users', 'users.id', '=', 'project_members.user_id')
                ->select([
                    'project_members.project_id',
                    'project_members.user_id',
                    'project_members.is_pm',
                    'project_members.is_pm_payroll_enabled',
                    'projects.created_at',
                    'users.status',
                    'users.archived_at',
                ])
                ->orderBy('project_members.project_id')
                ->orderBy('project_members.user_id')
                ->get()
                ->chunk(500)
                ->each(static function ($members): void {
                    $nowMoscow = now('Europe/Moscow');
                    DB::table('project_assignment_histories')->insert(
                        $members->map(static function (object $member) use ($nowMoscow): array {
                            $isArchived = $member->status === 'BLOCKED';

                            return [
                                'id' => (string) Str::uuid(),
                                'project_id' => $member->project_id,
                                'user_id' => $member->user_id,
                                'is_pm' => (bool) $member->is_pm,
                                'is_pm_payroll_enabled' => (bool) ($member->is_pm && $member->is_pm_payroll_enabled),
                                'started_on' => $member->created_at
                                    ? date('Y-m-d', strtotime((string) $member->created_at)) // дата создания проекта
                                    : $nowMoscow->toDateString(),
                                'ended_on' => $isArchived
                                    ? ($member->archived_at ?: $nowMoscow->toDateString())
                                    : null,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ];
                        })->all(),
                    );
                });

            // Архивный пользователь больше не является текущим участником проектов.
            DB::table('project_members')
                ->whereIn('user_id', DB::table('users')
                    ->select('id')
                    ->where('status', 'BLOCKED'))
                ->delete();

            DB::statement(
                'CREATE UNIQUE INDEX project_assignment_open_unique ON project_assignment_histories (project_id, user_id) WHERE ended_on IS NULL'
            );
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            // Возвращаем назначения, которые были закрыты именно из-за архивации пользователя.
            DB::table('project_assignment_histories as assignment')
                ->join('users', 'users.id', '=', 'assignment.user_id')
                ->where('users.status', 'BLOCKED')
                ->whereColumn('assignment.ended_on', 'users.archived_at')
                ->orderBy('assignment.project_id')
                ->orderBy('assignment.user_id')
                ->orderByDesc('assignment.started_on')
                ->get([
                    'assignment.project_id',
                    'assignment.user_id',
                    'assignment.is_pm',
                    'assignment.is_pm_payroll_enabled',
                ])
                ->unique(static fn (object $assignment): string => $assignment->project_id.':'.$assignment->user_id)
                ->chunk(500)
                ->each(static function ($assignments): void {
                    DB::table('project_members')->insertOrIgnore(
                        $assignments->map(static fn (object $assignment): array => [
                            'id' => (string) Str::uuid(),
                            'project_id' => $assignment->project_id,
                            'user_id' => $assignment->user_id,
                            'is_pm' => (bool) $assignment->is_pm,
                            'is_pm_payroll_enabled' => (bool) $assignment->is_pm_payroll_enabled,
                        ])->all(),
                    );
                });

            Schema::dropIfExists('project_assignment_histories');

            Schema::table('users', function (Blueprint $table): void {
                $table->timestamp('archived_at')->nullable()->comment('Дата архивирования пользователя')->change();
            });
        });
    }
};
