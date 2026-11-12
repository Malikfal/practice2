<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Клиент компании и его профиль в рабочем пространстве.
 *
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $description
 * @property int|null $weekly_limit_seconds Недельный лимит, общий на все проекты клиента.
 * @property-read Company|null $company
 * @property-read Collection<int, ClientContact> $contacts
 * @property-read Collection<int, ClientLegalEntity> $legalEntities
 * @property-read Collection<int, Project> $projects
 */
class Client extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'description',
        'weekly_limit_seconds',
    ];

    protected function casts(): array
    {
        return [
            'weekly_limit_seconds' => 'integer',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(ClientContact::class);
    }

    public function legalEntities(): HasMany
    {
        return $this->hasMany(ClientLegalEntity::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }
}
