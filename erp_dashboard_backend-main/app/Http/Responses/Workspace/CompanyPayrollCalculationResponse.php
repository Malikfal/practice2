<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeePayrollCalculationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class CompanyPayrollCalculationResponse extends JsonResponse
{
    public function __construct(Collection $rows, string $from, string $to, array $meta)
    {
        parent::__construct([
            'from' => $from,
            'to' => $to,
            'data' => $rows->map(static fn (array $period): array => [
                'period_from' => $period['period_from'],
                'period_to' => $period['period_to'],
                'employees' => $period['employees']->map(static fn (array $item): array => [
                    'employee' => [
                        'id' => (string) $item['employee']->id,
                        'name' => $item['employee']->name,
                        'first_name' => $item['employee']->first_name,
                        'last_name' => $item['employee']->last_name,
                        'is_archived' => $item['employee']->archived_at !== null,
                    ],
                    'calculation' => (new EmployeePayrollCalculationResource($item['calculation']))->resolve(request()),
                ])->values()->all(),
            ])->values()->all(),
            'meta' => $meta,
        ]);
    }
}
