<?php

use App\Enums\ProjectStatus;
use Carbon\CarbonImmutable;
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
            Schema::create('project_activity_histories', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
                $table->date('started_on');
                $table->date('ended_on')->nullable();
                $table->timestamps();
                $table->comment('Периоды активности проекта. ended_on не входит в активный период; null обозначает текущую активность.');

                $table->index(['project_id', 'started_on', 'ended_on'], 'project_activity_period_idx');
            });

            $fallbackTimezone = self::validTimezone(
                (string) config('payroll.timezone', 'Europe/Moscow'),
                'Europe/Moscow',
            );
            $createdAt = CarbonImmutable::now($fallbackTimezone);

            DB::table('projects')
                ->leftJoin('companies', 'companies.id', '=', 'projects.company_id')
                ->orderBy('projects.id')
                ->get([
                    'projects.id',
                    'projects.status',
                    'projects.created_at',
                    'companies.timezone',
                ])
                ->chunk(500)
                ->each(static function ($projects) use ($createdAt, $fallbackTimezone): void {
                    DB::table('project_activity_histories')->insert(
                        $projects->map(static function (object $project) use ($createdAt, $fallbackTimezone): array {
                            $timezone = self::validTimezone((string) $project->timezone, $fallbackTimezone);
                            $startedOn = $project->created_at
                                ? CarbonImmutable::parse((string) $project->created_at, $fallbackTimezone)
                                    ->setTimezone($timezone)
                                    ->toDateString()
                                : CarbonImmutable::today($timezone)->toDateString();

                            return [
                                'id' => (string) Str::uuid(),
                                'project_id' => $project->id,
                                'started_on' => $startedOn,
                                'ended_on' => $project->status === ProjectStatus::ARCHIVED->value
                                    ? CarbonImmutable::today($timezone)->toDateString()
                                    : null,
                                'created_at' => $createdAt,
                                'updated_at' => $createdAt,
                            ];
                        })->all(),
                    );
                });

            DB::statement(
                'CREATE UNIQUE INDEX project_activity_open_unique ON project_activity_histories (project_id) WHERE ended_on IS NULL'
            );

            Schema::table('projects', function (Blueprint $table): void {
                $table->dropColumn('archived_at');
            });

        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            Schema::table('projects', function (Blueprint $table): void {
                $table->timestamp('archived_at')->nullable()->after('status');
            });

            DB::table('projects')
                ->where('status', ProjectStatus::ARCHIVED->value)
                ->orderBy('id')
                ->get(['id'])
                ->each(static function (object $project): void {
                    $endedOn = DB::table('project_activity_histories')
                        ->where('project_id', $project->id)
                        ->whereNotNull('ended_on')
                        ->max('ended_on');

                    DB::table('projects')->where('id', $project->id)->update([
                        'archived_at' => $endedOn,
                    ]);
                });

            Schema::dropIfExists('project_activity_histories');
        });
    }

    private static function validTimezone(string $timezone, string $fallback): string
    {
        return in_array($timezone, timezone_identifiers_list(), true) ? $timezone : $fallback;
    }
};
