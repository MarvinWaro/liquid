<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\HEIController;
use App\Http\Controllers\RegionController;
use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\BulkEntryDraftController;
use App\Http\Controllers\LiquidationController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\DocumentRequirementController;
use App\Http\Controllers\TemplateController;
use App\Http\Controllers\LiquidationCommentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\SemesterController;
use App\Http\Controllers\AcademicYearController;
use App\Http\Controllers\AcademicYearRequirementController;

Route::get('/', [AnnouncementController::class, 'welcome'])->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    // Announcement CRUD Routes
    Route::get('announcement', [AnnouncementController::class, 'index'])->name('announcements.index');
    Route::get('announcement/create', [AnnouncementController::class, 'create'])->name('announcements.create');
    Route::post('announcement', [AnnouncementController::class, 'store'])->name('announcements.store');
    Route::get('announcement/{announcement:slug}', [AnnouncementController::class, 'show'])->name('announcements.show');
    Route::get('announcement/{announcement:slug}/edit', [AnnouncementController::class, 'edit'])->name('announcements.edit');
    Route::put('announcement/{announcement:slug}', [AnnouncementController::class, 'update'])->name('announcements.update');
    Route::delete('announcement/{announcement:slug}', [AnnouncementController::class, 'destroy'])->name('announcements.destroy');

    // Announcement Comments (threaded + mentions)
    Route::get('announcement/{announcement:slug}/comments', [\App\Http\Controllers\AnnouncementCommentController::class, 'index'])->name('announcement-comments.index');
    Route::post('announcement/{announcement:slug}/comments', [\App\Http\Controllers\AnnouncementCommentController::class, 'store'])->name('announcement-comments.store');
    Route::delete('announcement/{announcement:slug}/comments/{comment}', [\App\Http\Controllers\AnnouncementCommentController::class, 'destroy'])->name('announcement-comments.destroy');
    Route::post('announcement/{announcement:slug}/comments/{comment}/react', [\App\Http\Controllers\AnnouncementCommentController::class, 'toggleReaction'])->name('announcement-comments.react');
    Route::get('announcement/{announcement:slug}/mentionable-users', [\App\Http\Controllers\AnnouncementCommentController::class, 'mentionableUsers'])->name('announcement-comments.mentionable-users');
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('contact-support', fn () => Inertia::render('contact-support'))->name('contact-support');
    Route::get('report', function () {
        $user = auth()->user();
        $roleName = $user->role?->name;

        // HEIs — scope by role: HEI users see only their institution; RCs see only their region.
        // Eager-load one user with an avatar so we can fall back to user_avatar when the HEI has no logo
        // (mirrors HEIController::index so report cards match HEI Management).
        $heisQuery = \App\Models\HEI::with([
            'region:id,code,name',
            'users' => fn ($q) => $q->whereNotNull('avatar')->select('id', 'hei_id', 'avatar')->limit(1),
        ])->orderBy('name');
        if ($roleName === 'HEI' && $user->hei_id) {
            $heisQuery->where('id', $user->hei_id);
        } elseif ($roleName === 'Regional Coordinator' && $user->region_id) {
            $heisQuery->where('region_id', $user->region_id);
        }
        $heis = $heisQuery->get(['id', 'uii', 'name', 'type', 'logo', 'region_id', 'status'])
            ->each(function ($hei) {
                $hei->user_avatar = $hei->users->first()?->avatar_url;
                unset($hei->users);
            });

        $regions = \App\Models\Region::where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        // Role-scoped selectable programs (mirrors LiquidationController's createPrograms logic).
        $allPrograms = app(\App\Services\CacheService::class)->getSelectablePrograms();
        if (in_array($roleName, ['Regional Coordinator', 'Encoder'])) {
            $programs = $allPrograms
                ->filter(fn ($p) => $p->parent_id === null && ($p->children_count ?? 0) === 0)
                ->values();
        } elseif ($roleName === 'STUFAPS Focal') {
            $scopedIds = $user->getParentScopedProgramIds();
            $programs = $scopedIds
                ? $allPrograms->filter(fn ($p) => in_array($p->id, $scopedIds))->values()
                : collect();
        } else {
            $programs = $allPrograms->filter(fn ($p) => $p->is_selectable ?? true)->values();
        }

        return Inertia::render('report', [
            'heis' => $heis,
            'regions' => $regions,
            'programs' => $programs,
            'academicYears' => \App\Models\AcademicYear::getDropdownOptions(),
            'rcNoteStatuses' => \App\Models\RcNoteStatus::getDropdownOptions(),
            'documentStatuses' => \App\Models\DocumentStatus::orderBy('sort_order')->get(['id', 'code', 'name']),
            'liquidationStatuses' => \App\Models\LiquidationStatus::orderBy('sort_order')->get(['id', 'code', 'name']),
            'canFilterByRegion' => in_array($roleName, ['Super Admin', 'Admin']),
            'userRole' => $roleName,
        ]);
    })->name('report');
    Route::get('fiscal-year', fn () => Inertia::render('fiscal-year'))->name('fiscal-year');
    Route::get('summary/academic-year', [DashboardController::class, 'summaryPerAY'])->name('summary.academic-year');
    Route::get('summary/hei', [DashboardController::class, 'summaryPerHEI'])->name('summary.hei');

    // Role Management Routes
    Route::get('roles', [RoleController::class, 'index'])->name('roles.index');
    Route::get('roles/create', [RoleController::class, 'create'])->name('roles.create');
    Route::post('roles', [RoleController::class, 'store'])->name('roles.store');
    Route::get('roles/{role}/edit', [RoleController::class, 'edit'])->name('roles.edit');
    Route::put('roles/{role}', [RoleController::class, 'update'])->name('roles.update');
    Route::delete('roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy');

    // User Management Routes
    Route::get('users', [UserController::class, 'index'])->name('users.index');
    Route::get('users/create', [UserController::class, 'create'])->name('users.create');
    Route::post('users', [UserController::class, 'store'])->name('users.store');
    Route::get('users/{user}/edit', [UserController::class, 'edit'])->name('users.edit');
    Route::put('users/{user}', [UserController::class, 'update'])->name('users.update');
    Route::patch('users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');
    Route::delete('users/{user}', [UserController::class, 'destroy'])->name('users.destroy');

    // HEI Management Routes
    Route::get('hei', [HEIController::class, 'index'])->name('hei.index');
    Route::post('hei', [HEIController::class, 'store'])->name('hei.store');
    Route::put('hei/{hei}', [HEIController::class, 'update'])->name('hei.update');
    Route::delete('hei/{hei}', [HEIController::class, 'destroy'])->name('hei.destroy');

    // Program Management Routes
    Route::get('programs', [ProgramController::class, 'index'])->name('programs.index');
    Route::post('programs', [ProgramController::class, 'store'])->name('programs.store');
    Route::put('programs/{program}', [ProgramController::class, 'update'])->name('programs.update');
    Route::delete('programs/{program}', [ProgramController::class, 'destroy'])->name('programs.destroy');

    // Program Due Date Rules
    Route::post('programs/{program}/due-date-rules', [ProgramController::class, 'storeDueDateRule'])->name('programs.due-date-rules.store');
    Route::put('programs/{program}/due-date-rules/{rule}', [ProgramController::class, 'updateDueDateRule'])->name('programs.due-date-rules.update');
    Route::delete('programs/{program}/due-date-rules/{rule}', [ProgramController::class, 'destroyDueDateRule'])->name('programs.due-date-rules.destroy');

    // Semester Management Routes
    Route::get('semesters', [SemesterController::class, 'index'])->name('semesters.index');
    Route::post('semesters', [SemesterController::class, 'store'])->name('semesters.store');
    Route::put('semesters/{semester}', [SemesterController::class, 'update'])->name('semesters.update');
    Route::delete('semesters/{semester}', [SemesterController::class, 'destroy'])->name('semesters.destroy');

    // Academic Year Management Routes
    Route::get('academic-years', [AcademicYearController::class, 'index'])->name('academic-years.index');
    Route::post('academic-years', [AcademicYearController::class, 'store'])->name('academic-years.store');
    Route::put('academic-years/{academicYear}', [AcademicYearController::class, 'update'])->name('academic-years.update');
    Route::delete('academic-years/{academicYear}', [AcademicYearController::class, 'destroy'])->name('academic-years.destroy');
    Route::post('academic-years/reorder', [AcademicYearController::class, 'reorder'])->name('academic-years.reorder');

    // Academic Year — Per-AY Document Requirements
    Route::get('academic-years/{academicYear}/requirements', [AcademicYearRequirementController::class, 'index'])->name('academic-years.requirements.index');
    Route::post('academic-years/{academicYear}/requirements/sync', [AcademicYearRequirementController::class, 'sync'])->name('academic-years.requirements.sync');
    Route::post('academic-years/{academicYear}/requirements/copy', [AcademicYearRequirementController::class, 'copyFromYear'])->name('academic-years.requirements.copy');
    Route::delete('academic-years/{academicYear}/requirements', [AcademicYearRequirementController::class, 'reset'])->name('academic-years.requirements.reset');
    Route::post('academic-years/{academicYear}/requirements/reset-program', [AcademicYearRequirementController::class, 'resetProgram'])->name('academic-years.requirements.reset-program');

    // Document Requirement Management Routes
    Route::get('document-requirements', [DocumentRequirementController::class, 'index'])->name('document-requirements.index');
    Route::post('document-requirements', [DocumentRequirementController::class, 'store'])->name('document-requirements.store');
    Route::put('document-requirements/{requirement}', [DocumentRequirementController::class, 'update'])->name('document-requirements.update');
    Route::delete('document-requirements/{requirement}', [DocumentRequirementController::class, 'destroy'])->name('document-requirements.destroy');

    // Form Template Management Routes
    Route::get('templates', [TemplateController::class, 'index'])->name('templates.index');
    Route::post('templates', [TemplateController::class, 'store'])->name('templates.store');
    Route::put('templates/{template}', [TemplateController::class, 'update'])->name('templates.update');
    Route::delete('templates/{template}', [TemplateController::class, 'destroy'])->name('templates.destroy');
    Route::get('templates/{template}/download', [TemplateController::class, 'download'])->name('templates.download');

    // Activity Log Routes
    Route::get('activity-logs', [ActivityLogController::class, 'index'])->name('activity-logs.index');

    // Notification Routes
    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::get('notifications/recent', [NotificationController::class, 'recent'])->name('notifications.recent');
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markAsRead'])->name('notifications.mark-read');
    Route::patch('notifications/{notification}/unread', [NotificationController::class, 'markAsUnread'])->name('notifications.mark-unread');
    Route::post('notifications/mark-all-read', [NotificationController::class, 'markAllRead'])->name('notifications.mark-all-read');
    Route::delete('notifications/{notification}', [NotificationController::class, 'destroy'])->name('notifications.destroy');

    // Region Management Routes
    Route::get('regions', [RegionController::class, 'index'])->name('regions.index');
    Route::post('regions', [RegionController::class, 'store'])->name('regions.store');
    Route::put('regions/{region}', [RegionController::class, 'update'])->name('regions.update');
    Route::delete('regions/{region}', [RegionController::class, 'destroy'])->name('regions.destroy');

    // Liquidation Management Routes
    Route::get('liquidation', [LiquidationController::class, 'index'])->name('liquidation.index');
    Route::post('liquidation', [LiquidationController::class, 'store'])->name('liquidation.store');
    Route::get('liquidation/lookup-hei', [LiquidationController::class, 'lookupHEI'])->name('liquidation.lookup-hei');
    Route::get('liquidation/next-control-no', [LiquidationController::class, 'nextControlNo'])->name('liquidation.next-control-no');
    Route::put('liquidation/{liquidation}', [LiquidationController::class, 'update'])->name('liquidation.update');
    Route::delete('liquidation/{liquidation}', [LiquidationController::class, 'destroy'])->name('liquidation.destroy');
    Route::post('liquidation/{liquidation}/void', [LiquidationController::class, 'void'])->name('liquidation.void');
    Route::post('liquidation/{liquidation}/restore', [LiquidationController::class, 'restore'])->name('liquidation.restore');
    Route::post('liquidation/{liquidation}/toggle-pin', [LiquidationController::class, 'togglePin'])->name('liquidation.toggle-pin');

    // Liquidation Workflow Routes
    Route::post('liquidation/bulk-endorse-to-accounting', [LiquidationController::class, 'bulkEndorseToAccounting'])->name('liquidation.bulk-endorse-to-accounting');
    Route::post('liquidation/{liquidation}/submit', [LiquidationController::class, 'submit'])->name('liquidation.submit');
    Route::post('liquidation/{liquidation}/endorse-to-accounting', [LiquidationController::class, 'endorseToAccounting'])->name('liquidation.endorse-to-accounting');
    Route::post('liquidation/{liquidation}/return-to-hei', [LiquidationController::class, 'returnToHEI'])->name('liquidation.return-to-hei');
    Route::post('liquidation/{liquidation}/endorse-to-coa', [LiquidationController::class, 'endorseToCOA'])->name('liquidation.endorse-to-coa');
    Route::post('liquidation/{liquidation}/return-to-rc', [LiquidationController::class, 'returnToRC'])->name('liquidation.return-to-rc');

    // Liquidation Document Routes
    Route::post('liquidation/{liquidation}/upload-document', [LiquidationController::class, 'uploadDocument'])->name('liquidation.upload-document');
    Route::post('liquidation/{liquidation}/store-gdrive-link', [LiquidationController::class, 'storeGdriveLink'])->name('liquidation.store-gdrive-link');
    Route::get('liquidation-documents/{document}/download', [LiquidationController::class, 'downloadDocument'])->name('liquidation.download-document');
    Route::get('liquidation-documents/{document}/view', [LiquidationController::class, 'viewDocument'])->name('liquidation.view-document');
    Route::delete('liquidation-documents/{document}', [LiquidationController::class, 'deleteDocument'])->name('liquidation.delete-document');

    // Liquidation Template Download
    Route::get('liquidation/template/download', [LiquidationController::class, 'downloadTemplate'])->name('liquidation.download-template');

    // Async Report Pipeline — queue a Print/Excel/CSV job, then download via the
    // notification that fires when it's ready. Survives page refresh; uses the
    // existing notification dropdown to surface "report ready" to the user.
    Route::post('reports/queue', [\App\Http\Controllers\ReportJobController::class, 'queue'])->name('reports.queue');
    Route::get('reports/download/{notification}', [\App\Http\Controllers\ReportJobController::class, 'download'])->name('reports.download');
    Route::post('reports/notifications/{notification}/claim-delivery', [\App\Http\Controllers\ReportJobController::class, 'claimDelivery'])->name('reports.claim-delivery');

    // RC Bulk Liquidation Routes
    Route::get('liquidation/rc-template/download', [LiquidationController::class, 'downloadRCTemplate'])->name('liquidation.download-rc-template');
    Route::post('liquidation/validate-import', [LiquidationController::class, 'validateImport'])->middleware('throttle:10,1')->name('liquidation.validate-import');
    Route::post('liquidation/validate-parsed-import', [LiquidationController::class, 'validateParsedImport'])->name('liquidation.validate-parsed-import');
    Route::get('liquidation/validate-progress', [LiquidationController::class, 'validateProgress'])->name('liquidation.validate-progress');
    Route::post('liquidation/bulk-import', [LiquidationController::class, 'bulkImportLiquidations'])->name('liquidation.bulk-import');
    Route::get('liquidation/import-progress', [LiquidationController::class, 'importProgress'])->name('liquidation.import-progress');
    Route::get('liquidation/import-batches', [LiquidationController::class, 'importBatches'])->name('liquidation.import-batches');
    Route::post('liquidation/import-batches/{batchId}/undo', [LiquidationController::class, 'undoImportBatch'])->name('liquidation.undo-import-batch');
    Route::get('liquidation/import-batches/{batchId}/download', [LiquidationController::class, 'downloadImportBatchFile'])->name('liquidation.download-import-batch-file');
    Route::post('liquidation/bulk-store', [LiquidationController::class, 'bulkStore'])->name('liquidation.bulk-store');

    // Server-side persistence for the bulk-entry modal draft (one draft per user).
    Route::get('liquidation/bulk-entry/draft', [BulkEntryDraftController::class, 'show'])->name('liquidation.bulk-entry-draft.show');
    Route::put('liquidation/bulk-entry/draft', [BulkEntryDraftController::class, 'update'])->name('liquidation.bulk-entry-draft.update');
    Route::delete('liquidation/bulk-entry/draft', [BulkEntryDraftController::class, 'destroy'])->name('liquidation.bulk-entry-draft.destroy');

    // Liquidation Tracking Entry Routes
    Route::post('liquidation/{liquidation}/tracking-entries', [LiquidationController::class, 'saveTrackingEntries'])->name('liquidation.save-tracking-entries');
    Route::post('liquidation/{liquidation}/running-data', [LiquidationController::class, 'saveRunningData'])->name('liquidation.save-running-data');

    // Liquidation Comment Routes
    Route::get('liquidation/{liquidation}/comments', [LiquidationCommentController::class, 'index'])->name('liquidation.comments.index');
    Route::post('liquidation/{liquidation}/comments', [LiquidationCommentController::class, 'store'])->name('liquidation.comments.store');
    Route::delete('liquidation/{liquidation}/comments/{comment}', [LiquidationCommentController::class, 'destroy'])->name('liquidation.comments.destroy');
    Route::get('liquidation/{liquidation}/mentionable-users', [LiquidationCommentController::class, 'mentionableUsers'])->name('liquidation.mentionable-users');
    Route::get('liquidation-comments/{comment}/attachment/{index}', [LiquidationCommentController::class, 'downloadAttachment'])->name('liquidation-comments.download-attachment');

    // Liquidation Beneficiary Routes
    Route::get('liquidation/{liquidation}', [LiquidationController::class, 'show'])->name('liquidation.show');
    Route::get('liquidation/{liquidation}/beneficiary-template', [LiquidationController::class, 'downloadBeneficiaryTemplate'])->name('liquidation.download-beneficiary-template');
    Route::post('liquidation/{liquidation}/import-beneficiaries', [LiquidationController::class, 'importBeneficiaries'])->name('liquidation.import-beneficiaries');
});

require __DIR__.'/settings.php';
