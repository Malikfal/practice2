<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\FinanceResource;
use App\Models\Finance;
use Illuminate\Http\JsonResponse;

final class FinanceResponse extends JsonResponse
{
    public function __construct(Finance $finance, int $status = 200)
    {
        parent::__construct(self::data($finance), $status);
    }

    public static function data(Finance $finance): array
    {
        return FinanceResource::make($finance)->resolve(request());
    }
}
