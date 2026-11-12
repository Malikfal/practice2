<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Контактное лицо клиента.
 *
 * @property string $id
 * @property string $client_id
 * @property string $first_name
 * @property string|null $last_name
 * @property string|null $middle_name
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $position
 * @property string|null $comments
 * @property array<string, mixed>|null $payload
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Client|null $client
 */
class ClientContact extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'client_id',
        'first_name',
        'last_name',
        'middle_name',
        'email',
        'phone',
        'position',
        'comments',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
