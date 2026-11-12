<?php

namespace App\Http\Resources\Workspace;

use App\Models\ClientLegalEntityBankDetail;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ClientLegalEntityBankDetail
 */
final class ClientLegalEntityBankDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'client_legal_entity_id' => (string) $this->client_legal_entity_id,
            'checking_account' => $this->checking_account,
            'bank' => $this->bank,
            'bik' => $this->bik,
            'correspondent_account' => $this->correspondent_account,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
