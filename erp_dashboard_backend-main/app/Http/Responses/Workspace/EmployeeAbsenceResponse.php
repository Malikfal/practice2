<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeeAbsenceResource;
use App\Models\EmployeeAbsence;
use Illuminate\Http\JsonResponse;

final class EmployeeAbsenceResponse extends JsonResponse
{
    public function __construct(EmployeeAbsence $absence, int $status = 200)
    {
        $absence->loadMissing(['creator', 'updater']);

        parent::__construct(self::data($absence), $status);
    }

    public static function data(EmployeeAbsence $absence): array
    {
        return EmployeeAbsenceResource::make($absence)->resolve(request());
    }
}
