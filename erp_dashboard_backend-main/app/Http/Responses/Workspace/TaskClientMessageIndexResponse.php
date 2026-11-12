<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskClientMessageResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class TaskClientMessageIndexResponse extends JsonResponse
{
    public function __construct(Collection $messages, ?string $approvalStatus)
    {
        parent::__construct([
            'client_approval_status' => $approvalStatus,
            'data' => TaskClientMessageResource::collection($messages)->resolve(request()),
        ]);
    }
}