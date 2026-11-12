<?php

namespace App\Services\Workspace;

use App\Models\Skill;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SkillService
{
    public function list(array $data, string $companyId): Collection
    {
        $search = trim((string) ($data['search'] ?? ''));
        $normalizedSearch = $this->normalizeName($search);

        return Skill::query()
            ->where('company_id', $companyId)
            ->when($search !== '', function ($query) use ($search, $normalizedSearch): void {
                $query->where(function ($query) use ($search, $normalizedSearch): void {
                    $query
                        ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($search).'%'])
                        ->orWhere('normalized_name', 'like', '%'.$normalizedSearch.'%');
                });
            })
            ->orderBy('name')
            ->limit(50)
            ->get();
    }

    public function normalizeSkillNamesFromString(?string $rawSkills): Collection
    {
        return collect(explode(',', (string) $rawSkills))
            ->map(static fn (string $value): string => trim(preg_replace('/\s+/', ' ', $value) ?? ''))
            ->filter(static fn (string $value): bool => $value !== '')
            ->unique(fn (string $value): string => mb_strtolower($value))
            ->values();
    }

    public function joinSkillNames(Collection $skillNames): ?string
    {
        $value = $skillNames->join(', ');
        return $value !== '' ? $value : null;
    }

    public function syncUserSkills(User $employee, Collection $skillNames): void
    {
        $companyId = (string) $employee->company_id;
        if ($companyId === '') {
            $employee->competencies()->sync([]);
            return;
        }

        DB::transaction(function () use ($employee, $skillNames, $companyId): void {
            $skillIds = [];

            foreach ($skillNames as $name) {
                $skill = Skill::query()->firstOrCreate(
                    [
                        'company_id' => $companyId,
                        'normalized_name' => $this->normalizeName($name),
                    ],
                    [
                        'id' => (string) Str::uuid(),
                        'name' => $name,
                    ]
                );

                $skillIds[] = (string) $skill->id;
            }

            $employee->competencies()->sync($skillIds);
        });
    }

    private function normalizeName(string $name): string
    {
        return mb_strtolower(trim($name));
    }
}

