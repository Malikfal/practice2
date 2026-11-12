<?php

namespace App\Http\Responses\Common;

use Illuminate\Http\JsonResponse;

final class MessageResponse extends JsonResponse
{
    public function __construct(string $message, int $status = 200)
    {
        parent::__construct(['message' => $message], $status);
    }
}
