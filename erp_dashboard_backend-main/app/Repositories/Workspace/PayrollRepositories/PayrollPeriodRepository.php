<?php

namespace App\Repositories\Workspace\PayrollRepositories;

use App\Models\Company;
use App\Models\EmployeeRate;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PayrollPeriodRepository
{
    /**
     * Строит интервалы, внутри которых не меняется набор действующих ставок.
     *
     * @return Collection<int, array{from: Carbon, to: Carbon}>
     */
    public function rateSlices(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        return $this->slices($this->rateBoundaries($company, $from, $to));
    }

    /**
     * Дополнительно делит период по началу и окончанию назначений менеджеров.
     *
     * @return Collection<int, array{from: Carbon, to: Carbon}>
     */
    public function supervisedSlices(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        $boundaries = $this->rateBoundaries($company, $from, $to);

        DB::table('project_assignment_histories as assignment')
            ->join('projects as p', 'p.id', '=', 'assignment.project_id')
            ->where('p.company_id', $company->id)
            ->where('assignment.is_pm', true)
            ->where(function (Builder $query) use ($from, $to): void {
                $query
                    ->whereBetween('assignment.started_on', [$from->toDateString(), $to->toDateString()])
                    ->orWhereBetween('assignment.ended_on', [$from->toDateString(), $to->toDateString()]);
            })
            ->get(['assignment.started_on', 'assignment.ended_on'])
            ->each(function (object $assignment) use ($company, $boundaries, $from, $to): void {
                $this->pushBoundary($company, $boundaries, $assignment->started_on, $from, $to);
                $this->pushBoundary($company, $boundaries, $assignment->ended_on, $from, $to);
            });

        return $this->slices($this->normalizeBoundaries($boundaries));
    }

    /** @return Collection<int, Carbon> */
    private function rateBoundaries(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        $boundaries = collect([Carbon::instance($from)->copy()]);

        EmployeeRate::query()
            ->whereDate('effective_from', '>', $from->toDateString())
            ->whereDate('effective_from', '<', $to->toDateString())
            ->whereHas('employee', static fn ($query) => $query->where('company_id', $company->id))
            ->orderBy('effective_from')
            ->pluck('effective_from')
            ->each(function (mixed $date) use ($company, $boundaries, $from, $to): void {
                $this->pushBoundary($company, $boundaries, $date, $from, $to);
            });

        $boundaries->push(Carbon::instance($to)->copy());

        return $this->normalizeBoundaries($boundaries);
    }

    /** @return Collection<int, Carbon> */
    private function normalizeBoundaries(Collection $boundaries): Collection
    {
        return $boundaries
            ->unique(static fn (Carbon $boundary): string => (string) $boundary->timestamp)
            ->sortBy(static fn (Carbon $boundary): int => $boundary->timestamp)
            ->values();
    }

    private function pushBoundary(
        Company $company,
        Collection $boundaries,
        mixed $value,
        CarbonInterface $from,
        CarbonInterface $to,
    ): void {
        if (! $value) {
            return;
        }

        // Поля назначений и ставок являются календарными датами компании, а не UTC-моментами.
        $localDate = $value instanceof CarbonInterface ? $value->toDateString() : (string) $value;
        $date = Carbon::parse($localDate, $company->payrollTimezone())->startOfDay();

        // Начало и конец общего периода уже добавлены отдельно.
        if ($date->gt($from) && $date->lt($to)) {
            $boundaries->push($date);
        }
    }

    /** @return Collection<int, array{from: Carbon, to: Carbon}> */
    private function slices(Collection $boundaries): Collection
    {
        // Каждые две соседние границы образуют полуоткрытый интервал [from, to).
        return $boundaries
            ->values()
            ->map(function (Carbon $from, int $index) use ($boundaries): ?array {
                $to = $boundaries->get($index + 1);

                return $to && $from->lt($to) ? ['from' => $from, 'to' => $to] : null;
            })
            ->filter()
            ->values();
    }
}
