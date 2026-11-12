<?php

namespace App\Repositories\Workspace;

use App\Models\ProjectAssignmentHistory;
use App\Models\ProjectMember;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Str;

class ProjectAssignmentHistoryRepository
{
    /** Синхронизирует открытый исторический период с текущим назначением. */
    public function sync(ProjectMember $member, ?CarbonInterface $effectiveOn = null): void
    {
        $effectiveOn ??= today($member->project()->firstOrFail()->company()->firstOrFail()->payrollTimezone());

        $openAssignment = ProjectAssignmentHistory::query()
            ->where('project_id', $member->project_id)
            ->where('user_id', $member->user_id)
            ->whereNull('ended_on')
            ->lockForUpdate()
            ->first();

        $attributes = [
            'is_pm' => (bool) $member->is_pm,
            'is_pm_payroll_enabled' => (bool) ($member->is_pm && $member->is_pm_payroll_enabled),
        ];

        if ($openAssignment
            && $openAssignment->is_pm === $attributes['is_pm']
            && $openAssignment->is_pm_payroll_enabled === $attributes['is_pm_payroll_enabled']) {
            return;
        }

        // В пределах одного дня payroll не различает время, поэтому меняем срез на месте.
        if ($openAssignment?->started_on->isSameDay($effectiveOn)) {
            $openAssignment->update($attributes);

            return;
        }

        $openAssignment?->update(['ended_on' => $effectiveOn->toDateString()]);

        ProjectAssignmentHistory::query()->create([
            'id' => (string) Str::uuid(),
            'project_id' => $member->project_id,
            'user_id' => $member->user_id,
            ...$attributes,
            'started_on' => $effectiveOn->toDateString(),
            'ended_on' => null,
        ]);
    }

    /** Закрывает текущее назначение сотрудника на конкретный проект. */
    public function close(ProjectMember $member, ?CarbonInterface $effectiveOn = null): void
    {
        $effectiveOn ??= today($member->project()->firstOrFail()->company()->firstOrFail()->payrollTimezone());

        ProjectAssignmentHistory::query()
            ->where('project_id', $member->project_id)
            ->where('user_id', $member->user_id)
            ->whereNull('ended_on')
            ->whereDate('started_on', '<', $effectiveOn->toDateString())
            ->update(['ended_on' => $effectiveOn->toDateString()]);

        // Назначение, созданное и отменённое в один день, не образует период.
        ProjectAssignmentHistory::query()
            ->where('project_id', $member->project_id)
            ->where('user_id', $member->user_id)
            ->whereNull('ended_on')
            ->whereDate('started_on', '>=', $effectiveOn->toDateString())
            ->delete();
    }

    /** Закрывает историю и удаляет все текущие назначения архивируемого сотрудника. */
    public function closeAllForUser(User $employee, CarbonInterface $archivedOn): void
    {
        $employee->projectMembers()
            ->lockForUpdate()
            ->get()
            ->each(function (ProjectMember $member) use ($archivedOn): void {
                $this->close($member, $archivedOn);
                $member->delete();
            });
    }
}
