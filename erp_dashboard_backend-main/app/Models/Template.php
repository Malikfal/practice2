<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Повторно используемый шаблон проекта.
 *
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property string|null $manager_id
 * @property string|null $created_by_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property bool $is_default
 * @property-read Company|null $company
 * @property-read User|null $manager
 * @property-read User|null $createdBy
 * @property-read Collection<int, TemplateMember> $members
 * @property-read Collection<int, User> $users
 * @property-read Collection<int, TemplateTaskStatusColumn> $statusColumns
 */
class Template extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'is_default',
        'manager_id',
        'created_by_id',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id')->withBlocked();
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id')->withBlocked();
    }

    public function members(): HasMany
    {
        return $this->hasMany(TemplateMember::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'template_members')->withTimestamps();
    }

    public function statusColumns(): HasMany
    {
        return $this->hasMany(TemplateTaskStatusColumn::class)->orderBy('position');
    }

    public function resolveRouteBinding($value, $field = null): ?self
    {
        $template = $this->where($field ?? $this->getRouteKeyName(), $value)->firstOrFail();
        $actor = auth()->user();

        if ($actor && ! $actor->isSuperAdmin() && (string) $actor->company_id !== (string) $template->company_id) {
            abort(404);
        }

        return $template;
    }
}
