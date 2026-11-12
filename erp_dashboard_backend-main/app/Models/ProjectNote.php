<?php

namespace App\Models;

use App\Enums\ProjectNoteVisibility;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Заметка, связанная с проектом.
 *
 * @property string $id
 * @property string $company_id
 * @property string $project_id
 * @property string|null $author_id
 * @property string|null $changed_by
 * @property string|null $title
 * @property string $content
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property ProjectNoteVisibility $visibility
 * @property-read Company|null $company
 * @property-read Project|null $project
 * @property-read User|null $author
 * @property-read User|null $changer
 * @property-read Collection<int, User> $pinnedByUsers
 * @property-read Collection<int, User> $visibleUsers
 * @property-read Collection<int, ProjectNoteAccess> $visibleRoles
 * @property-read Collection<int, ProjectNoteAccess> $accesses
 */
class ProjectNote extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'project_id',
        'author_id',
        'title',
        'content',
        'visibility',
        'changed_by',
    ];

    protected function casts(): array
    {
        return [
            'visibility' => ProjectNoteVisibility::class,
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    public function pinnedByUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_pinned_project_notes')->withTimestamps();
    }

    public function visibleUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_note_accesses')
            ->withPivot(['company_id', 'role'])
            ->wherePivotNull('role')
            ->withTimestamps();
    }

    public function visibleRoles(): HasMany
    {
        return $this->hasMany(ProjectNoteAccess::class, 'project_note_id')
            ->whereNull('user_id')
            ->whereNotNull('role');
    }

    public function accesses(): HasMany
    {
        return $this->hasMany(ProjectNoteAccess::class, 'project_note_id');
    }
}
