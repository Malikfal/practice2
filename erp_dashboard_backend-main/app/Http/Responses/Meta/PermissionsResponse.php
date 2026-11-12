<?php

namespace App\Http\Responses\Meta;

use App\Enums\UserPermission;
use Illuminate\Http\JsonResponse;

final class PermissionsResponse extends JsonResponse
{
    public function __construct()
    {
        parent::__construct(
            array_map(
                static fn (UserPermission $permission): array => [
                    'value' => $permission->value,
                    'label' => $permission->label(),
                ],
                UserPermission::uiCases(),
            )
        );
    }
}
