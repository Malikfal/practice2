<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\BankDetailResource;
use App\Models\BankDetail;
use Illuminate\Http\JsonResponse;

final class BankDetailResponse extends JsonResponse
{
    public function __construct(?BankDetail $bankDetail, int $status = 200)
    {
        parent::__construct([
            'data' => $bankDetail ? self::data($bankDetail) : null,
        ], $status);
    }

    public static function data(BankDetail $bankDetail): array
    {
        return BankDetailResource::make($bankDetail)->resolve(request());
    }
}
