<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\HEI;
use App\Models\HEIRegionTransfer;
use App\Models\Region;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class HEIRegionTransferService
{
    public function __construct(private readonly CacheService $cacheService) {}

    /**
     * Update an HEI and record an immutable audit entry when its region changes.
     */
    public function update(HEI $hei, array $attributes, User $actor, ?array $transferData = null): HEI
    {
        return DB::transaction(function () use ($hei, $attributes, $actor, $transferData): HEI {
            /** @var HEI $lockedHei */
            $lockedHei = HEI::query()->lockForUpdate()->findOrFail($hei->id);
            $originalUii = $lockedHei->uii;
            $fromRegionId = $lockedHei->region_id;
            $toRegionId = array_key_exists('region_id', $attributes)
                ? $attributes['region_id']
                : $fromRegionId;
            $attributes['region_id'] = $toRegionId;
            $regionChanged = $fromRegionId !== $toRegionId;

            $canTransfer = $actor->hasPermission('transfer_hei_region')
                && ($actor->isSuperAdmin() || $actor->role?->name === 'Admin');

            if ($regionChanged && ! $canTransfer) {
                throw new AuthorizationException('You are not allowed to transfer an HEI to another region.');
            }

            $transfer = null;
            if ($regionChanged) {
                if ($transferData === null) {
                    throw new \InvalidArgumentException('Transfer details are required when changing an HEI region.');
                }

                $toRegion = Region::query()
                    ->whereKey($toRegionId)
                    ->where('status', 'active')
                    ->firstOrFail();
                $fromRegion = $fromRegionId ? Region::find($fromRegionId) : null;

                // Protect legacy rows created before this feature or during a partial rollout.
                if ($fromRegionId !== null) {
                    DB::table('liquidations')
                        ->where('hei_id', $lockedHei->id)
                        ->whereNull('processing_region_id')
                        ->update(['processing_region_id' => $fromRegionId]);
                }

                $transfer = HEIRegionTransfer::create([
                    'hei_id' => $lockedHei->id,
                    'from_region_id' => $fromRegionId,
                    'to_region_id' => $toRegion->id,
                    'effective_date' => $transferData['effective_date'],
                    'memo_reference' => $transferData['memo_reference'] ?? null,
                    'reason' => $transferData['reason'],
                    'transferred_by' => $actor->id,
                ]);

                ActivityLog::log(
                    action: 'transferred_region',
                    description: sprintf(
                        'Transferred %s from %s to %s',
                        $lockedHei->name,
                        $fromRegion?->name ?? 'Unassigned',
                        $toRegion->name,
                    ),
                    subject: $lockedHei,
                    module: 'HEI',
                    oldValues: [
                        'region' => $fromRegion?->name,
                    ],
                    newValues: [
                        'region' => $toRegion->name,
                        'effective_date' => $transferData['effective_date'],
                        'memo_reference' => $transferData['memo_reference'] ?? null,
                        'reason' => $transferData['reason'],
                    ],
                );
            }

            HEI::duringRegionTransfer(fn () => $lockedHei->update($attributes));

            // Accounts belonging to this HEI carry their own region_id, auto-filled
            // from the institution when they were created. Left behind, they keep
            // reporting the old region in User Management, which reads users.region
            // ahead of users.hei.region. One bulk update: an HEI has a handful of
            // users, and the transfer above is already in the activity log.
            if ($regionChanged) {
                User::query()
                    ->where('hei_id', $lockedHei->id)
                    ->update(['region_id' => $toRegionId]);
            }

            $updatedUii = $lockedHei->uii;
            DB::afterCommit(function () use ($originalUii, $updatedUii, $transfer): void {
                Cache::forget('hei_uii_'.strtolower($originalUii));
                Cache::forget('hei_uii_'.strtolower($updatedUii));
                $this->cacheService->clearHEICache($originalUii);
                if ($updatedUii !== $originalUii) {
                    $this->cacheService->clearHEICache($updatedUii);
                }

                if ($transfer !== null) {
                    DashboardCache::flush();
                }
            });

            return $lockedHei->fresh(['region', 'regionTransfers.fromRegion', 'regionTransfers.toRegion', 'regionTransfers.transferredBy']);
        });
    }
}
