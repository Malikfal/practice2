<?php

use App\Http\Controllers\Api\Admin\AdminClientAccountController;
use App\Http\Controllers\Api\Admin\AdminEmployeeController;
use App\Http\Controllers\Api\Admin\AdminRolePermissionController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientFlowAccountController;
use App\Http\Controllers\Api\ClientPortalController;
use App\Http\Controllers\Api\DocumentsController;
use App\Http\Controllers\Api\External\ReportController as ExternalReportController;
use App\Http\Controllers\Api\External\UserController as ExternalUserController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PublicTaskController;
use App\Http\Controllers\Api\RegistrationController;
use App\Http\Controllers\Api\Web\ApplicationController;
use App\Http\Controllers\Api\Worker\ProjectController as WorkerProjectController;
use App\Http\Controllers\Api\Worker\ReportController as WorkerReportController;
use App\Http\Controllers\Api\Workspace\BankDetailController;
use App\Http\Controllers\Api\Workspace\BillingController;
use App\Http\Controllers\Api\Workspace\ClientController;
use App\Http\Controllers\Api\Workspace\CompanySettingsController;
use App\Http\Controllers\Api\Workspace\DataImportController;
use App\Http\Controllers\Api\Workspace\DirectTaskController;
use App\Http\Controllers\Api\Workspace\EmployeeAbsenceController;
use App\Http\Controllers\Api\Workspace\EmployeeController;
use App\Http\Controllers\Api\Workspace\EmployeeDocumentController;
use App\Http\Controllers\Api\Workspace\EmployeePayrollCalculationController;
use App\Http\Controllers\Api\Workspace\EmployeePayrollSettingsController;
use App\Http\Controllers\Api\Workspace\EmployeeRateController;
use App\Http\Controllers\Api\Workspace\FinanceAnalyticsController;
use App\Http\Controllers\Api\Workspace\FinanceArticleController;
use App\Http\Controllers\Api\Workspace\FinanceController;
use App\Http\Controllers\Api\Workspace\FinanceSettingsController;
use App\Http\Controllers\Api\Workspace\FinancialResultController;
use App\Http\Controllers\Api\Workspace\KnowledgeBaseController;
use App\Http\Controllers\Api\Workspace\NotificationSettingsController;
use App\Http\Controllers\Api\Workspace\PayrollPayoutArticleController;
use App\Http\Controllers\Api\Workspace\PayrollPayoutController;
use App\Http\Controllers\Api\Workspace\PayrollRecalculationController;
use App\Http\Controllers\Api\Workspace\PinnedProjectController;
use App\Http\Controllers\Api\Workspace\PinnedTemplateController;
use App\Http\Controllers\Api\Workspace\PlannedExpenseController;
use App\Http\Controllers\Api\Workspace\ProjectActivityHistoryController;
use App\Http\Controllers\Api\Workspace\ProjectAssignmentHistoryController;
use App\Http\Controllers\Api\Workspace\ProjectController;
use App\Http\Controllers\Api\Workspace\ProjectDefaultEntranceArticleController;
use App\Http\Controllers\Api\Workspace\ProjectDocumentController;
use App\Http\Controllers\Api\Workspace\ProjectExportController;
use App\Http\Controllers\Api\Workspace\ProjectNoteController;
use App\Http\Controllers\Api\Workspace\ProjectRateController;
use App\Http\Controllers\Api\Workspace\ProjectSidebarOrderController;
use App\Http\Controllers\Api\Workspace\ProjectTaskStatusColumnController;
use App\Http\Controllers\Api\Workspace\ReportController;
use App\Http\Controllers\Api\Workspace\SkillController;
use App\Http\Controllers\Api\Workspace\TagController;
use App\Http\Controllers\Api\Workspace\TaskActivityController;
use App\Http\Controllers\Api\Workspace\TaskAttachmentController;
use App\Http\Controllers\Api\Workspace\TaskClientMessageController;
use App\Http\Controllers\Api\Workspace\TaskCommentController;
use App\Http\Controllers\Api\Workspace\TaskSubscriptionController;
use App\Http\Controllers\Api\Workspace\TemplateController;
use App\Http\Controllers\Api\Workspace\TimeEntryController;
use App\Http\Controllers\Api\Workspace\TrackerSettingsController;
use App\Http\Controllers\Api\Workspace\UserTaskBoardController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    // Самостоятельная регистрация компании, подтверждение почты и сброс пароля.
    Route::post('/register', [RegistrationController::class, 'register'])->middleware('throttle:auth-public');
    Route::post('/email/verify', [RegistrationController::class, 'verifyEmail'])->middleware('throttle:auth-public');
    Route::post('/email/resend', [RegistrationController::class, 'resendVerification'])->middleware('throttle:auth-public');
    Route::post('/password/forgot', [PasswordResetController::class, 'forgot'])->middleware('throttle:auth-public');
    Route::post('/password/check', [PasswordResetController::class, 'check'])->middleware('throttle:auth-public');
    Route::post('/password/reset', [PasswordResetController::class, 'reset'])->middleware('throttle:auth-public');
});

