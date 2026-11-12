<?php

namespace App\Http\Resources\Workspace;

use App\Models\Task;
use Illuminate\Http\Request;

/**
 * @mixin Task
 */
final class UserTaskBoardTaskResource extends TaskResource
{
    public function toArray(Request $request): array
    {
        $data = parent::toArray($request);
        $project = $this->project;
        $statusColumn = $this->statusColumn;

        $data['project'] = $project ? [
            'id' => (string) $project->id,
            'name' => $project->name,
        ] : null;
        $data['status_column'] = $statusColumn
            ? TaskStatusColumnResource::make($statusColumn)->resolve($request)
            : null;

        return $data;
    }
}
