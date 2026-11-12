<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\InvoiceResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;

final class InvoiceIndexResponse extends JsonResponse
{
    public function __construct(LengthAwarePaginator $invoices, int $status = 200)
    {
        $resource = InvoiceResource::collection($invoices)->response()->getData(true);
        parent::__construct($resource, $status);
    }
}