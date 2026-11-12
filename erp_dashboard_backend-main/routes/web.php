<?php

use App\Http\Controllers\Web\Superadmin\AuthController as SuperAdminAuthController;
use App\Http\Controllers\Web\Superadmin\CompanyController as SuperAdminCompanyController;
use App\Http\Controllers\Web\Superadmin\DocumentController as SuperAdminDocumentController;
use App\Http\Controllers\Web\Superadmin\SettingsController as SuperAdminSettingsController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::prefix('admin')->group(function (): void {
    Route::middleware('guest')->group(function (): void {
        Route::get('/login', [SuperAdminAuthController::class, 'create'])->name('admin.login');
        Route::post('/login', [SuperAdminAuthController::class, 'store'])->name('admin.login.store');
    });

    Route::middleware(['auth', 'superadmin'])->group(function (): void {
        Route::get('/', static fn() => redirect()->route('admin.companies.index'))->name('admin.home');
        Route::post('/logout', [SuperAdminAuthController::class, 'destroy'])->name('admin.logout');

        Route::prefix('companies')->group(function (): void {
            Route::get('/', [SuperAdminCompanyController::class, 'index'])->name('admin.companies.index');
            Route::get('/create', [SuperAdminCompanyController::class, 'create'])->name('admin.companies.create');
            Route::post('/', [SuperAdminCompanyController::class, 'store'])->name('admin.companies.store');
            Route::get('/{company}', [SuperAdminCompanyController::class, 'show'])->name('admin.companies.show');
            Route::patch('/{company}/block', [SuperAdminCompanyController::class, 'block'])->name('admin.companies.block');
            Route::patch('/{company}/unblock', [SuperAdminCompanyController::class, 'unblock'])->name('admin.companies.unblock');
            Route::patch('/{company}/update-tariff',[SuperAdminCompanyController::class, 'updateTariff'])->name('admin.companies.update_tariff');
            Route::get('/{company}/billing', [SuperAdminCompanyController::class, 'billing'])->name('admin.companies.billing');
            Route::patch('/{company}/invoices/{invoice}/approve', [SuperAdminCompanyController::class, 'approveInvoice'])->name('admin.companies.invoices.approve');
            Route::patch('/{company}/invoices/{invoice}/cancel', [SuperAdminCompanyController::class, 'cancelInvoice'])->name('admin.companies.invoices.cancel');
            Route::get('/{company}/invoices/{invoice}/download', [SuperAdminCompanyController::class, 'downloadInvoice'])->name('admin.companies.invoices.download');
            Route::get('/{company}/invoices/{invoice}/download-upd', [SuperAdminCompanyController::class, 'downloadInvoiceUpd'])->name('admin.companies.invoices.download_upd');
            Route::post('/{company}/subscription/update-end-date', [SuperAdminCompanyController::class, 'updateSubscriptionEndDate'])->name('admin.companies.subscriptions.update_end_date');
            Route::post('/{company}/individual-tariff', [SuperAdminCompanyController::class, 'createIndividualTariff'])->name('admin.companies.individual_tariff.store');
            Route::post('/{company}/login-as-owner', [SuperAdminCompanyController::class, 'loginAsOwner'])
                ->name('admin.companies.login_as_owner');
        });

        Route::prefix('documents')->group(function (): void {
            Route::get('/', [SuperAdminDocumentController::class, 'index'])->name('admin.documents.index');
            Route::post('/', [SuperAdminDocumentController::class, 'store'])->name('admin.documents.store');
            Route::get('/{document}', [SuperAdminDocumentController::class, 'download'])->name('admin.documents.download');
            Route::delete('/{document}', [SuperAdminDocumentController::class, 'destroy'])->name('admin.documents.destroy');
            Route::patch('/{document}/status', [SuperAdminDocumentController::class, 'changeStatus'])->name('admin.documents.change_status');
        });

        Route::prefix('settings')->group(function (): void {
            Route::get('/requisites', [SuperAdminSettingsController::class, 'editRequisites'])->name('admin.settings.requisites');
            Route::post('/requisites', [SuperAdminSettingsController::class, 'updateRequisites'])->name('admin.settings.requisites.update');
        });
    });
});
