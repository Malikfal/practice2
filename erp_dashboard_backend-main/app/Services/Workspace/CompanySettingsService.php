<?php

namespace App\Services\Workspace;

use App\Models\User;

class CompanySettingsService
{
    public function show(User $user): array
    {
        $company = $user->company;

        return [
            'requisites' => $company->requisites ?? [],
            'timezone' => $company->payrollTimezone(),
            'unestimated_task_limit_seconds' => $company->unestimatedTaskLimitSeconds(),
        ];
    }

    public function update(User $user, array $data): array
    {
        $company = $user->company;

        $company->update(array_filter([
            'requisites' => $data['requisites'] ?? null,
        ], static fn (mixed $value): bool => $value !== null));

        return $this->show($user);
    }

    public function updateTimezone(User $user, string $timezone): array
    {
        $user->company->update(['timezone' => $timezone]);

        return $this->show($user);
    }

    public function updateUnestimatedTaskLimit(User $user, int $seconds): array
    {
        $user->company->update(['unestimated_task_limit_seconds' => $seconds]);

        return $this->show($user);
    }
}
