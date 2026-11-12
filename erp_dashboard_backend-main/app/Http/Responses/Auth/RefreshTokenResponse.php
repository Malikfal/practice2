<?php

namespace App\Http\Responses\Auth;

use Illuminate\Http\JsonResponse;

final class RefreshTokenResponse extends JsonResponse
{
    public function __construct()
    {
        parent::__construct(['message' => 'Token refreshed.']);
    }
}
