<?php

namespace App\Http\Controllers\Web\Superadmin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;

class SettingsController extends Controller
{
    private const REQUISITES_PATH = 'req/requisites.json';

    public function editRequisites(): View
    {
        $requisites = [];
        
        if (Storage::exists(self::REQUISITES_PATH)) {
            $json = Storage::get(self::REQUISITES_PATH);
            $requisites = json_decode($json, true) ?? [];
        }

        return view('admin.settings.requisites', [
            'requisites' => $requisites
        ]);
    }

    public function updateRequisites(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'bank' => 'nullable|string|max:255',
            'checking_account' => 'nullable|string|max:255',
            'correspondent_account' => 'nullable|string|max:255',
            'bic' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:255',
            'inn' => 'nullable|string|max:255',
            'kpp' => 'nullable|string|max:255',
            'director' => 'nullable|string|max:255',
            'accountant' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:255',
        ]);

        Storage::put(self::REQUISITES_PATH, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        return back()->with('status', 'Реквизиты компании успешно сохранены!');
    }
}
