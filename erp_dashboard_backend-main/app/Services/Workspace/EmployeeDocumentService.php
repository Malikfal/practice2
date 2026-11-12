<?php

namespace App\Services\Workspace;

use App\Enums\UserPermission;
use App\Models\EmployeeDocument;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class EmployeeDocumentService
{
    private const DISK = 'employee_documents';

    public function list(User $user, User $employee): Collection
    {
        $this->assertEmployeeAccess($user, $employee, allowSelfWithoutPermission: true);

        return EmployeeDocument::query()
            ->with(['uploader'])
            ->where('employee_id', $employee->id)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function store(User $user, User $employee, UploadedFile $file): EmployeeDocument
    {
        $this->assertEmployeeAccess($user, $employee);

        $companyId = $this->employeeCompanyId($employee);
        $storedPath = null;

        DB::beginTransaction();

        try {
            $storedPath = $this->storeFile($companyId, (string) $employee->id, $file);

            $document = EmployeeDocument::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'employee_id' => $employee->id,
                'disk' => self::DISK,
                'path' => $storedPath,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size' => (int) ($file->getSize() ?: 0),
                'uploaded_by' => $user->id,
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

    public function open(User $user, EmployeeDocument $document): StreamedResponse
    {
        $this->assertDocumentAccess($user, $document, allowSelfWithoutPermission: true);

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

    public function delete(User $user, EmployeeDocument $document): void
    {
        $this->assertDocumentAccess($user, $document);

        $disk = $document->disk;
        $path = $document->path;

        DB::transaction(static function () use ($document): void {
            $document->delete();
        });

        Storage::disk($disk)->delete($path);
    }

    private function storeFile(string $companyId, string $employeeId, UploadedFile $file): string
    {
        $safeName = $this->safeOriginalName($file);
        $fileName = (string) Str::uuid().'_'.$safeName;
        $directory = $companyId.'/'.$employeeId;

        $storedPath = Storage::disk(self::DISK)->putFileAs($directory, $file, $fileName);

        if (! is_string($storedPath) || $storedPath === '') {
            throw new \RuntimeException('Не удалось сохранить документ сотрудника.');
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

    private function assertEmployeeAccess(
        User $user,
        User $employee,
        bool $allowSelfWithoutPermission = false,
    ): void
    {
        if ($allowSelfWithoutPermission && (string) $user->id === (string) $employee->id) {
            return;
        }

        $this->assertDocumentsPermission($user);

        if ($user->isSuperAdmin()) {
            $this->employeeCompanyId($employee);

            return;
        }

        if ((string) $user->company_id === '' || (string) $user->company_id !== (string) $employee->company_id) {
            throw new NotFoundHttpException();
        }
    }

    private function assertDocumentAccess(
        User $user,
        EmployeeDocument $document,
        bool $allowSelfWithoutPermission = false,
    ): void
    {
        if ($allowSelfWithoutPermission && (string) $user->id === (string) $document->employee_id) {
            return;
        }

        $this->assertDocumentsPermission($user);

        if ($user->isSuperAdmin()) {
            return;
        }

        if ((string) $user->company_id === '' || (string) $user->company_id !== (string) $document->company_id) {
            throw new NotFoundHttpException();
        }
    }

    private function assertDocumentsPermission(User $user): void
    {
        if ($user->isSuperAdmin()) {
            return;
        }

        if (! $user->can(UserPermission::EMPLOYEES_TABS_DOCUMENTS_VIEW->value)) {
            throw new NotFoundHttpException();
        }
    }

    private function employeeCompanyId(User $employee): string
    {
        $companyId = (string) $employee->company_id;

        if ($companyId === '') {
            throw new NotFoundHttpException();
        }

        return $companyId;
    }
}
