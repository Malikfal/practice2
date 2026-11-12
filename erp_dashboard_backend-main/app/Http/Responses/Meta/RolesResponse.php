<?php

namespace App\Http\Responses\Meta;

use App\Support\RoleCatalog;
use Illuminate\Http\JsonResponse;

final class RolesResponse extends JsonResponse
{
    public function __construct()
    {
        parent::__construct(
            RoleCatalog::assignableOptionsForCompany((string) auth()->user()?->company_id)
        );
    }
}
