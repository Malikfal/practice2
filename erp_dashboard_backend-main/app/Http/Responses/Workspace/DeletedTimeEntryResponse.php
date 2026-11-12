<?php

namespace App\Http\Responses\Workspace;

use Illuminate\Http\JsonResponse;

final class DeletedTimeEntryResponse extends JsonResponse
{
    public function __construct(array $result, int $status = 200)
    {
        parent::__construct([
            'message' => (string) ($result['message'] ?? 'Время успешно удалено.'),
        ], $status);
    }
}
