<?php

namespace App\Models;

use App\Enums\Currency;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Почасовая ставка участника проекта.
 *
 * @property string $id
 * @property string $project_id
 * @property int|null $rate
 * @property int|null $vat
 * @property Currency $currency
 * @property Carbon $effective_from
 * @property string $changed_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Project|null $project
 * @property-read User|null $changer
 */
class ProjectRate extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'project_id',
        'rate',
        'vat',
        'currency',
        'effective_from',
        'changed_by',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'rate' => 'integer',
        'vat' => 'integer',
        'currency' => Currency::class,
    ];

    /**
     * Действующие на дату ставки проектов, по одной на проект.
     *
     * @param  array<int, string>  $projectIds
     * @return Collection<string, self>
     */
    public static function currentForProjects(array $projectIds, string $today): Collection
    {
        if ($projectIds === []) {
            return collect();
        }

        return self::query()
            ->whereIn('project_id', $projectIds)
            ->whereDate('effective_from', '<=', $today)
            ->orderBy('effective_from', 'desc')
            ->orderBy('created_at', 'desc')
            ->get()
            ->unique('project_id')
            ->keyBy('project_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
