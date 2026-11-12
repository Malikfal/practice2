<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ClientLegalEntityBankDetailResource;
use App\Models\ClientLegalEntityBankDetail;
use Illuminate\Http\JsonResponse;

final class ClientLegalEntityBankDetailResponse extends JsonResponse
{
    public function __construct(ClientLegalEntityBankDetail $bankDetail, int $status = 200)
    {
        parent::__construct(self::data($bankDetail), $status);
    }

    public static function data(ClientLegalEntityBankDetail $bankDetail): array
    {
        return ClientLegalEntityBankDetailResource::make($bankDetail)->resolve(request());
    }
}
