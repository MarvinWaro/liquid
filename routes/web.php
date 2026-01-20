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
    Route::resource('roles', RoleController::class);

    // User Management Routes
    Route::get('users', [UserController::class, 'index'])->name('users.index');
    Route::get('users/create', [UserController::class, 'create'])->name('users.create');
    Route::post('users', [UserController::class, 'store'])->name('users.store');
    Route::get('users/{user}/edit', [UserController::class, 'edit'])->name('users.edit');
    Route::put('users/{user}', [UserController::class, 'update'])->name('users.update');
    Route::patch('users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');
    Route::delete('users/{user}', [UserController::class, 'destroy'])->name('users.destroy');

    // Liquidation Routes
    Route::get('liquidations', [LiquidationController::class, 'index'])->name('liquidations.index');
    Route::post('liquidations', [LiquidationController::class, 'store'])->name('liquidations.store');
    Route::get('liquidations/{liquidation}', [LiquidationController::class, 'show'])->name('liquidations.show');
    Route::get('liquidations/{liquidation}/items', [LiquidationController::class, 'getItems'])->name('liquidations.items');

    // Liquidation Actions
    Route::get('liquidations/template/download', [LiquidationController::class, 'downloadTemplate'])->name('liquidations.template');
    Route::post('liquidations/{liquidation}/upload', [LiquidationController::class, 'uploadCsv'])->name('liquidations.upload');
    Route::post('liquidations/{liquidation}/submit', [LiquidationController::class, 'submit'])->name('liquidations.submit');
    Route::post('liquidations/{liquidation}/endorse', [LiquidationController::class, 'endorse'])->name('liquidations.endorse');
    Route::post('liquidations/{liquidation}/endorse-coa', [LiquidationController::class, 'endorseToCoa'])->name('liquidations.endorse-coa');
    Route::post('liquidations/{liquidation}/return', [LiquidationController::class, 'returnReport'])->name('liquidations.return');
});

require __DIR__.'/settings.php';
