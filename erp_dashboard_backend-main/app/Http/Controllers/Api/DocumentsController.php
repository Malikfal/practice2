<?php

namespace App\Http\Controllers\Api;

use App\Http\Responses\DocumentIndexResponse;
use App\Models\Document;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentsController extends Controller {

    public function publicIndex(): DocumentIndexResponse {

        $documents = Document::where('is_public', true)->latest()->get();

        return new DocumentIndexResponse($documents);
    }

    public function publicDownload(Document $document): StreamedResponse {
        if (!$document->is_public) {
            abort(403, 'Такого документа нет');
        }

        if (!Storage::disk('local')->exists($document->file_path)) {
            abort(404, 'Файл не найден');
        }
        
        return Storage::disk('local')->response(
            $document->file_path,
            $document->original_name,
            [
                'Cache-Control' => 'private, max-age=3600',
            ]
        );
    }

    public function privateIndex(Request $request): DocumentIndexResponse {

        $user = $request->user();

        $isAdmin = $user && in_array($user->role, ['ADMIN','SUPERADMIN',]);

        $documentQuery = Document::query();
        if (!$isAdmin) {
            $documentQuery->where('is_public', true);
        }

        $documents = $documentQuery->latest()->get();

        return new DocumentIndexResponse($documents);
    }

    public function privateDownload(Request $request, Document $document): StreamedResponse {
        $user = $request->user();
        $isAdmin = $user && in_array($user->role, [
            'ADMIN',
            'SUPERADMIN',
        ]);

        if (!$document->is_public && !$isAdmin) {
            abort(403, 'Такого документа нет');
        }

        if (!Storage::disk('local')->exists($document->file_path)) {
            abort(404, 'Файл не найден');
        }
        
        return Storage::disk('local')->response(
            $document->file_path,
            $document->original_name,
            [
                'Cache-Control' => 'private, max-age=3600',
            ]
        );
    }
}