Route::post('/login', [AuthController::class, 'login']);

Route::post('/applications', [ApplicationController::class, 'store']);

Route::get('/public/documents', [DocumentsController::class, 'publicIndex']);
Route::get('/public/documents/{document}/download', [DocumentsController::class, 'publicDownload'])
    ->name('api.documents.public.download');

Route::prefix('public/tasks/{token}')->group(function (): void {
    Route::get('/', [PublicTaskController::class, 'show']);
    Route::post('/approve', [PublicTaskController::class, 'approve']);
    Route::post('/messages', [PublicTaskController::class, 'storeMessage']);
    Route::get('/messages/attachments/{attachment}', [PublicTaskController::class, 'attachment']);
    Route::get('/attachments/{attachment}', [PublicTaskController::class, 'taskAttachment']);
    Route::get('/description-images/{image}', [PublicTaskController::class, 'descriptionImage']);
});

Route::middleware(['auth.access', 'employee.only', 'company.context', 'company.active', 'subscription.active', 'tariff.features'])->group(function (): void {
    Route::prefix('meta')->group(function (): void {
        Route::get('/roles', [MetaController::class, 'roles']);
        Route::get('/permissions', [MetaController::class, 'permissions']);
    });

    Route::post('/logout', [AuthController::class, 'logout']);

    Route::prefix('imports')->group(function (): void {
        Route::get('/', [DataImportController::class, 'index']);
        Route::post('/', [DataImportController::class, 'store']);
        Route::get('/{import}', [DataImportController::class, 'show']);
        Route::get('/{import}/rows', [DataImportController::class, 'rows']);
        Route::get('/{import}/file', [DataImportController::class, 'download']);
        Route::post('/{import}/retry', [DataImportController::class, 'retry']);
        Route::post('/{import}/cancel', [DataImportController::class, 'cancel']);
    });

    Route::prefix('users')->group(function (): void {
        Route::get('/me', [ProfileController::class, 'show']);
    });

    Route::get('/workspace/documents', [DocumentsController::class, 'privateIndex']);
    Route::get('/workspace/documents/{document}/download', [DocumentsController::class, 'privateDownload'])
        ->name('api.documents.private.download');

    Route::prefix('knowledge-base')->group(function (): void {
        Route::get('/', [KnowledgeBaseController::class, 'index']);
        Route::get('/images/{image}', [KnowledgeBaseController::class, 'image']);

        Route::post('/', [KnowledgeBaseController::class, 'store']);
        Route::post('/{article}/images', [KnowledgeBaseController::class, 'uploadImage']);
        Route::post('/{article}/publish', [KnowledgeBaseController::class, 'publish']);
        Route::patch('/{article}/accesses', [KnowledgeBaseController::class, 'syncArticleAccesses']);
        Route::patch('/{article}', [KnowledgeBaseController::class, 'update']);
        Route::delete('/{article}', [KnowledgeBaseController::class, 'destroy']);

        Route::prefix('folders')->group(function (): void {
            Route::get('/', [KnowledgeBaseController::class, 'folders']);

            Route::post('/', [KnowledgeBaseController::class, 'storeFolder']);
            Route::patch('/{folder}', [KnowledgeBaseController::class, 'updateFolder']);
            Route::patch('/{folder}/accesses', [KnowledgeBaseController::class, 'syncFolderAccesses']);
            Route::delete('/{folder}', [KnowledgeBaseController::class, 'destroyFolder']);
        });
    });

    Route::prefix('notifications')->group(function (): void {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/read-all', [NotificationController::class, 'readAll']);
        Route::get('/settings', [NotificationController::class, 'settings']);
        Route::put('/settings', [NotificationController::class, 'updateSettings']);
        Route::post('/{notification}/read', [NotificationController::class, 'read'])->whereUuid('notification');
    });
    Route::post('/tasks/{task}/notifications/read', [NotificationController::class, 'readTask']);
    Route::post('/tasks/{task}/viewed', [NotificationController::class, 'viewTask']);
    Route::get('/tasks/{task}/subscription', [TaskSubscriptionController::class, 'show']);
    Route::put('/tasks/{task}/subscription', [TaskSubscriptionController::class, 'update']);

    Route::get('/tasks/{task}/activity', [TaskActivityController::class, 'index']);
    Route::get('/tasks/direct/{task}', [DirectTaskController::class, 'show']);
    Route::patch('/tasks/direct/{task}', [DirectTaskController::class, 'update']);

    Route::get('tasks/board', [UserTaskBoardController::class, 'index']);
    Route::patch('tasks/board/{task}/move', [UserTaskBoardController::class, 'move']);
    Route::prefix('tasks/{task}/comments')->group(function (): void {
        Route::get('/', [TaskCommentController::class, 'index']);
        Route::post('/', [TaskCommentController::class, 'store']);
        Route::delete('/{comment}', [TaskCommentController::class, 'destroy']);
    });

    Route::get('/task-comment-attachments/{attachment}', [TaskCommentController::class, 'attachment']);

    Route::prefix('tasks/{task}/client-messages')->group(function (): void {
        Route::get('/', [TaskClientMessageController::class, 'index']);
        Route::post('/', [TaskClientMessageController::class, 'store']);
        Route::post('/public-link', [TaskClientMessageController::class, 'storeLink']);
        Route::delete('/public-link', [TaskClientMessageController::class, 'destroyLink']);
        Route::get('/attachments/{attachment}', [TaskClientMessageController::class, 'attachment']);
    });

    Route::prefix('tasks/{task}/attachments')->group(function (): void {
        Route::get('/', [TaskAttachmentController::class, 'index']);
        Route::post('/', [TaskAttachmentController::class, 'store']);
        Route::delete('/{attachment}', [TaskAttachmentController::class, 'destroy']);
    });
    Route::get('/task-attachments/{attachment}', [TaskAttachmentController::class, 'attachment']);

    Route::prefix('profile')->group(function (): void {
        Route::get('/', [ProfileController::class, 'show']);
        Route::put('/', [ProfileController::class, 'update']);
        Route::put('/password', [ProfileController::class, 'changePassword']);
        Route::get('/pinned-projects', [PinnedProjectController::class, 'index']);
        Route::post('/pinned-projects/{project}', [PinnedProjectController::class, 'store']);
        Route::delete('/pinned-projects/{project}', [PinnedProjectController::class, 'destroy']);
        Route::get('/project-sidebar-order', [ProjectSidebarOrderController::class, 'index']);
        Route::put('/project-sidebar-order', [ProjectSidebarOrderController::class, 'update']);
    });

    Route::prefix('settings')->group(function (): void {
        Route::get('/tracker', [TrackerSettingsController::class, 'show']);
        Route::put('/tracker', [TrackerSettingsController::class, 'update']);
        Route::get('/finance', [FinanceSettingsController::class, 'show']);
        Route::put('/finance', [FinanceSettingsController::class, 'update']);
        Route::get('/company', [CompanySettingsController::class, 'show']);
        Route::put('/company', [CompanySettingsController::class, 'update']);
        Route::put('/company/timezone', [CompanySettingsController::class, 'updateTimezone']);
        Route::put('/company/unestimated-task-limit', [CompanySettingsController::class, 'updateUnestimatedTaskLimit']);
        Route::get('/notifications', [NotificationSettingsController::class, 'show']);
        Route::put('/notifications', [NotificationSettingsController::class, 'update']);
    });

    Route::prefix('billing')->group(function (): void {
        Route::get('/tariffs', [BillingController::class, 'tariffs']);
        Route::get('/requisites', [BillingController::class, 'requisites']);
        Route::get('/subscription', [BillingController::class, 'currentSubscription']);
        Route::get('/invoices', [BillingController::class, 'invoices']);
        Route::patch('/invoices/{invoice}/cancel', [BillingController::class, 'cancelInvoice']);
        Route::get('/invoices/{invoice}/download-upd', [BillingController::class, 'downloadInvoiceUpd']);
        Route::get('/invoices/{invoice}/download', [BillingController::class, 'downloadInvoice']);
        Route::post('/tariffs/change', [BillingController::class, 'changeTariff']);
        Route::post('/tariffs/calculate', [BillingController::class, 'calculateChange']);
        Route::post('/tariffs/individual-request', [BillingController::class, 'requestIndividualTariff']);
    });

    Route::prefix('clients')->group(function (): void {
        Route::get('/', [ClientController::class, 'index']);
        Route::post('/', [ClientController::class, 'store']);

        Route::prefix('{client}')->group(function (): void {
            Route::get('/', [ClientController::class, 'show']);
            Route::patch('/', [ClientController::class, 'update']);
            Route::delete('/', [ClientController::class, 'destroy']);

            Route::get('/contacts', [ClientController::class, 'contacts']);
            Route::post('/contacts', [ClientController::class, 'storeContact']);
            Route::get('/contacts/{contact}', [ClientController::class, 'showContact']);
            Route::patch('/contacts/{contact}', [ClientController::class, 'updateContact']);
            Route::delete('/contacts/{contact}', [ClientController::class, 'destroyContact']);

            Route::get('/flow-accounts', [ClientFlowAccountController::class, 'index']);
            Route::get('/flow-projects', [ClientFlowAccountController::class, 'projects']);
            Route::post('/flow-accounts', [ClientFlowAccountController::class, 'store']);
            Route::patch('/flow-accounts/{account}', [ClientFlowAccountController::class, 'update']);
            Route::post('/flow-accounts/{account}/password-link', [ClientFlowAccountController::class, 'passwordLink']);

            Route::get('/legal-entities', [ClientController::class, 'legalEntities']);
            Route::post('/legal-entities', [ClientController::class, 'storeLegalEntity']);
            Route::get('/legal-entities/{legalEntity}', [ClientController::class, 'showLegalEntity']);
            Route::patch('/legal-entities/{legalEntity}', [ClientController::class, 'updateLegalEntity']);
            Route::delete('/legal-entities/{legalEntity}', [ClientController::class, 'destroyLegalEntity']);

            Route::get('/legal-entities/{legalEntity}/bank-details', [ClientController::class, 'bankDetails']);
            Route::post('/legal-entities/{legalEntity}/bank-details', [ClientController::class, 'storeBankDetail']);
            Route::get('/legal-entities/{legalEntity}/bank-details/{bankDetail}', [ClientController::class, 'showBankDetail']);
            Route::patch('/legal-entities/{legalEntity}/bank-details/{bankDetail}', [ClientController::class, 'updateBankDetail']);
            Route::delete('/legal-entities/{legalEntity}/bank-details/{bankDetail}', [ClientController::class, 'destroyBankDetail']);
        });
    });

    Route::prefix('projects')->group(function (): void {
        Route::get('/', [ProjectController::class, 'index']);
        Route::post('/', [ProjectController::class, 'store']);
        Route::get('/default-entrance-articles', [ProjectDefaultEntranceArticleController::class, 'showMany']);

        Route::get('/tags', [TagController::class, 'index']);
        Route::get('/export', [ProjectExportController::class, '__invoke']);

        Route::get('/templates', [TemplateController::class, 'index']);
        Route::post('/templates', [TemplateController::class, 'store']);
        Route::patch('/templates/{template}', [TemplateController::class, 'update']);
        Route::delete('/templates/{template}', [TemplateController::class, 'destroy']);

        Route::get('/pinned-templates', [PinnedTemplateController::class, 'index']);
        Route::post('/pinned-templates/{template}', [PinnedTemplateController::class, 'store']);
        Route::delete('/pinned-templates/{template}', [PinnedTemplateController::class, 'destroy']);

        Route::post('/from-template/{template}', [ProjectController::class, 'createFromTemplate']);

        Route::prefix('{project}')->group(function (): void {
            Route::get('/', [ProjectController::class, 'show']);
            Route::delete('/', [ProjectController::class, 'destroy']);
            Route::get('/documents', [ProjectDocumentController::class, 'index']);
            Route::post('/documents', [ProjectDocumentController::class, 'store']);
            Route::get('/notes', [ProjectNoteController::class, 'index']);
            Route::post('/notes', [ProjectNoteController::class, 'store']);
            Route::put('/tags', [TagController::class, 'syncProjectTags']);
            Route::get('/tasks', [ProjectController::class, 'tasks']);
            Route::get('/tasks/{task}', [ProjectController::class, 'task']);
            Route::get('/user/{userId}/tasks', [ProjectController::class, 'userTasks']);
            Route::get('/rates', [ProjectRateController::class, 'index']);
            Route::get('/rates/current', [ProjectRateController::class, 'current']);
            Route::post('/rates', [ProjectRateController::class, 'store']);
            Route::get('/default-entrance-article', [ProjectDefaultEntranceArticleController::class, 'show']);
            Route::patch('/default-entrance-article', [ProjectDefaultEntranceArticleController::class, 'update']);

            Route::patch('/', [ProjectController::class, 'update']);
            Route::patch('/creator', [ProjectController::class, 'changeCreator']);
            Route::post('/tasks', [ProjectController::class, 'createTask']);
            Route::patch('/tasks/{task}', [ProjectController::class, 'updateTask']);
            Route::delete('/tasks/{task}', [ProjectController::class, 'deleteTask']);
            Route::patch('/tasks/{task}/move', [ProjectController::class, 'moveTask']);
            Route::post('/tasks/{task}/description-images', [ProjectController::class, 'uploadTaskDescriptionImage']);

            Route::prefix('members')->group(function (): void {
                Route::post('/', [ProjectController::class, 'assignMember']);
                Route::delete('/{employee}', [ProjectController::class, 'removeMember']);
            });
        });

        Route::prefix('{project}/task-status-columns')->group(function (): void {
            Route::get('/', [ProjectTaskStatusColumnController::class, 'index']);
            Route::post('/', [ProjectTaskStatusColumnController::class, 'store']);
            Route::patch('/reorder', [ProjectTaskStatusColumnController::class, 'reorder']);
            Route::patch('/{column}', [ProjectTaskStatusColumnController::class, 'update']);
            Route::delete('/{column}', [ProjectTaskStatusColumnController::class, 'destroy']);
        });
    });

    Route::get('/skills', [SkillController::class, 'index']);

    Route::prefix('finance')->group(function (): void {
        Route::prefix('financial-results')->group(function (): void {
            Route::get('/overview', [FinancialResultController::class, 'overview']);
            Route::get('/projects', [FinancialResultController::class, 'projects']);
            Route::get('/managers', [FinancialResultController::class, 'managers']);
            Route::get('/clients', [FinancialResultController::class, 'clients']);
        });

        Route::prefix('analytics')->group(function (): void {
            Route::get('/overview', [FinanceAnalyticsController::class, 'overview']);
            Route::get('/projects', [FinanceAnalyticsController::class, 'projects']);
            Route::get('/managers', [FinanceAnalyticsController::class, 'managers']);
            Route::get('/clients', [FinanceAnalyticsController::class, 'clients']);
            Route::get('/employees', [FinanceAnalyticsController::class, 'employees']);
        });

        Route::get('/', [FinanceController::class, 'index']);
        Route::get('/export', [FinanceController::class, 'export']);
        Route::get('/summary', [FinanceController::class, 'summary']);
        Route::post('/', [FinanceController::class, 'store']);
        Route::get('/{finance}', [FinanceController::class, 'show']);
        Route::patch('/{finance}', [FinanceController::class, 'update']);
        Route::delete('/{finance}', [FinanceController::class, 'destroy']);
    });

    Route::prefix('finance-articles')->group(function (): void {
        Route::get('/', [FinanceArticleController::class, 'index']);
        Route::post('/', [FinanceArticleController::class, 'store']);
        Route::get('/{article}', [FinanceArticleController::class, 'show']);
        Route::patch('/{article}', [FinanceArticleController::class, 'update']);
        Route::delete('/{article}', [FinanceArticleController::class, 'destroy']);
    });

    Route::prefix('planned-expenses')->group(function (): void {
        Route::get('/', [PlannedExpenseController::class, 'index']);
        Route::post('/', [PlannedExpenseController::class, 'store']);
        Route::get('/payments', [PlannedExpenseController::class, 'payments']);
        Route::get('/{plannedExpense}', [PlannedExpenseController::class, 'show']);
        Route::patch('/{plannedExpense}', [PlannedExpenseController::class, 'update']);
        Route::delete('/{plannedExpense}', [PlannedExpenseController::class, 'destroy']);
    });

    Route::prefix('employees')->group(function (): void {
        Route::get('/', [EmployeeController::class, 'index']);
        Route::get('/payroll-calculations', [EmployeePayrollCalculationController::class, 'companyIndex']);
        Route::get('/payroll-summary', [EmployeePayrollCalculationController::class, 'companySummary']);
        Route::get('/{employee}/absences', [EmployeeAbsenceController::class, 'index']);
        Route::get('/{employee}/absences/calendar', [EmployeeAbsenceController::class, 'calendar']);
        Route::post('/{employee}/absences', [EmployeeAbsenceController::class, 'store']);
        Route::post('/{employee}/absences/calculate-fixed-daily-amount', [EmployeeAbsenceController::class, 'calculateFixedDailyAmount']);
        Route::get('/{employee}/documents', [EmployeeDocumentController::class, 'index']);
        Route::post('/{employee}/documents', [EmployeeDocumentController::class, 'store']);
        Route::get('/{employee}/rates', [EmployeeRateController::class, 'index']);
        Route::get('/{employee}/rates/current', [EmployeeRateController::class, 'current']);
        Route::post('/{employee}/rates', [EmployeeRateController::class, 'store']);
        Route::get('/{employee}/bank-details', [BankDetailController::class, 'show']);
        Route::post('/{employee}/bank-details', [BankDetailController::class, 'store']);
        Route::get('/{employee}/payroll-calculations', [EmployeePayrollCalculationController::class, 'index']);
        Route::get('/{employee}/payroll-settings', [EmployeePayrollSettingsController::class, 'show']);
        Route::patch('/{employee}/payroll-settings', [EmployeePayrollSettingsController::class, 'update']);
    });

    Route::get('/payroll-recalculations', [PayrollRecalculationController::class, 'show']);
    Route::post('/payroll-recalculations', [PayrollRecalculationController::class, 'store']);

    Route::prefix('payroll-payouts')->group(function (): void {
        Route::get('/settings', [PayrollPayoutController::class, 'settings']);
        Route::put('/settings', [PayrollPayoutController::class, 'updateSettings']);
        Route::get('/sheet', [PayrollPayoutController::class, 'sheet']);
        Route::get('/debts', [PayrollPayoutController::class, 'debts']);
        Route::get('/report', [PayrollPayoutController::class, 'report']);
        Route::put('/plan', [PayrollPayoutController::class, 'updatePlan']);
        Route::put('/opening', [PayrollPayoutController::class, 'updateOpening']);
        Route::post('/close', [PayrollPayoutController::class, 'close']);
        Route::post('/reopen', [PayrollPayoutController::class, 'reopen']);
        Route::post('/', [PayrollPayoutController::class, 'store']);
        Route::delete('/{payout}', [PayrollPayoutController::class, 'destroy']);
    });

    Route::prefix('payroll-payout-articles')->group(function (): void {
        Route::get('/', [PayrollPayoutArticleController::class, 'index']);
        Route::post('/', [PayrollPayoutArticleController::class, 'store']);
        Route::patch('/{article}', [PayrollPayoutArticleController::class, 'update']);
        Route::delete('/{article}', [PayrollPayoutArticleController::class, 'destroy']);
        Route::post('/{article}/restore', [PayrollPayoutArticleController::class, 'restore']);
    });

    Route::patch('/employee-absences/{absence}', [EmployeeAbsenceController::class, 'update']);
    Route::delete('/employee-absences/{absence}', [EmployeeAbsenceController::class, 'destroy']);
    Route::get('/employee-documents/{document}', [EmployeeDocumentController::class, 'download']);
    Route::delete('/employee-documents/{document}', [EmployeeDocumentController::class, 'destroy']);
    Route::get('/employee-rates', [EmployeeRateController::class, 'employees']);
    Route::patch('/employee-rates/{rate}', [EmployeeRateController::class, 'update']);
    Route::delete('/employee-rates/{rate}', [EmployeeRateController::class, 'destroy']);
    Route::get('/project-documents/{document}', [ProjectDocumentController::class, 'download']);
    Route::patch('/project-documents/{document}', [ProjectDocumentController::class, 'update']);
    Route::delete('/project-documents/{document}', [ProjectDocumentController::class, 'destroy']);
    Route::get('/task-description-images/{image}', [ProjectController::class, 'taskDescriptionImage']);
    Route::patch('/project-notes/{note}', [ProjectNoteController::class, 'update']);
    Route::delete('/project-notes/{note}', [ProjectNoteController::class, 'destroy']);
    Route::post('/project-notes/{note}/pin', [ProjectNoteController::class, 'pin']);
    Route::delete('/project-notes/{note}/pin', [ProjectNoteController::class, 'unpin']);
    Route::post('/project-notes/{note}/images', [ProjectNoteController::class, 'uploadImage']);
    Route::get('/project-note-images/{image}', [ProjectNoteController::class, 'image']);

    Route::prefix('reports')->group(function (): void {
        Route::get('/time', [ReportController::class, 'time']);
        Route::get('/day-timeline', [ReportController::class, 'dayTimeline']);
        Route::get('/tasks', [ReportController::class, 'tasks']);
        Route::get('/managers', [ReportController::class, 'managers']);
        Route::get('/overrun', [ReportController::class, 'overrun']);
        Route::get('/stale-tasks', [ReportController::class, 'staleTasks']);
        Route::get('/limits', [ReportController::class, 'limits']);
        Route::get('/hours-chart', [ReportController::class, 'hoursChart']);
    });

    Route::prefix('project-assignment-histories')->group(function (): void {
        Route::get('/by-project/{project}', [ProjectAssignmentHistoryController::class, 'projectIndex']);
        Route::get('/by-user/{employee}', [ProjectAssignmentHistoryController::class, 'employeeIndex']);
        Route::post('/', [ProjectAssignmentHistoryController::class, 'store']);
        Route::patch('/{assignment}', [ProjectAssignmentHistoryController::class, 'update']);
        Route::delete('/{assignment}', [ProjectAssignmentHistoryController::class, 'destroy']);
    });

    Route::prefix('project-activity-histories')->group(function (): void {
        Route::get('/by-project/{project}', [ProjectActivityHistoryController::class, 'index']);
        Route::post('/', [ProjectActivityHistoryController::class, 'store']);
        Route::patch('/{activity}', [ProjectActivityHistoryController::class, 'update']);
        Route::delete('/{activity}', [ProjectActivityHistoryController::class, 'destroy']);
    });

    Route::patch('/time-entries/{segment}/move', [TimeEntryController::class, 'move']);
    Route::patch('/time-entries/{segment}/delete-interval', [TimeEntryController::class, 'deleteInterval']);

    Route::post('/time-entries', [TimeEntryController::class, 'store']);

    Route::prefix('admin')->group(function (): void {
        Route::prefix('roles')->group(function (): void {
            Route::get('/permissions', [AdminRolePermissionController::class, 'index']);
            Route::post('/', [AdminRolePermissionController::class, 'store']);
            Route::patch('/{role}', [AdminRolePermissionController::class, 'update']);
            Route::delete('/{role}', [AdminRolePermissionController::class, 'destroy']);
            Route::patch('/{role}/permissions', [AdminRolePermissionController::class, 'sync']);
        });

        Route::get('/client-accounts', [AdminClientAccountController::class, 'index']);

        Route::prefix('employees')->group(function (): void {
            Route::post('/', [AdminEmployeeController::class, 'store']);

            Route::prefix('{employee}')->group(function (): void {
                Route::patch('/', [AdminEmployeeController::class, 'updateProfile']);
                Route::patch('/password', [AdminEmployeeController::class, 'changePassword']);
                Route::patch('/block', [AdminEmployeeController::class, 'block']);
                Route::patch('/role', [AdminEmployeeController::class, 'updateRole']);
                Route::patch('/permissions', [AdminEmployeeController::class, 'syncPermissions']);
                Route::delete('/', [AdminEmployeeController::class, 'destroy']);
            });
        });
    });

    Route::prefix('worker')->group(function (): void {
        Route::prefix('projects')->group(function (): void {
            Route::get('/', [WorkerProjectController::class, 'index']);
            Route::get('/{project}/tasks', [WorkerProjectController::class, 'tasks']);
            Route::get('/{project}/user/{userId}/tasks', [WorkerProjectController::class, 'userTasks']);
        });

        Route::prefix('reports')->group(function (): void {
            Route::get('/time', [WorkerReportController::class, 'time']);
            Route::get('/day-timeline', [WorkerReportController::class, 'dayTimeline']);
            Route::get('/tasks', [WorkerReportController::class, 'tasks']);
        });
    });
});

