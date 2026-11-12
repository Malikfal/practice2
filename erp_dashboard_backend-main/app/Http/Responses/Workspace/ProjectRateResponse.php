<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectRateResource;
use App\Models\ProjectRate;
use Illuminate\Http\JsonResponse;

final class ProjectRateResponse extends JsonResponse
{
    public function __construct(ProjectRate $rate, int $status = 200)
    {
        $rate->loadMissing(['changer']);

        parent::__construct(self::data($rate), $status);
    }

    public static function data(ProjectRate $rate): array
    {
        return ProjectRateResource::make($rate)->resolve(request());
    }
}
