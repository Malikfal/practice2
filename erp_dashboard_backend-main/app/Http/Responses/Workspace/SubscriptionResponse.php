<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\InvoiceResource;
use App\Http\Resources\Workspace\SubscriptionResource;
use Illuminate\Http\JsonResponse;

final class SubscriptionResponse extends JsonResponse
{
    public function __construct(?array $data, int $status = 200)
    {
        parent::__construct([
            'data' => [
                'subscription' => $data && $data['subscription'] 
                    ? SubscriptionResource::make($data['subscription'])->resolve(request()) 
                    : null,
                'active_employees_count' => $data['active_employees_count'] ?? 0,
                'pending_invoice' => $data && isset($data['pending_invoice']) && $data['pending_invoice']
                    ? InvoiceResource::make($data['pending_invoice'])->resolve(request())
                    : null,
            ]
        ], $status);
    }
}