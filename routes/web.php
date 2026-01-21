<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\LiquidationController;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

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

    // Liquidation Management Routes
    Route::get('liquidation', [LiquidationController::class, 'index'])->name('liquidation.index');
    Route::get('liquidation/create', [LiquidationController::class, 'create'])->name('liquidation.create');
    Route::post('liquidation', [LiquidationController::class, 'store'])->name('liquidation.store');
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
    Route::get('liquidation-documents/{document}/download', [LiquidationController::class, 'downloadDocument'])->name('liquidation.download-document');
    Route::delete('liquidation-documents/{document}', [LiquidationController::class, 'deleteDocument'])->name('liquidation.delete-document');

    // Liquidation Template Download
    Route::get('liquidation/template/download', [LiquidationController::class, 'downloadTemplate'])->name('liquidation.download-template');

    // Liquidation Beneficiary Routes
    Route::get('liquidation/{liquidation}', [LiquidationController::class, 'show'])->name('liquidation.show');
    Route::get('liquidation/{liquidation}/beneficiary-template', [LiquidationController::class, 'downloadBeneficiaryTemplate'])->name('liquidation.download-beneficiary-template');
    Route::post('liquidation/{liquidation}/import-beneficiaries', [LiquidationController::class, 'importBeneficiaries'])->name('liquidation.import-beneficiaries');
});

require __DIR__.'/settings.php';
