<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectNoteResource;
use App\Models\ProjectNote;
use Illuminate\Http\JsonResponse;

final class ProjectNoteResponse extends JsonResponse
{
    public function __construct(ProjectNote $note, int $status = 200)
    {
        $note->loadMissing(['changer']);
        $note->loadMissing(['author']);
        $note->loadMissing(['visibleUsers', 'visibleRoles']);

        parent::__construct(self::data($note), $status);
    }

    public static function data(ProjectNote $note): array
    {
        return ProjectNoteResource::make($note)->resolve(request());
    }
}
