<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeeAbsenceResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class EmployeeAbsenceIndexResponse extends JsonResponse
{
    public function __construct(Collection $absences)
    {
        $absences->loadMissing(['creator', 'updater']);

        parent::__construct([
            'data' => EmployeeAbsenceResource::collection($absences)->resolve(request()),
        ]);
    }
}
