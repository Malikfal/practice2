<?php

namespace App\Services\Workspace;

use App\Models\Template;
use App\Models\TemplateMember;
use App\Models\TemplateTaskStatusColumn;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class TemplateService
{
    public function __construct(
        private readonly ProjectTaskStatusColumnService $projectTaskStatusColumnService,
    ) {
    }

    public function paginate(array $data, string $companyId): LengthAwarePaginator
    {
        $search = trim((string) ($data['search'] ?? ''));

        return Template::query()
            ->with(['manager', 'members.user', 'statusColumns'])
            ->where('company_id', $companyId)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->when(
                $search !== '',
                fn ($query) => $query->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($search).'%'])
            )
            ->paginate((int) ($data['per_page'] ?? 20))
            ->withQueryString();
    }

    public function create(User $user, array $data): Template
    {
        $companyId = $this->companyId($user);

        return DB::transaction(function () use ($user, $data, $companyId): Template {
            $memberIds = $this->normalizeMemberIds($data['member_ids'] ?? [], $data['manager_id'] ?? null, $companyId);
            $statusColumns = $this->normalizeStatusColumns($data['status_columns'] ?? null);

            $template = Template::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => trim((string) $data['name']),
                'is_default' => (bool) ($data['is_default_template'] ?? false),
                'manager_id' => $data['manager_id'] ?? null,
                'created_by_id' => $user->id,
            ]);

            $this->syncDefaultTemplate($template, (bool) $template->is_default);
            $this->syncMembers($template, $memberIds);
            $this->syncStatusColumns($template, $statusColumns);

            return $template->load(['manager', 'members.user', 'statusColumns']);
        });
    }

    public function update(Template $template, array $data): Template
    {
        return DB::transaction(function () use ($template, $data): Template {
            $memberIds = $this->normalizeMemberIds(
                $data['member_ids'] ?? [],
                $data['manager_id'] ?? null,
                (string) $template->company_id,
            );
            $statusColumns = $this->normalizeStatusColumns($data['status_columns'] ?? null);
            $isDefault = (bool) ($data['is_default_template'] ?? $template->is_default);

            $template->update([
                'name' => trim((string) $data['name']),
                'is_default' => $isDefault,
                'manager_id' => $data['manager_id'] ?? null,
            ]);

            $this->syncDefaultTemplate($template, $isDefault);
            $this->syncMembers($template, $memberIds);
            $this->syncStatusColumns($template, $statusColumns);

            return $template->fresh()->load(['manager', 'members.user', 'statusColumns']);
        });
    }

    public function delete(Template $template): void
    {
        $template->delete();
    }

    private function normalizeMemberIds(array $rawMemberIds, ?string $managerId, string $companyId): array
    {
        $memberIds = collect($rawMemberIds)
            ->filter(static fn (mixed $value): bool => is_string($value) && trim($value) !== '')
            ->map(static fn (string $value): string => trim($value));

        if ($managerId !== null && trim($managerId) !== '') {
            $memberIds->push(trim($managerId));
        }

        $memberIds = $memberIds->unique()->values();

        if ($memberIds->isEmpty()) {
            return [];
        }

        $activeUserIds = User::query()
            ->where('company_id', $companyId)
            ->whereIn('id', $memberIds->all())
            ->pluck('id')
            ->map(static fn ($id): string => (string) $id)
            ->values();

        $invalidIds = $memberIds->diff($activeUserIds)->values();

        if ($invalidIds->isNotEmpty()) {
            throw ValidationException::withMessages([
                'member_ids' => ['В команде шаблона можно указывать только активных сотрудников компании.'],
            ]);
        }

        return $memberIds->all();
    }

    private function syncMembers(Template $template, array $memberIds): void
    {
        TemplateMember::query()
            ->where('template_id', $template->id)
            ->whereNotIn('user_id', $memberIds)
            ->delete();

        foreach ($memberIds as $memberId) {
            TemplateMember::firstOrCreate(
                [
                    'template_id' => $template->id,
                    'user_id' => $memberId,
                ],
                [
                    'id' => (string) Str::uuid(),
                ],
            );
        }
    }

    private function normalizeStatusColumns(?array $columns): array
    {
        return $this->projectTaskStatusColumnService->normalizeDefinitions(
            $columns ?? $this->projectTaskStatusColumnService->defaultDefinitions(),
        );
    }

    private function syncStatusColumns(Template $template, array $columns): void
    {
        TemplateTaskStatusColumn::query()
            ->where('template_id', $template->id)
            ->delete();

        foreach ($columns as $column) {
            TemplateTaskStatusColumn::create([
                'id' => (string) Str::uuid(),
                'template_id' => $template->id,
                'name' => $column['name'],
                'slug' => $column['slug'],
                'color' => $column['color'],
                'position' => $column['position'],
                'is_default' => $column['is_default'],
                'is_final' => $column['is_final'],
            ]);
        }
    }

    private function syncDefaultTemplate(Template $template, bool $isDefault): void
    {
        if (! $isDefault) {
            return;
        }

        Template::query()
            ->where('company_id', $template->company_id)
            ->where('id', '!=', $template->id)
            ->update(['is_default' => false]);
    }

    private function companyId(User $user): string
    {
        $companyId = (string) $user->company_id;

        if ($companyId === '') {
            throw new NotFoundHttpException;
        }

        return $companyId;
    }
}
