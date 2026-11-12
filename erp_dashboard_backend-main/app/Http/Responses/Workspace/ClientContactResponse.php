<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ClientContactResource;
use App\Models\ClientContact;
use Illuminate\Http\JsonResponse;

final class ClientContactResponse extends JsonResponse
{
    public function __construct(ClientContact $contact, int $status = 200)
    {
        parent::__construct(self::data($contact), $status);
    }

    public static function data(ClientContact $contact): array
    {
        return ClientContactResource::make($contact)->resolve(request());
    }
}
