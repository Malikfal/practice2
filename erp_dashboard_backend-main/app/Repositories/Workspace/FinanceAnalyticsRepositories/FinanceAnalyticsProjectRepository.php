<?php

namespace App\Repositories\Workspace\FinanceAnalyticsRepositories;

use App\Models\Project;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class FinanceAnalyticsProjectRepository
{
    /**
     * @param  Collection<int, string>  $projectIds
     * @param  Collection<int, string>  $clientIds
     * @param  Collection<int, string>  $managerIds
     * @return Collection<int, Project>
     */
    public function projects(string $companyId, Collection $projectIds, Collection $clientIds, Collection $managerIds): Collection
    {
        return $this->query($companyId, $projectIds, $clientIds, $managerIds)
            ->with([
                'client:id,name',
                'members' => fn ($query) => $query->where('is_pm', true)->with('user:id,name,last_name,email'),
                'activityHistories:id,project_id,started_on,ended_on',
            ])
            ->orderBy('name')->get(['id', 'name', 'status', 'client_id', 'company_id']);
    }

    /** Для расчёта долей нужны только активность и ID, а не связи каждого проекта.
     * @return Collection<int, Project>
     */
    public function allocationProjects(string $companyId): Collection
    {
        return Project::query()
            ->with('activityHistories:id,project_id,started_on,ended_on')
            ->where('company_id', $companyId)
            ->orderBy('name')
            ->get(['id']);
    }

    /** Отчёт сотрудников не использует названия, клиентов и менеджеров проектов.
     *
     * @param  Collection<int, string>  $projectIds
     * @param  Collection<int, string>  $clientIds
     * @param  Collection<int, string>  $managerIds
     * @return Collection<int, string>
     */
    public function projectIds(string $companyId, Collection $projectIds, Collection $clientIds, Collection $managerIds): Collection
    {
        return $this->query($companyId, $projectIds, $clientIds, $managerIds)->pluck('id')->map(strval(...));
    }

    /** Общие условия исключают расхождение полной выборки проектов и выборки их ID.
     *
     * @param  Collection<int, string>  $projectIds
     * @param  Collection<int, string>  $clientIds
     * @param  Collection<int, string>  $managerIds
     * @return Builder<Project>
     */
    private function query(string $companyId, Collection $projectIds, Collection $clientIds, Collection $managerIds): Builder
    {
        return Project::query()->where('company_id', $companyId)
            ->when($projectIds->isNotEmpty(), fn (Builder $query) => $query->whereIn('id', $projectIds))
            ->when($clientIds->isNotEmpty(), fn (Builder $query) => $query->whereIn('client_id', $clientIds))
            ->when($managerIds->isNotEmpty(), fn (Builder $query) => $query->whereHas('members',
                fn (Builder $members) => $members->where('is_pm', true)->whereIn('user_id', $managerIds)));
    }
}
