<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Юридическое лицо клиента.
 *
 * @property string $id
 * @property string $client_id
 * @property string $name
 * @property string $legal_address
 * @property string $postal_code
 * @property string $inn
 * @property string|null $kpp
 * @property string|null $ogrn
 * @property string|null $signer_last_name
 * @property string|null $signer_first_name
 * @property string|null $signer_middle_name
 * @property string|null $signer_position
 * @property string|null $phone
 * @property string|null $email
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Client|null $client
 * @property-read Collection<int, ClientLegalEntityBankDetail> $bankDetails
 */
class ClientLegalEntity extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'client_id',
        'name',
        'legal_address',
        'postal_code',
        'inn',
        'kpp',
        'ogrn',
        'signer_last_name',
        'signer_first_name',
        'signer_middle_name',
        'signer_position',
        'phone',
        'email',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function bankDetails(): HasMany
    {
        return $this->hasMany(ClientLegalEntityBankDetail::class);
    }
}
