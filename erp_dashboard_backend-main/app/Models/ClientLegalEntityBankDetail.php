<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Банковские реквизиты юридического лица клиента.
 *
 * @property string $id
 * @property string $client_legal_entity_id
 * @property string $checking_account
 * @property string $bank
 * @property string $bik
 * @property string $correspondent_account
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read ClientLegalEntity|null $legalEntity
 */
class ClientLegalEntityBankDetail extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'client_legal_entity_id',
        'checking_account',
        'bank',
        'bik',
        'correspondent_account',
    ];

    public function legalEntity(): BelongsTo
    {
        return $this->belongsTo(ClientLegalEntity::class, 'client_legal_entity_id');
    }
}
