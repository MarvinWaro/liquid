<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Liquidation;
use App\Models\User;

class LiquidationPolicy
{
    public function view(User $user, Liquidation $liquidation): bool
    {
        if (! $user->hasPermission('view_liquidation')) {
            return false;
        }

        $roleName = $user->role?->name;

        if ($user->isSuperAdmin() || $roleName === 'Admin') {
            return true;
        }

        if ($roleName === 'Regional Coordinator') {
            return $liquidation->isManagedByRegion($user->region_id)
                && ! $liquidation->program?->parent_id;
        }

        if ($roleName === 'STUFAPS Focal') {
            return $this->isAssignedProgram($user, $liquidation);
        }

        if ($roleName === 'Accountant') {
            return $liquidation->reviewed_at !== null;
        }

        if ($roleName === 'COA') {
            return $liquidation->coa_endorsed_at !== null;
        }

        if ($roleName === 'HEI') {
            return $user->hei_id !== null && $liquidation->hei_id === $user->hei_id;
        }

        return $liquidation->created_by === $user->id;
    }

    public function edit(User $user, Liquidation $liquidation): bool
    {
        if (! $user->hasPermission('edit_liquidation')) {
            return false;
        }

        $roleName = $user->role?->name;

        if ($user->isSuperAdmin() || $roleName === 'Admin') {
            return true;
        }

        if ($roleName === 'Regional Coordinator') {
            return $liquidation->isManagedByRegion($user->region_id)
                && ! $liquidation->program?->parent_id;
        }

        if ($roleName === 'STUFAPS Focal') {
            return $this->isAssignedProgram($user, $liquidation);
        }

        if ($roleName === 'HEI' && $user->hei_id !== $liquidation->hei_id) {
            return false;
        }

        // Preserve the existing Encoder/creator workflow while keeping the
        // record subject to the same editability rules used by HEI creators.
        return $liquidation->created_by === $user->id
            && $liquidation->isEditableByHEI();
    }

    public function review(User $user, Liquidation $liquidation): bool
    {
        if (! $user->hasPermission('review_liquidation')) {
            return false;
        }

        $roleName = $user->role?->name;

        if ($user->isSuperAdmin()) {
            return true;
        }

        if ($roleName === 'Regional Coordinator') {
            return $liquidation->isManagedByRegion($user->region_id)
                && ! $liquidation->program?->parent_id;
        }

        return $roleName === 'STUFAPS Focal' && $this->isAssignedProgram($user, $liquidation);
    }

    public function manageInternalData(User $user, Liquidation $liquidation): bool
    {
        if ($user->isSuperAdmin() || $user->role?->name === 'Admin') {
            return $user->hasPermission('edit_liquidation') || $user->hasPermission('review_liquidation');
        }

        if ($user->role?->name === 'Encoder') {
            return $this->edit($user, $liquidation);
        }

        return $this->review($user, $liquidation);
    }

    public function uploadDocument(User $user, Liquidation $liquidation): bool
    {
        if ($user->role?->name === 'HEI') {
            return $user->hei_id !== null && $user->hei_id === $liquidation->hei_id;
        }

        return $this->manageInternalData($user, $liquidation);
    }

    public function comment(User $user, Liquidation $liquidation): bool
    {
        return $this->view($user, $liquidation);
    }

    private function isAssignedProgram(User $user, Liquidation $liquidation): bool
    {
        $programIds = $user->getParentScopedProgramIds();

        return $programIds !== null && in_array($liquidation->program_id, $programIds, true);
    }
}
