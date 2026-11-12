<?php

namespace App\Http\Resources\Workspace;

use App\Models\EmployeeRate;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

/**
 * @mixin EmployeeRate
 */
final class EmployeeRateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $changer = $this->changer;

        return [
            'id' => (string) $this->id,
            'employee_id' => (string) $this->employee_id,
            'salary' => $this->salary,
            'salary_distribution_scope' => $this->salary_distribution_scope?->value,
            'hourly_rate' => $this->hourly_rate,
            'supervised_hourly_rate' => $this->supervised_hourly_rate,
            'company_hourly_rate' => $this->company_hourly_rate,
            'exclude_from_supervised_hours' => (bool) $this->exclude_from_supervised_hours,
            'rate_settings' => $this->rateSettings(),
            'effective_from' => $this->effective_from?->toDateString(),
            'changed_by' => $changer ? [
                'id' => (string) $changer->id,
                'name' => $changer->name,
                'last_name' => $changer->last_name,
                'email' => $changer->email,
            ] : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    /**
     * Возвращает настройки ставок с названиями проектов у отдельных ставок проектов.
     *
     * @return Collection<int, mixed>
     */
    private function rateSettings(): Collection
    {
        $settings = collect($this->rate_settings ?? [])->values();
        $projectIds = $settings
            ->flatMap(static fn (mixed $setting): array => is_array($setting) ? ($setting['project_rates'] ?? []) : [])
            ->pluck('project_id')
            ->filter()
            ->unique()
            ->values();

        if ($projectIds->isEmpty()) {
            return $settings;
        }

        $projectNames = Project::query()
            ->whereIn('id', $projectIds->all())
            ->pluck('name', 'id');

        return $settings->map(static function (mixed $setting) use ($projectNames): mixed {
            if (! is_array($setting) || empty($setting['project_rates'])) {
                return $setting;
            }

            $setting['project_rates'] = collect($setting['project_rates'])
                ->map(static fn (array $projectRate): array => [
                    ...$projectRate,
                    'project_name' => $projectNames->get($projectRate['project_id'] ?? ''),
                ])
                ->values()
                ->all();

            return $setting;
        });
    }
}
