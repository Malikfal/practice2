<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Статья в базе знаний компании.
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $folder_id
 * @property string $author_id
 * @property string $title
 * @property string $content
 * @property bool $is_draft
 * @property bool $is_archive
 * @property bool $is_pinned
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Company|null $company
 * @property-read User|null $author
 * @property-read KnowledgeBaseFolder|null $folder
 * @property-read Collection<int, KnowledgeBaseDocument> $documents
 * @property-read Collection<int, KnowledgeBaseArticleAccess> $accesses
 */
class KnowledgeBaseArticle extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'folder_id',
        'author_id',
        'title',
        'content',
        'is_draft',
        'is_archive',
        'is_pinned',
    ];

    protected function casts(): array
    {
        return [
            'is_draft' => 'boolean',
            'is_archive' => 'boolean',
            'is_pinned' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(KnowledgeBaseFolder::class, 'folder_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(KnowledgeBaseDocument::class, 'article_id');
    }

    public function accesses(): HasMany
    {
        return $this->hasMany(KnowledgeBaseArticleAccess::class, 'article_id');
    }
}
