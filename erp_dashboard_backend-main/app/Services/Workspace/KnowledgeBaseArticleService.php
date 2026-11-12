<?php

namespace App\Services\Workspace;

use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseArticleAccess;
use App\Models\KnowledgeBaseDocument;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class KnowledgeBaseArticleService
{
    private const DISK = 'knowledge_base';

    public function __construct(
        private readonly KnowledgeBaseFolderService $folders,
    ) {}

    public function list(User $user): Collection
    {
        $companyId = $this->folders->companyId($user);

        $query = KnowledgeBaseArticle::query()
            ->with(['author', 'folder', 'accesses.user'])
            ->where('company_id', $companyId)
            ->where(static function ($query) use ($user): void {
                $query
                    ->where(static function ($query) use ($user): void {
                        $query
                            ->whereNull('folder_id')
                            ->orWhereHas('folder', static function ($query) use ($user): void {
                                $query
                                    ->doesntHave('accesses')
                                    ->orWhereHas('accesses', static function ($query) use ($user): void {
                                        $query
                                            ->where('role', (string) $user->role)
                                            ->orWhere('user_id', $user->id);
                                    });
                            });
                    })
                    ->where(static function ($query) use ($user): void {
                        $query
                            ->doesntHave('accesses')
                            ->orWhereHas('accesses', static function ($query) use ($user): void {
                                $query
                                    ->where('role', (string) $user->role)
                                    ->orWhere('user_id', $user->id);
                            });
                });
            });

        if (! $this->folders->canManage($user)) {
            $query->where('is_draft', false);
        }

        return $query
            ->orderByDesc('is_pinned')
            ->get();
    }

    public function createDraft(User $user, array $data = []): KnowledgeBaseArticle
    {
        $folder = $this->folders->resolveFolder($user, $data['folder_id'] ?? null);
        if ($folder && ! $this->folders->userCanAccessFolder($user, $folder)) {
            abort(403, 'У вас нет доступа к выбранной папке базы знаний.');
        }

        $article = KnowledgeBaseArticle::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->folders->companyId($user),
            'folder_id' => $folder?->id,
            'author_id' => $user->id,
            'title' => '',
            'content' => '',
            'is_draft' => true,
            'is_archive' => false,
            'is_pinned' => false,
        ]);

        if (isset($data['access']) && is_array($data['access'])) {
            $this->replaceArticleAccesses(
                $article,
                $this->folders->normalizeAccess((string) $article->company_id, $data['access'])
            );
        }

        return $article->load(['author', 'folder', 'accesses.user']);
    }

    public function update(User $user, KnowledgeBaseArticle $article, array $data): KnowledgeBaseArticle
    {
        $this->assertArticleAccess($user, $article);

        $folder = $this->folders->resolveFolder($user, $data['folder_id'] ?? null);
        if ($folder && ! $this->folders->userCanAccessFolder($user, $folder)) {
            abort(403, 'У вас нет доступа к выбранной папке базы знаний.');
        }

        $article->fill([
            'folder_id' => $folder?->id,
            'title' => $data['title'] ?? '',
            'content' => $data['content'] ?? '',
            'is_archive' => (bool) $data['is_archive'],
            'is_pinned' => (bool) $data['is_pinned'],
        ])->save();

        return $article->load(['author', 'folder', 'accesses.user']);
    }

    public function syncArticleAccesses(User $user, KnowledgeBaseArticle $article, array $data): KnowledgeBaseArticle
    {
        $this->assertArticleAccess($user, $article);

        $access = $this->folders->normalizeAccess($this->folders->companyId($user), $data);

        DB::transaction(function () use ($article, $access): void {
            $this->replaceArticleAccesses($article, $access);
        });

        return $article->load(['author', 'folder', 'accesses.user']);
    }

    public function publish(User $user, KnowledgeBaseArticle $article): KnowledgeBaseArticle
    {
        $this->assertArticleAccess($user, $article);

        $article->fill([
            'is_draft' => false,
        ])->save();

        return $article->load(['author', 'folder', 'accesses.user']);
    }

    public function delete(User $user, KnowledgeBaseArticle $article): void
    {
        $this->assertArticleAccess($user, $article);

        $documents = $article->documents()->get(['disk', 'path']);

        DB::transaction(static function () use ($article): void {
            $article->delete();
        });

        foreach ($documents as $document) {
            Storage::disk($document->disk)->delete($document->path);
        }
    }

    public function storeImage(User $user, KnowledgeBaseArticle $article, UploadedFile $file): KnowledgeBaseDocument
    {
        $this->assertArticleAccess($user, $article);

        return $this->saveImage($article, $file, (string) $user->id);
    }

    /**
     * Сохраняет картинку статьи без проверки доступа, для служебных команд.
     */
    public function saveImage(KnowledgeBaseArticle $article, UploadedFile $file, ?string $uploadedBy): KnowledgeBaseDocument
    {
        $storedPath = null;

        DB::beginTransaction();

        try {
            $storedPath = $this->storeImageFile((string) $article->company_id, (string) $article->id, $file);

            $document = KnowledgeBaseDocument::create([
                'id' => (string) Str::uuid(),
                'company_id' => $article->company_id,
                'article_id' => $article->id,
                'disk' => self::DISK,
                'path' => $storedPath,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size' => (int) ($file->getSize() ?: 0),
                'uploaded_by' => $uploadedBy,
            ]);

            DB::commit();

            return $document;
        } catch (\Throwable $e) {
            DB::rollBack();

            if (is_string($storedPath) && $storedPath !== '') {
                Storage::disk(self::DISK)->delete($storedPath);
            }

            throw $e;
        }
    }

    public function openDocument(User $user, KnowledgeBaseDocument $document): StreamedResponse
    {
        $this->assertDocumentAccess($user, $document);

        if (! Storage::disk($document->disk)->exists($document->path)) {
            throw new NotFoundHttpException;
        }

        return Storage::disk($document->disk)->response(
            $document->path,
            $document->original_name,
            [
                'Content-Type' => $document->mime_type ?: 'application/octet-stream',
                'Cache-Control' => 'private, max-age=3600',
            ]
        );
    }

    private function storeImageFile(string $companyId, string $articleId, UploadedFile $file): string
    {
        $safeName = $this->safeOriginalName($file);
        $fileName = (string) Str::uuid() . '_' . $safeName;
        $directory = $companyId . '/' . $articleId;

        $storedPath = Storage::disk(self::DISK)->putFileAs($directory, $file, $fileName);

        if (! is_string($storedPath) || $storedPath === '') {
            throw new \RuntimeException('Не удалось сохранить изображение базы знаний.');
        }

        return $storedPath;
    }

    private function safeOriginalName(UploadedFile $file): string
    {
        $original = $file->getClientOriginalName();
        $name = pathinfo($original, PATHINFO_FILENAME);
        $extension = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));

        $safeBase = Str::slug($name);
        if ($safeBase === '') {
            $safeBase = 'image';
        }

        $safeBase = substr($safeBase, 0, 80);

        if ($extension === '') {
            return $safeBase;
        }

        return $safeBase . '.' . substr($extension, 0, 15);
    }

    private function assertArticleAccess(User $user, KnowledgeBaseArticle $article): void
    {
        if ((string) $article->company_id !== $this->folders->companyId($user)) {
            abort(403, 'У вас нет доступа к данной статье базы знаний.');
        }

        $article->loadMissing(['folder.accesses', 'accesses']);

        if (! $this->userCanAccessArticle($user, $article)) {
            abort(403, 'У вас нет доступа к данной статье базы знаний.');
        }
    }

    private function userCanAccessArticle(User $user, KnowledgeBaseArticle $article): bool
    {
        $article->loadMissing(['folder.accesses', 'accesses']);

        if ($article->folder && ! $this->folders->userCanAccessFolder($user, $article->folder)) {
            return false;
        }

        if ($article->accesses->isEmpty()) {
            return true;
        }

        return $article->accesses->contains('role', (string) $user->role) ||
            $article->accesses->contains(static fn(KnowledgeBaseArticleAccess $access): bool => (string) $access->user_id === (string) $user->id);
    }

    private function replaceArticleAccesses(KnowledgeBaseArticle $article, array $access): void
    {
        $article->accesses()->delete();

        foreach ($access['roles'] as $role) {
            KnowledgeBaseArticleAccess::insertOrIgnore([
                'id' => (string) Str::uuid(),
                'company_id' => $article->company_id,
                'article_id' => $article->id,
                'role' => $role,
            ]);
        }

        foreach ($access['users'] as $userId) {
            KnowledgeBaseArticleAccess::insertOrIgnore([
                'id' => (string) Str::uuid(),
                'company_id' => $article->company_id,
                'article_id' => $article->id,
                'user_id' => $userId,
            ]);
        }
    }

    private function assertDocumentAccess(User $user, KnowledgeBaseDocument $document): void
    {
        if ((string) $document->company_id !== $this->folders->companyId($user)) {
            abort(403, 'У вас нет доступа к данному документу.');
        }

        $document->loadMissing(['article']);

        if (! $document->article) {
            abort(403, 'У вас нет доступа к данному документу.');
        }

        $this->assertArticleAccess($user, $document->article);
    }
}
