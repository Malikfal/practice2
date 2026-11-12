<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ClientResource;
use App\Models\Client;
use Illuminate\Http\JsonResponse;

final class ClientResponse extends JsonResponse
{
    public function __construct(Client $client, int $status = 200)
    {
        parent::__construct(self::data($client), $status);
    }

    public static function data(Client $client): array
    {
        return ClientResource::make($client)->resolve(request());
    }
}
