<?php

namespace App\Http\Responses\Workspace;

use App\Models\Skill;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class SkillIndexResponse extends JsonResponse
{
    public function __construct(Collection $skills)
    {
        parent::__construct([
            'data' => $skills->map(
                static fn (Skill $skill): array => SkillResponse::data($skill)
            )->values(),
        ]);
    }
}

