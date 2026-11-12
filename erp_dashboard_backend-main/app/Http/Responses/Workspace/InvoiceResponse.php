<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\InvoiceResource;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;

final class InvoiceResponse extends JsonResponse
{
    public function __construct(Invoice $invoice, string $message = '', int $status = 200)
    {
        parent::__construct([
            'message' => $message,
            'data' => InvoiceResource::make($invoice)->resolve(request()),
        ], $status);
    }
}