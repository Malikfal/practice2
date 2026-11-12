<?php

namespace App\Services\Workspace;

use App\Enums\Currency;
use App\Enums\ProjectStatus;
use App\Enums\UserRole;
use App\Models\Company;
use App\Models\Project;
use App\Models\ProjectRate;
use App\Repositories\Workspace\Reports\TimeReportRepository;
use App\Support\CurrentWeek;
use Illuminate\Support\Collection;

class ProjectExportService
{
    public function __construct(
        private readonly TimeReportRepository $reports,
    ) {}

    public function csv(array $data, string $companyId): string
    {
        $projects = $this->projects($data, $companyId);
        $projectIds = $projects
            ->pluck('id')
            ->map(static fn ($id): string => (string) $id)
            ->all();

        $weeklySecondsByProject = $this->weeklySecondsByProject($companyId, $projectIds);
        $ratesByProject = ProjectRate::currentForProjects($projectIds, Company::todayFor($companyId));

        $rows = $projects->map(function (Project $project) use ($weeklySecondsByProject, $ratesByProject): array {
            $weeklySeconds = (int) ($weeklySecondsByProject[(string) $project->id] ?? 0);
            $rate = $ratesByProject[(string) $project->id] ?? null;
            $weeklyAmount = $rate?->rate !== null
                ? (int) round($weeklySeconds * $rate->rate / 3600)
                : 0;

            return [
                'Название' => $project->name,
                'Клиент' => $project->client?->name ?? 'Не указано',
                'Статус' => $this->projectStatusLabel($project),
                'Менеджер' => $this->managerName($project),
                'Участники' => $this->membersNames($project),
                'Сроки' => $this->period($project),
                'Часы за неделю' => $this->duration($weeklySeconds),
                'Сумма' => $this->money($weeklyAmount, $rate?->currency ?? Currency::RUB),
                'Бюджет' => $project->budget !== null ? $this->money((int) $project->budget) : 'Не указано',
            ];
        });

        return $this->renderCsv($rows);
    }

    private function projects(array $data, string $companyId): Collection
    {
        $status = (string) ($data['status'] ?? 'all');
        $search = trim((string) ($data['search'] ?? ''));

        return Project::query()
            ->with(['client', 'members.user'])
            ->where('company_id', $companyId)
            ->when($status === 'active', static fn ($query) => $query->where('status', ProjectStatus::ACTIVE->value))
            ->when($status === 'archived', static fn ($query) => $query->where('status', ProjectStatus::ARCHIVED->value))
            ->when(
                $search !== '',
                static fn ($query) => $query->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($search).'%'])
            )
            ->orderByRaw(
                'CASE WHEN status = ? THEN 0 WHEN status = ? THEN 1 ELSE 2 END',
                [ProjectStatus::ACTIVE->value, ProjectStatus::ARCHIVED->value]
            )
            ->orderBy('name')
            ->get();
    }

    private function weeklySecondsByProject(string $companyId, array $projectIds): Collection
    {
        if ($projectIds === []) {
            return collect();
        }

        [$weekFrom, $weekTo] = CurrentWeek::bounds($companyId);

        return $this->reports
            ->own(
                $companyId,
                $weekFrom,
                $weekTo,
                'project',
                $projectIds,
            )
            ->mapWithKeys(static fn ($row): array => [(string) $row->project_id => (int) $row->duration_seconds]);
    }

    private function projectStatusLabel(Project $project): string
    {
        $status = $project->status instanceof ProjectStatus
            ? $project->status
            : ProjectStatus::tryFrom((string) $project->status);

        return $status?->label() ?? (string) $project->status;
    }

    private function managerName(Project $project): string
    {
        $manager = $project->members
            ->first(static fn ($member): bool => (string) $member->user?->role === UserRole::MANAGER->value)
            ?->user;

        return $manager ? $this->userName($manager) : 'Не указан';
    }

    private function membersNames(Project $project): string
    {
        $names = $project->members
            ->map(fn ($member): ?string => $member->user ? $this->userName($member->user) : null)
            ->filter()
            ->values();

        return $names->isNotEmpty() ? $names->join(', ') : 'Не указано';
    }

    private function userName(object $user): string
    {
        return trim((string) $user->name.' '.(string) $user->last_name);
    }

    private function period(Project $project): string
    {
        if ($project->starts_at && $project->ends_at) {
            return $project->starts_at->format('d.m.Y').' - '.$project->ends_at->format('d.m.Y');
        }

        if ($project->starts_at) {
            return 'с '.$project->starts_at->format('d.m.Y');
        }

        if ($project->ends_at) {
            return 'до '.$project->ends_at->format('d.m.Y');
        }

        return 'Не указано';
    }

    private function duration(int $seconds): string
    {
        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);
        $remainingSeconds = $seconds % 60;

        return sprintf('%d:%02d:%02d', $hours, $minutes, $remainingSeconds);
    }

    private function money(int $amount, Currency $currency = Currency::RUB): string
    {
        return number_format($amount / 100, 2, ',', ' ').' '.$currency->symbol();
    }

    private function renderCsv(Collection $rows): string
    {
        $headings = [
            'Название',
            'Клиент',
            'Статус',
            'Менеджер',
            'Участники',
            'Сроки',
            'Часы за неделю',
            'Сумма',
            'Бюджет',
        ];

        $handle = fopen('php://temp', 'rb+');

        fwrite($handle, "\xEF\xBB\xBF");
        fputcsv($handle, $headings, ';');

        foreach ($rows as $row) {
            fputcsv(
                $handle,
                array_map(static fn (string $heading): string => (string) ($row[$heading] ?? ''), $headings),
                ';'
            );
        }

        rewind($handle);
        $content = stream_get_contents($handle);
        fclose($handle);

        return $content;
    }
}
