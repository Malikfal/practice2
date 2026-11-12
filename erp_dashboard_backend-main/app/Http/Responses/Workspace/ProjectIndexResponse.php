<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectResource;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class ProjectIndexResponse extends JsonResponse
{
    public function __construct(LengthAwarePaginator|Collection $projects)
    {
        $collection = $projects instanceof LengthAwarePaginator
            ? $projects->getCollection()
            : $projects;

        if ($collection instanceof EloquentCollection) {
            $collection->loadMissing('latestActivityHistory');
        }

        $response = [
            'data' => ProjectResource::collection($collection)->resolve(request()),
        ];

        if ($projects instanceof LengthAwarePaginator) {
            $response['meta'] = [
                'current_page' => $projects->currentPage(),
                'last_page' => $projects->lastPage(),
                'per_page' => $projects->perPage(),
                'total' => $projects->total(),
            ];
        }

        parent::__construct($response);
    }
}