Route::post('/client/auth/refresh', [AuthController::class, 'refreshClient']);
Route::post('/client/auth/password', [AuthController::class, 'setClientPassword']);
Route::middleware(['auth.access', 'client.only', 'company.active'])->prefix('client')->group(function (): void {
    Route::get('/profile', [ClientPortalController::class, 'profile']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/portal', [ClientPortalController::class, 'portal']);
    Route::post('/pinned-projects/{project}', [ClientPortalController::class, 'pinProject']);
    Route::delete('/pinned-projects/{project}', [ClientPortalController::class, 'unpinProject']);
    Route::put('/profile/password', [ClientPortalController::class, 'changePassword']);
    Route::post('/projects/{project}/tasks', [ClientPortalController::class, 'storeTask']);
    Route::get('/projects/{project}/documents', [ClientPortalController::class, 'documents']);
    Route::get('/documents/{document}', [ClientPortalController::class, 'document']);
    Route::get('/reports/tasks', [ClientPortalController::class, 'tasksReport']);
    Route::get('/tasks/{task}', [ClientPortalController::class, 'task']);
    Route::patch('/tasks/{task}', [ClientPortalController::class, 'updateTask']);
    Route::get('/tasks/{task}/messages', [ClientPortalController::class, 'messages']);
    Route::post('/tasks/{task}/messages', [ClientPortalController::class, 'storeMessage']);
    Route::patch('/tasks/{task}/approval', [ClientPortalController::class, 'approve']);
    Route::get('/tasks/{task}/description-images/{image}', [ClientPortalController::class, 'descriptionImage'])->name('api.client.task-description-image');
    Route::get('/tasks/{task}/message-attachments/{attachment}', [ClientPortalController::class, 'messageAttachment'])->name('api.client.task-message-attachment');
    Route::post('/tasks/{task}/notifications/read', [NotificationController::class, 'readTask']);

    Route::prefix('notifications')->group(function (): void {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/read-all', [NotificationController::class, 'readAll']);
        Route::get('/settings', [NotificationController::class, 'settings']);
        Route::put('/settings', [NotificationController::class, 'updateSettings']);
        Route::post('/{notification}/read', [NotificationController::class, 'read'])->whereUuid('notification');
    });
});

Route::middleware('external-api.token')->prefix('external')->group(function (): void {
    Route::get('/users', [ExternalUserController::class, 'index']);
    Route::get('/reports/work-segments', [ExternalReportController::class, 'workSegments']);
});
