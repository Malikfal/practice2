<?php

namespace App\Services\Workspace;

use App\Enums\UserPermission;
use App\Models\Project;
use App\Models\ProjectDocument;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectDocumentService
{
    private const DISK = 'project_documents';

    public function list(User $user, Project $project): Collection
    {
        $this->assertProjectAccess($user, $project, UserPermission::PROJECTS_TABS_DOCUMENTS_VIEW->value);

        return ProjectDocument::query()
            ->with(['uploader'])
            ->where('project_id', $project->id)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function store(User $user, Project $project, UploadedFile $file, bool $isClientVisible = true): ProjectDocument
    {
        $this->assertProjectAccess(
            $user,
            $project,
            UserPermission::PROJECTS_DOCUMENTS_CREATE_UPDATE->value,
            requireAssignedAccess: true,
        );

        $companyId = $this->projectCompanyId($project);
        $storedPath = null;

        DB::beginTransaction();

        try {
            $storedPath = $this->storeFile($companyId, (string) $project->id, $file);

            $document = ProjectDocument::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'project_id' => $project->id,
                'disk' => self::DISK,
                'path' => $storedPath,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size' => (int) ($file->getSize() ?: 0),
                'uploaded_by' => $user->id,
                'is_client_visible' => $isClientVisible,
            ]);

            DB::commit();

            return $document->load(['uploader']);
        } catch (\Throwable $e) {
            DB::rollBack();

            if (is_string($storedPath) && $storedPath !== '') {
                Storage::disk(self::DISK)->delete($storedPath);
            }

            throw $e;
        }
    }

    /**
     * Показывает документ клиенту или скрывает его как внутренний.
     */
    public function updateClientVisibility(User $user, ProjectDocument $document, bool $isClientVisible): ProjectDocument
    {
        $this->assertDocumentAccess(
            $user,
            $document,
            UserPermission::PROJECTS_DOCUMENTS_CREATE_UPDATE->value,
            requireAssignedAccess: true,
        );

        $document->update(['is_client_visible' => $isClientVisible]);

        return $document->load(['uploader']);
    }

    public function open(User $user, ProjectDocument $document): StreamedResponse
    {
        $this->assertDocumentAccess($user, $document, UserPermission::PROJECTS_TABS_DOCUMENTS_VIEW->value);

        if (! Storage::disk($document->disk)->exists($document->path)) {
            throw new NotFoundHttpException();
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

    public function delete(User $user, ProjectDocument $document): void
    {
        $this->assertDocumentAccess(
            $user,
            $document,
            UserPermission::PROJECTS_DOCUMENTS_DELETE->value,
            requireAssignedAccess: true,
        );

        $disk = $document->disk;
        $path = $document->path;

        DB::transaction(static function () use ($document): void {
            $document->delete();
        });

        Storage::disk($disk)->delete($path);
    }

    private function storeFile(string $companyId, string $projectId, UploadedFile $file): string
    {
        $safeName = $this->safeOriginalName($file);
        $fileName = (string) Str::uuid().'_'.$safeName;
        $directory = $companyId.'/'.$projectId;

        $storedPath = Storage::disk(self::DISK)->putFileAs($directory, $file, $fileName);

        if (! is_string($storedPath) || $storedPath === '') {
            throw new \RuntimeException('Не удалось сохранить документ проекта.');
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
            $safeBase = 'document';
        }

        $safeBase = substr($safeBase, 0, 80);

        if ($extension === '') {
            return $safeBase;
        }

        return $safeBase.'.'.substr($extension, 0, 15);
    }

    private function assertProjectAccess(
        User $user,
        Project $project,
        string $permission,
        bool $requireAssignedAccess = false,
    ): void
    {
        $this->assertPermission($user, $permission);

        $hasProjectAccess = $requireAssignedAccess
            ? $user->canAccessAssignedProject($project)
            : $user->canAccessProject($project);

        if (! $hasProjectAccess) {
            throw new NotFoundHttpException();
        }
    }

    private function assertDocumentAccess(
        User $user,
        ProjectDocument $document,
        string $permission,
        bool $requireAssignedAccess = false,
    ): void
    {
        $project = Project::query()->whereKey($document->project_id)->first();

        if (! $project) {
            throw new NotFoundHttpException();
        }

        $this->assertProjectAccess($user, $project, $permission, $requireAssignedAccess);
    }

    private function assertPermission(User $user, string $permission): void
    {
        if (! $user->can($permission)) {
            throw new NotFoundHttpException();
        }
    }

    private function projectCompanyId(Project $project): string
    {
        $companyId = (string) $project->company_id;

        if ($companyId === '') {
            throw new NotFoundHttpException();
        }

        return $companyId;
    }
}
