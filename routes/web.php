<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\HEIController;
use App\Http\Controllers\RegionController;
use App\Http\Controllers\LiquidationController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\DocumentRequirementController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\SemesterController;
use App\Http\Controllers\AcademicYearController;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

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

    // Document Requirement Management Routes
    Route::get('document-requirements', [DocumentRequirementController::class, 'index'])->name('document-requirements.index');
    Route::post('document-requirements', [DocumentRequirementController::class, 'store'])->name('document-requirements.store');
    Route::put('document-requirements/{requirement}', [DocumentRequirementController::class, 'update'])->name('document-requirements.update');
    Route::delete('document-requirements/{requirement}', [DocumentRequirementController::class, 'destroy'])->name('document-requirements.destroy');

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
    Route::get('liquidation/{liquidation}/edit', [LiquidationController::class, 'edit'])->name('liquidation.edit');
    Route::put('liquidation/{liquidation}', [LiquidationController::class, 'update'])->name('liquidation.update');
    Route::delete('liquidation/{liquidation}', [LiquidationController::class, 'destroy'])->name('liquidation.destroy');

    // Liquidation Workflow Routes
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

    // RC Bulk Liquidation Routes
    Route::get('liquidation/rc-template/download', [LiquidationController::class, 'downloadRCTemplate'])->name('liquidation.download-rc-template');
    Route::post('liquidation/bulk-import', [LiquidationController::class, 'bulkImportLiquidations'])->name('liquidation.bulk-import');

    // Liquidation Tracking Entry Routes
    Route::post('liquidation/{liquidation}/tracking-entries', [LiquidationController::class, 'saveTrackingEntries'])->name('liquidation.save-tracking-entries');
    Route::post('liquidation/{liquidation}/running-data', [LiquidationController::class, 'saveRunningData'])->name('liquidation.save-running-data');

    // Liquidation Beneficiary Routes
    Route::get('liquidation/{liquidation}', [LiquidationController::class, 'show'])->name('liquidation.show');
    Route::get('liquidation/{liquidation}/beneficiary-template', [LiquidationController::class, 'downloadBeneficiaryTemplate'])->name('liquidation.download-beneficiary-template');
    Route::post('liquidation/{liquidation}/import-beneficiaries', [LiquidationController::class, 'importBeneficiaries'])->name('liquidation.import-beneficiaries');
});

require __DIR__.'/settings.php';
