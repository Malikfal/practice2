<?php

namespace App\Http\Controllers\Web\Superadmin;

use App\Http\Controllers\Controller;
use App\Support\AuthCookieService;
use App\Models\Document;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller {
    public function __construct(
        private readonly AuthCookieService $authCookies,
    ) {
    }

    public function index(): View {
        $documents = Document::latest()->get();

        return view('admin.documents.index', compact('documents'));
    }

    public function download(Document $document): StreamedResponse {
        if (!Storage::disk('local')->exists($document->file_path)) {
            abort(404, 'Файл не найден на сервере');
        }

        return Storage::disk('local')->response(
            $document->file_path, 
            $document->original_name,
            [
                'Cache-Control' => 'private, max-age=3600',
            ]);
    }

    public function store(Request $request): RedirectResponse {
        $request->validate([
            'title' => 'required|string|max:255',
            'document' => 'required|file|mimes:pdf',
        ]);

        $filePath = $request->file('document')->store('docs', 'local');

        Document::create([
            'title' => $request->title,
            'original_name' => $request->file('document')->getClientOriginalName(),
            'file_path' => $filePath,
            'is_public' => $request->boolean('is_public'),
        ]);

        return back()->with('success', 'Документ успешно загружен');
    }
    
    public function changeStatus(Request $request, Document $document): RedirectResponse {
        $document->update([
            'is_public' => $request->boolean('is_public'),
        ]);    

        return back()->with('success', "Статус документа \"{$document->title}\" успешно изменен");
    }

    public function destroy(Document $document): RedirectResponse {
        Storage::disk('local')->delete($document->file_path);
        $document->delete();
        return back()->with('success', 'Документ успешно удален');
    }


}