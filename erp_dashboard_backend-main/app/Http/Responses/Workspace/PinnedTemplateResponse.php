<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\PinnedTemplateResource;
use App\Models\Template;
use Illuminate\Http\JsonResponse;

final class PinnedTemplateResponse extends JsonResponse
{
    public function __construct(Template $template, int $status = 200)
    {
        parent::__construct(self::data($template), $status);
    }

    public static function data(Template $template): array
    {
        return PinnedTemplateResource::make($template)->resolve(request());
    }
}
