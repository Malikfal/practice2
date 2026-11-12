<?php

namespace App\Http\Resources\Workspace;

use App\Models\ClientLegalEntity;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ClientLegalEntity
 */
final class ClientLegalEntityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'client_id' => (string) $this->client_id,
            'name' => $this->name,
            'legal_address' => $this->legal_address,
            'postal_code' => $this->postal_code,
            'inn' => $this->inn,
            'kpp' => $this->kpp,
            'ogrn' => $this->ogrn,
            'signer_last_name' => $this->signer_last_name,
            'signer_first_name' => $this->signer_first_name,
            'signer_middle_name' => $this->signer_middle_name,
            'signer_position' => $this->signer_position,
            'phone' => $this->phone,
            'email' => $this->email,
            'bank_details' => $this->whenLoaded(
                'bankDetails',
                fn () => ClientLegalEntityBankDetailResource::collection($this->bankDetails)->resolve($request),
            ),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
