<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeeRateResource;
use App\Models\EmployeeRate;
use Illuminate\Http\JsonResponse;

final class EmployeeRateResponse extends JsonResponse
{
    public function __construct(EmployeeRate $rate, int $status = 200)
    {
        $rate->loadMissing(['changer']);

        parent::__construct(self::data($rate), $status);
    }

    public static function data(EmployeeRate $rate): array
    {
        return EmployeeRateResource::make($rate)->resolve(request());
    }
}
