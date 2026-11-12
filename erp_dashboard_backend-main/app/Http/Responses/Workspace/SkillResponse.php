<?php

namespace App\Http\Responses\Workspace;

use App\Models\Skill;
use Illuminate\Http\JsonResponse;

final class SkillResponse extends JsonResponse
{
    public function __construct(Skill $skill, int $status = 200)
    {
        parent::__construct(self::data($skill), $status);
    }

    public static function data(Skill $skill): array
    {
        return [
            'id' => (string) $skill->id,
            'company_id' => (string) $skill->company_id,
            'name' => $skill->name,
            'created_at' => $skill->created_at?->toISOString(),
            'updated_at' => $skill->updated_at?->toISOString(),
        ];
    }
}

