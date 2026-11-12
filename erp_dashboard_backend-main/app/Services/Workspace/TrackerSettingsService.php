<?php

namespace App\Services\Workspace;

use App\Models\Company;
use App\Models\TaskStatusColumn;
use App\Models\User;

class TrackerSettingsService
{
    private const DEFAULT_TASK_STATUS_NAME = 'В работе';

    public function show(User $user): array
    {
        return [
            'default_task_status_name' => $this->effectiveDefaultStatusName($user->company),
            'client_task_status_name' => $this->effectiveClientTaskStatusName($user->company),
            'available_statuses' => $this->availableStatuses($user),
        ];
    }

    public function update(User $user, array $data): array
    {
        $attributes = [];
        foreach ([
            'default_task_status_name' => 'tracker_default_task_status_name',
            'client_task_status_name' => 'client_task_status_name',
        ] as $key => $column) {
            if (array_key_exists($key, $data)) {
                $normalizedName = trim((string) ($data[$key] ?? ''));
                $attributes[$column] = $normalizedName !== '' ? $normalizedName : null;
            }
        }

        if ($attributes !== []) {
            $user->company()->update($attributes);
        }

        return $this->show($user->fresh('company'));
    }

    /**
     * Статус задач, которые создаёт клиент. Пока он не выбран, действует статус трекера по умолчанию.
     */
    public function effectiveClientTaskStatusName(?Company $company): string
    {
        $storedName = trim((string) ($company?->client_task_status_name ?? ''));

        return $storedName !== '' ? $storedName : $this->effectiveDefaultStatusName($company);
    }

    private function effectiveDefaultStatusName(?Company $company): string
    {
        $storedName = trim((string) ($company?->tracker_default_task_status_name ?? ''));

        return $storedName !== '' ? $storedName : self::DEFAULT_TASK_STATUS_NAME;
    }

    /**
     * @return array<int, string>
     */
    private function availableStatuses(User $user): array
    {
        $statuses = TaskStatusColumn::query()
            ->where('company_id', $user->company_id)
            ->selectRaw('MIN(name) as name, LOWER(TRIM(name)) as normalized_name')
            ->whereRaw("TRIM(name) <> ''")
            ->groupByRaw('LOWER(TRIM(name))')
            ->orderBy('normalized_name')
            ->get()
            ->pluck('name')
            ->map(static fn ($name): string => trim((string) $name))
            ->filter(static fn (string $name): bool => $name !== '')
            ->values()
            ->all();

        foreach ([$this->effectiveClientTaskStatusName($user->company), $this->effectiveDefaultStatusName($user->company)] as $selectedName) {
            if (! in_array($selectedName, $statuses, true)) {
                array_unshift($statuses, $selectedName);
            }
        }

        return array_values(array_unique($statuses));
    }
}
