<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ClientLegalEntityResource;
use App\Models\ClientLegalEntity;
use Illuminate\Http\JsonResponse;

final class ClientLegalEntityResponse extends JsonResponse
{
    public function __construct(ClientLegalEntity $legalEntity, int $status = 200)
    {
        $legalEntity->loadMissing(['bankDetails']);

        parent::__construct(self::data($legalEntity), $status);
    }

    public static function data(ClientLegalEntity $legalEntity): array
    {
        return ClientLegalEntityResource::make($legalEntity)->resolve(request());
    }
}
