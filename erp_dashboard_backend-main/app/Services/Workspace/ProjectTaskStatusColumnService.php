<?php

namespace App\Services\Workspace;

use App\Enums\ProjectStatus;
use App\Models\Project;
use App\Models\TaskStatusColumn;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectTaskStatusColumnService {
    private const DEFAULT_COLUMNS = [
        [
            'slug' => 'todo',
            'name' => 'Сделать',
            'color' => '#4db6f2',
            'position' => 1,
            'is_default' => true,
            'is_final' => false,
        ],
        [
            'slug' => 'in_progress',
            'name' => 'В работе',
            'color' => '#f29a3f',
            'position' => 2,
            'is_default' => false,
            'is_final' => false,
        ],
        [
            'slug' => 'review',
            'name' => 'На проверке',
            'color' => '#ef2d2d',
            'position' => 3,
            'is_default' => false,
            'is_final' => false,
        ],
        [
            'slug' => 'done',
            'name' => 'Завершено',
            'color' => '#60c94a',
            'position' => 4,
            'is_default' => false,
            'is_final' => true,
        ],
    ];
    public function defaultDefinitions(): array
    {
        return self::DEFAULT_COLUMNS;
    }

    public function createDefaults(Project $project): void
    {
        $this->createFromDefinitions($project, self::DEFAULT_COLUMNS);
    }

    public function createFromDefinitions(Project $project, array $columns): void
    {
        $normalizedColumns = $this->normalizeDefinitions($columns);

        foreach ($normalizedColumns as $column) {
            TaskStatusColumn::firstOrCreate(
                [
                    'project_id' => $project->id,
                    'slug' => $column['slug'],
                ],
                [
                    'id' => (string) Str::uuid(),
                    'company_id' => $project->company_id,
                    'name' => $column['name'],
                    'color' => $column['color'],
                    'position' => $column['position'],
                    'is_default' => $column['is_default'],
                    'is_final' => $column['is_final'],
                ]
            );
        }
    }
    public function list(Project $project): Collection
    {
        return TaskStatusColumn::query()
            ->where('project_id', $project->id)
            ->orderBy('position')
            ->orderBy('name')
            ->get();
    }

    public function store(User $user, Project $project, array $data): TaskStatusColumn
    {
        $this->assertProjectAccess($user, $project);
        $this->assertProjectIsEditable($project);
        $this->assertUniqueColumnName($project, (string) $data['name']);

        return DB::transaction(function () use ($project, $data): TaskStatusColumn {
            $isDefault = (bool) ($data['is_default'] ?? false);
            $isFinal = (bool) ($data['is_final'] ?? false);

            if ($isDefault) {
                $this->resetDefaultColumns($project);
            }

            $column = TaskStatusColumn::create([
                'id' => (string) Str::uuid(),
                'company_id' => $project->company_id,
                'project_id' => $project->id,
                'name' => trim((string) $data['name']),
                'slug' => $this->uniqueSlug($project, (string) ($data['slug'] ?? $data['name'])),
                'color' => $data['color'] ?? null,
                'position' => $this->nextPosition($project),
                'is_default' => $isDefault,
                'is_final' => $isFinal,
            ]);

            $this->ensureProjectHasDefaultColumn($project);

            return $column->fresh();
        });
    }

    public function update(User $user, Project $project, TaskStatusColumn $column, array $data): TaskStatusColumn
    {
        $this->assertProjectAccess($user, $project);
        $this->assertProjectIsEditable($project);
        $this->assertColumnBelongsToProject($project, $column);
        $this->assertUniqueColumnName($project, (string) $data['name'], (string) $column->id);

        return DB::transaction(function () use ($project, $column, $data): TaskStatusColumn {
            $attributes = [
                'name' => trim((string) $data['name']),
                'color' => $data['color'] ?? null,
                'is_default' => (bool) ($data['is_default'] ?? $column->is_default),
                'is_final' => (bool) ($data['is_final'] ?? $column->is_final),
            ];

            if (array_key_exists('slug', $data)) {
                $attributes['slug'] = $this->uniqueSlug($project, (string) $data['slug'], (string) $column->id);
            }

            if ($attributes['is_default']) {
                $this->resetDefaultColumns($project);
            }

            $column->update($attributes);
            $this->ensureProjectHasDefaultColumn($project);

            return $column->fresh();
        });
    }

    public function delete(User $user, Project $project, TaskStatusColumn $column): void
    {
        $this->assertProjectAccess($user, $project);
        $this->assertProjectIsEditable($project);
        $this->assertColumnBelongsToProject($project, $column);

        if ($column->tasks()->exists()) {
            throw ValidationException::withMessages([
                'column_id' => ['Нельзя удалить колонку, в которой есть задачи.'],
            ]);
        }

        if ($this->list($project)->count() <= 1) {
            throw ValidationException::withMessages([
                'column_id' => ['Нельзя удалить последнюю колонку проекта.'],
            ]);
        }

        DB::transaction(function () use ($project, $column): void {
            $wasDefault = (bool) $column->is_default;

            $column->delete();
            $this->reindexPositions($project);

            if ($wasDefault) {
                $this->ensureProjectHasDefaultColumn($project);
            }
        });
    }

    public function reorder(User $user, Project $project, array $columns): Collection
    {
        $this->assertProjectAccess($user, $project);
        $this->assertProjectIsEditable($project);

        return DB::transaction(function () use ($project, $columns): Collection {
            $projectColumnIds = $this->list($project)
                ->pluck('id')
                ->map(static fn ($id): string => (string) $id)
                ->all();

            foreach ($columns as $column) {
                $columnId = (string) ($column['id'] ?? '');

                if (! in_array($columnId, $projectColumnIds, true)) {
                    throw ValidationException::withMessages([
                        'columns' => ['Одна из колонок не принадлежит выбранному проекту.'],
                    ]);
                }

                TaskStatusColumn::query()
                    ->where('project_id', $project->id)
                    ->where('id', $columnId)
                    ->update([
                        'position' => (int) $column['position'],
                    ]);
            }

            return $this->list($project);
        });
    }

    public function defaultColumn(Project $project): TaskStatusColumn
    {
        $column = TaskStatusColumn::query()
            ->where('project_id', $project->id)
            ->where('is_default', true)
            ->orderBy('position')
            ->first();

        if ($column) {
            return $column;
        }

        $column = TaskStatusColumn::query()
            ->where('project_id', $project->id)
            ->orderBy('position')
            ->first();

        if ($column) {
            $column->update(['is_default' => true]);

            return $column->fresh();
        }

        $this->createDefaults($project);

        return TaskStatusColumn::query()
            ->where('project_id', $project->id)
            ->where('is_default', true)
            ->firstOrFail();
    }

    private function assertProjectAccess(User $user, Project $project): void
    {
        if ($user->isSuperAdmin()) {
            return;
        }

        if (! $user->canAccessAssignedProject($project)) {
            throw new NotFoundHttpException();
        }
    }

    private function assertProjectIsEditable(Project $project): void
    {
        if ($project->status === ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'project_id' => ['Нельзя изменять колонки архивного проекта.'],
            ]);
        }
    }

    private function assertColumnBelongsToProject(Project $project, TaskStatusColumn $column): void
    {
        if ((string) $column->project_id !== (string) $project->id) {
            throw new NotFoundHttpException();
        }
    }

    private function resetDefaultColumns(Project $project): void
    {
        TaskStatusColumn::query()
            ->where('project_id', $project->id)
            ->update(['is_default' => false]);
    }

    private function ensureProjectHasDefaultColumn(Project $project): void
    {
        $hasDefault = TaskStatusColumn::query()
            ->where('project_id', $project->id)
            ->where('is_default', true)
            ->exists();

        if ($hasDefault) {
            return;
        }

        TaskStatusColumn::query()
            ->where('project_id', $project->id)
            ->orderBy('position')
            ->limit(1)
            ->update(['is_default' => true]);
    }

    private function nextPosition(Project $project): int
    {
        return (int) TaskStatusColumn::query()
            ->where('project_id', $project->id)
            ->max('position') + 1;
    }

    private function uniqueSlug(Project $project, string $value, ?string $exceptColumnId = null): string
    {
        $baseSlug = Str::slug($value);
        if ($baseSlug === '') {
            $baseSlug = 'status';
        }

        $slug = $baseSlug;
        $suffix = 2;

        while ($this->slugExists($project, $slug, $exceptColumnId)) {
            $slug = $baseSlug.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    private function slugExists(Project $project, string $slug, ?string $exceptColumnId = null): bool
    {
        return TaskStatusColumn::query()
            ->where('project_id', $project->id)
            ->where('slug', $slug)
            ->when($exceptColumnId, static fn ($query) => $query->where('id', '!=', $exceptColumnId))
            ->exists();
    }

    private function reindexPositions(Project $project): void
    {
        $this->list($project)->values()->each(static function (TaskStatusColumn $column, int $index): void {
            $column->update(['position' => $index + 1]);
        });
    }

    private function assertUniqueColumnName(Project $project, string $name, ?string $exceptColumnId = null): void
    {
        $exists = TaskStatusColumn::query()
            ->where('project_id', $project->id)
            ->whereRaw('LOWER(TRIM(name)) = ?', [$this->normalizeColumnName($name)])
            ->when(
                $exceptColumnId,
                static fn ($query) => $query->where('id', '!=', $exceptColumnId),
            )
            ->exists();

        if (! $exists) {
            return;
        }

        throw ValidationException::withMessages([
            'name' => ['В проекте уже есть статус с таким названием.'],
        ]);
    }

    private function normalizeColumnName(string $name): string
    {
        return mb_strtolower(trim($name));
    }
    
    public function normalizeDefinitions(array $columns): array
    {
        $normalized = collect($columns)
            ->map(function (mixed $column, int $index): array {
                $name = trim((string) data_get($column, 'name'));

                return [
                    'name' => $name !== '' ? $name : 'Статус '.($index + 1),
                    'slug' => trim((string) data_get($column, 'slug')),
                    'color' => data_get($column, 'color') ?: null,
                    'position' => $index + 1,
                    'is_default' => (bool) data_get($column, 'is_default', false),
                    'is_final' => (bool) data_get($column, 'is_final', false),
                ];
            })
            ->filter(static fn (array $column): bool => $column['name'] !== '')
            ->values();

        if ($normalized->isEmpty()) {
            $normalized = collect(self::DEFAULT_COLUMNS);
        }

        $defaultIndex = $normalized->search(static fn (array $column): bool => $column['is_default']);
        $defaultIndex = $defaultIndex === false ? 0 : $defaultIndex;

        $usedSlugs = [];

        return $normalized
            ->values()
            ->map(function (array $column, int $index) use ($defaultIndex, &$usedSlugs): array {
                $baseSlug = $column['slug'] !== '' ? Str::slug($column['slug']) : Str::slug($column['name']);
                if ($baseSlug === '') {
                    $baseSlug = 'status';
                }

                $slug = $baseSlug;
                $suffix = 2;

                while (in_array($slug, $usedSlugs, true)) {
                    $slug = $baseSlug.'-'.$suffix;
                    $suffix++;
                }

                $usedSlugs[] = $slug;

                return [
                    'name' => $column['name'],
                    'slug' => $slug,
                    'color' => $column['color'],
                    'position' => $index + 1,
                    'is_default' => $index === $defaultIndex,
                    'is_final' => (bool) $column['is_final'],
                ];
            })
            ->all();
    }
}
