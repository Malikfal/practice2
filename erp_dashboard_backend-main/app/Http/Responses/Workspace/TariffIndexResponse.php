<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TariffResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class TariffIndexResponse extends JsonResponse
{
    public function __construct(Collection $tariffs, int $status = 200)
    {
        parent::__construct([
            'data' => TariffResource::collection($tariffs)->resolve(request()),
        ], $status);
    }
}