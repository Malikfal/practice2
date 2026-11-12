<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Responses\Meta\PermissionsResponse;
use App\Http\Responses\Meta\RolesResponse;
use Illuminate\Http\JsonResponse;

class MetaController extends Controller
{
    public function roles(): JsonResponse
    {
        return new RolesResponse();
    }

    public function permissions(): JsonResponse
    {
        return new PermissionsResponse();
    }
}
