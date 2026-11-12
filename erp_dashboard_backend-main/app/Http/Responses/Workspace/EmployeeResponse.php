<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeeResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;

final class EmployeeResponse extends JsonResponse
{
    public function __construct(User $user, int $status = 200)
    {
        parent::__construct(self::data($user), $status);
    }

    public static function data(User $user): array
    {
        return EmployeeResource::make($user)->resolve(request());
    }
}
