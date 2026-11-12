<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ClientLegalEntityBankDetailResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class ClientLegalEntityBankDetailIndexResponse extends JsonResponse
{
    public function __construct(Collection $bankDetails)
    {
        parent::__construct([
            'data' => ClientLegalEntityBankDetailResource::collection($bankDetails)->resolve(request()),
        ]);
    }
}
