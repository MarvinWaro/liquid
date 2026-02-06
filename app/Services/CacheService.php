<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DocumentStatus;
use App\Models\HEI;
use App\Models\Program;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Centralized caching service for lookup data.
 */
class CacheService
{
    /**
     * Default cache TTL in seconds (1 hour).
     */
    public const TTL_SHORT = 300;      // 5 minutes
    public const TTL_MEDIUM = 3600;    // 1 hour
    public const TTL_LONG = 86400;     // 24 hours

    /**
     * Get all active semesters (cached).
     */
    public function getSemesters(): Collection
    {
        return Cache::remember('lookup:semesters', self::TTL_LONG, function () {
            return Semester::active()->ordered()->get();
        });
    }

    /**
     * Get semester by code (cached).
     */
    public function getSemesterByCode(string $code): ?Semester
    {
        return $this->getSemesters()->firstWhere('code', strtoupper($code));
    }

    /**
     * Get all active document statuses (cached).
     */
    public function getDocumentStatuses(): Collection
    {
        return Cache::remember('lookup:document_statuses', self::TTL_LONG, function () {
            return DocumentStatus::active()->ordered()->get();
        });
    }

    /**
     * Get document status by code (cached).
     */
    public function getDocumentStatusByCode(string $code): ?DocumentStatus
    {
        return $this->getDocumentStatuses()->firstWhere('code', strtoupper($code));
    }

    /**
     * Get all active programs (cached).
     */
    public function getPrograms(): Collection
    {
        return Cache::remember('lookup:programs', self::TTL_MEDIUM, function () {
            return Program::where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name', 'code']);
        });
    }

    /**
     * Get all active HEIs (cached).
     */
    public function getHEIs(): Collection
    {
        return Cache::remember('lookup:heis', self::TTL_MEDIUM, function () {
            return HEI::where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'uii']);
        });
    }

    /**
     * Get HEI by UII (cached).
     */
    public function getHEIByUII(string $uii): ?HEI
    {
        $cacheKey = 'hei:uii:' . strtolower($uii);

        return Cache::remember($cacheKey, self::TTL_MEDIUM, function () use ($uii) {
            return HEI::where('uii', $uii)->first()
                ?? HEI::whereRaw('LOWER(uii) = ?', [strtolower($uii)])->first();
        });
    }

    /**
     * Get Regional Coordinators (cached).
     */
    public function getRegionalCoordinators(): Collection
    {
        return Cache::remember('users:regional_coordinators', self::TTL_SHORT, function () {
            return User::whereHas('role', function ($q) {
                $q->where('name', 'Regional Coordinator');
            })->where('status', 'active')
              ->orderBy('name')
              ->get(['id', 'name']);
        });
    }

    /**
     * Get Accountants (cached).
     */
    public function getAccountants(): Collection
    {
        return Cache::remember('users:accountants', self::TTL_SHORT, function () {
            return User::whereHas('role', function ($q) {
                $q->where('name', 'Accountant');
            })->where('status', 'active')
              ->orderBy('name')
              ->get(['id', 'name']);
        });
    }

    /**
     * Clear all lookup caches.
     */
    public function clearLookupCaches(): void
    {
        $keys = [
            'lookup:semesters',
            'lookup:document_statuses',
            'lookup:programs',
            'lookup:heis',
            'users:regional_coordinators',
            'users:accountants',
        ];

        foreach ($keys as $key) {
            Cache::forget($key);
        }
    }

    /**
     * Clear HEI-specific cache.
     */
    public function clearHEICache(?string $uii = null): void
    {
        Cache::forget('lookup:heis');

        if ($uii) {
            Cache::forget('hei:uii:' . strtolower($uii));
        }
    }

    /**
     * Clear user-related caches.
     */
    public function clearUserCaches(): void
    {
        Cache::forget('users:regional_coordinators');
        Cache::forget('users:accountants');
    }

    /**
     * Warm up all lookup caches.
     */
    public function warmupCaches(): void
    {
        $this->getSemesters();
        $this->getDocumentStatuses();
        $this->getPrograms();
        $this->getHEIs();
        $this->getRegionalCoordinators();
        $this->getAccountants();
    }
}
