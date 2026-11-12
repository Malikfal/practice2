<?php

namespace App\Services\Payroll\Hours;

use App\Enums\PayrollProjectHoursType;
use App\Models\Company;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\PayrollDurationRepository;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class PayrollHoursService
{
    public function __construct(private readonly PayrollDurationRepository $durations) {}

    /** @return Collection<int, object> */
    public function own(Company $company, User $employee, CarbonInterface $from, CarbonInterface $to): Collection
    {
        return $this->durations->own($company, $employee, $from, $to);
    }

    /** @return Collection<int, object> */
    public function supervised(
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
    ): Collection {
        return $this->durations->supervised(
            $company,
            $employee,
            $from,
            $to,
        );
    }

    /** @return Collection<string, int> user_id => секунды */
    public function ownSecondsByEmployee(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        return $this->durations->ownSecondsByEmployee($company, $from, $to);
    }

    /** @return Collection<string, int> user_id => секунды */
    public function supervisedSecondsByEmployee(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        return $this->durations->supervisedSecondsByEmployee($company, $from, $to);
    }

    /** @return Collection<int, object> */
    public function company(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        return $this->durations->company($company, $from, $to);
    }

    /**
     * Делит переданные часы на коммерческие и внутренние проекты.
     *
     * @return Collection<string, int>
     */
    public function secondsByProjectType(Collection $durations): Collection
    {
        return collect([
            PayrollProjectHoursType::COMMERCIAL->value => (int) $durations
                ->reject(static fn (object $duration): bool => (bool) ($duration->is_internal ?? false))
                ->sum('duration_seconds'),
            PayrollProjectHoursType::INTERNAL->value => (int) $durations
                ->filter(static fn (object $duration): bool => (bool) ($duration->is_internal ?? false))
                ->sum('duration_seconds'),
        ]);
    }
}
