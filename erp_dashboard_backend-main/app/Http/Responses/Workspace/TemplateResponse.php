<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TemplateResource;
use App\Models\Template;
use Illuminate\Http\JsonResponse;

final class TemplateResponse extends JsonResponse
{
    public function __construct(Template $template, int $status = 200)
    {
        parent::__construct(self::data($template), $status);
    }

    public static function data(Template $template): array
    {
        return TemplateResource::make($template)->resolve(request());
    }
}
