<?php

namespace App\Services\Workspace;

use App\Enums\ProjectNoteVisibility;
use App\Enums\UserPermission;
use App\Models\Project;
use App\Models\ProjectNoteAccess;
use App\Models\ProjectNote;
use App\Models\ProjectNoteImage;
use App\Models\User;
use App\Support\RoleCatalog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectNoteService
{
    private const NOTE_IMAGES_DISK = 'project_note_images';

    public function list(User $user, Project $project): Collection
    {
        $this->assertProjectAccess($user, $project, UserPermission::PROJECTS_TABS_NOTES_VIEW->value);

        return ProjectNote::query()
            ->with(['author', 'changer', 'visibleUsers', 'visibleRoles'])
            ->where('project_id', $project->id)
            ->where(function ($query) use ($user): void {
                $query
                    ->where('visibility', '!=', ProjectNoteVisibility::RESTRICTED->value)
                    ->orWhereNull('visibility')
                    ->orWhere('author_id', $user->id)
                    ->orWhereHas('visibleUsers', static function ($query) use ($user): void {
                        $query->where('users.id', $user->id);
                    })
                    ->orWhereHas('visibleRoles', static function ($query) use ($user): void {
                        $query->where('role', (string) $user->role);
                    });
            })
            ->withExists([
                'pinnedByUsers as is_pinned' => static function ($query) use ($user): void {
                    $query->where('users.id', $user->id);
                },
            ])
            ->orderByDesc('is_pinned')
            ->orderByDesc('created_at')
            ->get();
    }

    public function store(User $user, Project $project, array $data): ProjectNote
    {
        $this->assertProjectAccess(
            $user,
            $project,
            UserPermission::PROJECTS_NOTES_CREATE_UPDATE->value,
            requireAssignedAccess: true,
        );

        $note = DB::transaction(function () use ($user, $project, $data): ProjectNote {
            $note = ProjectNote::create([
                'id' => (string) Str::uuid(),
                'company_id' => $this->projectCompanyId($project),
                'project_id' => $project->id,
                'author_id' => $user->id,
                'changed_by' => $user->id,
                'title' => $data['title'] ?? null,
                'content' => $data['content'],
                'visibility' => $data['visibility'] ?? ProjectNoteVisibility::PROJECT->value,
            ]);

            $access = $this->extractAccessData($data);
            $this->syncVisibleAccess($note, $project, $access['roles'], $access['user_ids']);

            return $note;
        });

        $note->setAttribute('is_pinned', false);

        return $note->load(['author', 'changer', 'visibleUsers', 'visibleRoles']);
    }

    public function update(User $user, ProjectNote $note, array $data): ProjectNote
    {
        $this->assertCanMutateNote($user, $note);

        $note = DB::transaction(function () use ($user, $note, $data): ProjectNote {
            $project = $this->resolveNoteProject($note);

            $oldVisibility = $this->visibilityValue($note);
            $newVisibility = $data['visibility'] ?? $oldVisibility;

            $note->fill([
                'title' => $data['title'] ?? null,
                'content' => $data['content'],
                'visibility' => $newVisibility,
                'changed_by' => $user->id,
            ]);
            $note->save();

            $hasNewAccessPayload = array_key_exists('access', $data) || array_key_exists('visible_user_ids', $data);
            $shouldReplaceVisibleAccess = $hasNewAccessPayload
                || ($oldVisibility !== ProjectNoteVisibility::RESTRICTED->value && $newVisibility === ProjectNoteVisibility::RESTRICTED->value);

            if ($shouldReplaceVisibleAccess) {
                $access = $this->extractAccessData($data);
                $this->syncVisibleAccess($note, $project, $access['roles'], $access['user_ids']);
            } elseif ($newVisibility === ProjectNoteVisibility::PROJECT->value) {
                $note->visibleUsers()->detach();
                $note->accesses()->whereNull('user_id')->whereNotNull('role')->delete();
            }

            return $note;
        });

        $note->setAttribute('is_pinned', $this->isPinned($user, $note));

        return $note->load(['author', 'changer', 'visibleUsers', 'visibleRoles']);
    }

    public function delete(User $user, ProjectNote $note): void
    {
        $this->assertCanDeleteNote($user, $note);

        $note->delete();
    }

    public function pin(User $user, ProjectNote $note): ProjectNote
    {
        $this->assertCanViewNote($user, $note);

        DB::table('user_pinned_project_notes')->updateOrInsert(
            [
                'user_id' => $user->id,
                'project_note_id' => $note->id,
            ],
            [
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        $note->setAttribute('is_pinned', true);

        return $note->load(['author', 'changer', 'visibleUsers', 'visibleRoles']);
    }

    public function unpin(User $user, ProjectNote $note): void
    {
        $this->assertCanViewNote($user, $note);

        DB::table('user_pinned_project_notes')
            ->where('user_id', $user->id)
            ->where('project_note_id', $note->id)
            ->delete();
    }

    public function storeImage(User $user, ProjectNote $note, UploadedFile $file): ProjectNoteImage
    {
        $this->assertCanMutateNote($user, $note);

        return $this->saveImage($note, $file, (string) $user->id);
    }

    /**
     * Сохраняет картинку заметки без проверки доступа, для служебных команд.
     */
    public function saveImage(ProjectNote $note, UploadedFile $file, ?string $uploadedBy): ProjectNoteImage
    {
        $project = $this->resolveNoteProject($note);
        $storedPath = null;

        DB::beginTransaction();

        try {
            $storedPath = $this->storeImageFile($project, $note, $file);

            $image = ProjectNoteImage::create([
                'id' => (string) Str::uuid(),
                'company_id' => $project->company_id,
                'project_note_id' => $note->id,
                'disk' => self::NOTE_IMAGES_DISK,
                'path' => $storedPath,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size' => (int) ($file->getSize() ?: 0),
                'uploaded_by' => $uploadedBy,
            ]);

            DB::commit();

            return $image;
        } catch (\Throwable $e) {
            DB::rollBack();

            if (is_string($storedPath) && $storedPath !== '') {
                Storage::disk(self::NOTE_IMAGES_DISK)->delete($storedPath);
            }

            throw $e;
        }
    }

    public function openImage(User $user, ProjectNoteImage $image): StreamedResponse
    {
        $image->loadMissing('note');

        if (! $image->note) {
            throw new NotFoundHttpException;
        }

        $this->assertCanViewNote($user, $image->note);

        if (! Storage::disk($image->disk)->exists($image->path)) {
            throw new NotFoundHttpException;
        }

        return Storage::disk($image->disk)->response(
            $image->path,
            $image->original_name,
            [
                'Content-Type' => $image->mime_type ?: 'application/octet-stream',
                'Cache-Control' => 'private, max-age=3600',
            ]
        );
    }

    private function storeImageFile(Project $project, ProjectNote $note, UploadedFile $file): string
    {
        $safeName = $this->safeImageName($file);
        $fileName = (string) Str::uuid().'_'.$safeName;
        $directory = (string) $project->company_id.'/'.$project->id.'/'.$note->id;

        $storedPath = Storage::disk(self::NOTE_IMAGES_DISK)->putFileAs($directory, $file, $fileName);

        if (! is_string($storedPath) || $storedPath === '') {
            throw new \RuntimeException('Не удалось сохранить изображение заметки.');
        }

        return $storedPath;
    }

    private function safeImageName(UploadedFile $file): string
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

        return $safeBase.'.'.substr($extension, 0, 15);
    }

    private function isPinned(User $user, ProjectNote $note): bool
    {
        return DB::table('user_pinned_project_notes')
            ->where('user_id', $user->id)
            ->where('project_note_id', $note->id)
            ->exists();
    }

    private function assertProjectAccess(User $user, Project $project, string $permission, bool $requireAssignedAccess = false): void
    {
        $this->assertPermission($user, $permission);

        $hasProjectAccess = $requireAssignedAccess
            ? $user->canAccessAssignedProject($project)
            : $user->canAccessProject($project);

        if (! $hasProjectAccess) {
            throw new NotFoundHttpException;
        }
    }

    private function assertCanViewNote(User $user, ProjectNote $note): void
    {
        $project = $this->resolveNoteProject($note);
        $this->assertProjectAccess($user, $project, UserPermission::PROJECTS_TABS_NOTES_VIEW->value);
        $this->assertVisibleNoteAccess($user, $note);
    }

    private function assertCanMutateNote(User $user, ProjectNote $note): void
    {
        $project = $this->resolveNoteProject($note);
        $this->assertProjectAccess($user, $project, UserPermission::PROJECTS_NOTES_CREATE_UPDATE->value, requireAssignedAccess: true);
        $this->assertVisibleNoteAccess($user, $note);
    }

    private function assertCanDeleteNote(User $user, ProjectNote $note): void
    {
        $project = $this->resolveNoteProject($note);
        $this->assertProjectAccess($user, $project, UserPermission::PROJECTS_NOTES_DELETE->value, requireAssignedAccess: true);
        $this->assertVisibleNoteAccess($user, $note);
    }

    private function assertVisibleNoteAccess(User $user, ProjectNote $note): void
    {
        if (! $this->userCanAccessNote($user, $note)) {
            throw new NotFoundHttpException;
        }
    }

    private function assertPermission(User $user, string $permission): void
    {
        if (! $user->can($permission)) {
            throw new NotFoundHttpException;
        }
    }

    private function projectCompanyId(Project $project): string
    {
        $companyId = (string) $project->company_id;

        if ($companyId === '') {
            throw new NotFoundHttpException;
        }

        return $companyId;
    }

    private function resolveNoteProject(ProjectNote $note): Project
    {
        $project = Project::query()->whereKey($note->project_id)->first();

        if (! $project) {
            throw new NotFoundHttpException;
        }

        return $project;
    }

    private function userCanAccessNote(User $user, ProjectNote $note): bool
    {
        if ($this->visibilityValue($note) !== ProjectNoteVisibility::RESTRICTED->value) {
            return true;
        }

        if ((string) $note->author_id === (string) $user->id) {
            return true;
        }

        if ($note->visibleUsers()->where('users.id', $user->id)->exists()) {
            return true;
        }

        return $note->accesses()
            ->whereNull('user_id')
            ->where('role', (string) $user->role)
            ->exists();
    }

    private function syncVisibleAccess(ProjectNote $note, Project $project, array $roles, array $userIds): void
    {
        if ($this->visibilityValue($note) !== ProjectNoteVisibility::RESTRICTED->value) {
            $note->visibleUsers()->detach();
            $note->accesses()->whereNull('user_id')->whereNotNull('role')->delete();

            return;
        }

        $normalizedRoles = collect($roles)
            ->map(static fn(string $role): string => trim($role))
            ->filter()
            ->unique()
            ->values();

        $allowedRoles = collect(RoleCatalog::assignableValuesForCompany((string) $project->company_id));
        $invalidRoles = $normalizedRoles->reject(static fn(string $role): bool => $allowedRoles->contains($role))->values();
        if ($invalidRoles->isNotEmpty()) {
            throw ValidationException::withMessages([
                'access.roles' => ['Некорректные роли доступа: ' . $invalidRoles->implode(', ')],
            ]);
        }

        $normalizedUserIds = collect($userIds)
            ->map(static fn(string $userId): string => trim($userId))
            ->filter()
            ->unique()
            ->values();

        if ($normalizedRoles->isEmpty() && $normalizedUserIds->isEmpty()) {
            throw ValidationException::withMessages([
                'access' => ['Для ограниченной заметки нужно выбрать хотя бы одну роль или участника проекта.'],
            ]);
        }

        $projectMemberIds = DB::table('project_members')
            ->where('project_id', $project->id)
            ->whereIn('user_id', $normalizedUserIds)
            ->pluck('user_id')
            ->map(static fn(string $userId): string => $userId)
            ->values();

        if ($projectMemberIds->count() !== $normalizedUserIds->count()) {
            throw ValidationException::withMessages([
                'access.user_ids' => ['Один или несколько пользователей не являются участниками проекта.'],
            ]);
        }

        $note->accesses()->whereNotNull('user_id')->delete();
        $note->accesses()->whereNull('user_id')->whereNotNull('role')->delete();

        foreach ($projectMemberIds as $userId) {
            ProjectNoteAccess::query()->create([
                'id' => (string) Str::uuid(),
                'company_id' => $project->company_id,
                'project_note_id' => $note->id,
                'user_id' => $userId,
                'role' => null,
            ]);
        }

        foreach ($normalizedRoles as $role) {
            ProjectNoteAccess::query()->create([
                'id' => (string) Str::uuid(),
                'company_id' => $project->company_id,
                'project_note_id' => $note->id,
                'user_id' => null,
                'role' => $role,
            ]);
        }
    }

    private function visibilityValue(ProjectNote $note): string
    {
        return $note->visibility?->value ?? ProjectNoteVisibility::PROJECT->value;
    }

    private function extractAccessData(array $data): array
    {
        $roles = $data['access']['roles'] ?? [];
        $userIds = $data['access']['user_ids'] ?? [];

        if (! array_key_exists('access', $data) && array_key_exists('visible_user_ids', $data)) {
            $userIds = $data['visible_user_ids'];
        }

        return [
            'roles' => is_array($roles) ? $roles : [],
            'user_ids' => is_array($userIds) ? $userIds : [],
        ];
    }
}
