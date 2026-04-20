<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AcademicYearDocumentRequirement;
use App\Models\ComplianceStatus;
use App\Models\DocumentRequirement;
use App\Models\DocumentStatus;
use App\Models\HEI;
use App\Models\LiquidationStatus;
use App\Models\Program;
use App\Models\ReviewType;
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
     * Get all active programs (cached), with parent info for grouping.
     * Includes parent programs (for grouping labels) and leaf programs (for selection).
     */
    public function getPrograms(): Collection
    {
        return Cache::remember('lookup:programs', self::TTL_MEDIUM, function () {
            return Program::where('status', 'active')
                ->with(['parent:id,code,name', 'dueDateRules:id,program_id,academic_year_id,due_date_days'])
                ->withCount('children')
                ->orderByRaw('COALESCE(parent_id, id), parent_id IS NOT NULL, name')
                ->get(['id', 'parent_id', 'name', 'code']);
        });
    }

    /**
     * Get selectable programs for liquidation forms/filters.
     * Returns leaf programs (no children) plus any parent programs needed for group labels.
     * Frontend uses `is_selectable` to determine which items can be chosen.
     */
    public function getSelectablePrograms(): Collection
    {
        $all = $this->getPrograms();

        // Mark each program as selectable (leaf) or group-only (parent)
        return $all->map(function ($program) {
            $program->is_selectable = ($program->children_count ?? 0) === 0;
            return $program;
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
    public function getRegionalCoordinators(?string $regionId = null): Collection
    {
        $all = Cache::remember('users:regional_coordinators', self::TTL_SHORT, function () {
            return User::whereHas('role', function ($q) {
                $q->where('name', 'Regional Coordinator');
            })->where('status', 'active')
              ->orderBy('name')
              ->get(['id', 'name', 'avatar', 'region_id']);
        });

        if ($regionId) {
            return $all->where('region_id', $regionId)->values();
        }

        return $all;
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
              ->get(['id', 'name', 'avatar']);
        });
    }

    /**
     * Get all active review types (cached for 24 hours — lookup data never changes).
     */
    public function getReviewTypes(): Collection
    {
        return Cache::remember('lookup:review_types', self::TTL_LONG, function () {
            return ReviewType::active()->ordered()->get();
        });
    }

    /**
     * Get all active compliance statuses (cached for 24 hours).
     */
    public function getComplianceStatuses(): Collection
    {
        return Cache::remember('lookup:compliance_statuses', self::TTL_LONG, function () {
            return ComplianceStatus::active()->ordered()->get();
        });
    }

    /**
     * Get all active liquidation statuses (cached for 24 hours).
     */
    public function getLiquidationStatuses(): Collection
    {
        return Cache::remember('lookup:liquidation_statuses', self::TTL_LONG, function () {
            return LiquidationStatus::active()->ordered()->get();
        });
    }

    /**
     * Get active document requirements for a program (cached).
     */
    public function getDocumentRequirements(string $programId): Collection
    {
        return Cache::remember("lookup:document_requirements:{$programId}", self::TTL_LONG, function () use ($programId) {
            return DocumentRequirement::active()
                ->ordered()
                ->forProgram($programId)
                ->get(['id', 'code', 'name', 'description', 'reference_image_path', 'upload_message', 'is_required', 'sort_order']);
        });
    }

    /**
     * Get document requirements for a program scoped to an academic year.
     *
     * If the academic year has custom configuration, those overrides are applied.
     * Otherwise falls back to the global program requirements.
     */
    public function getDocumentRequirementsForAY(string $programId, ?string $academicYearId): Collection
    {
        if (!$academicYearId) {
            return $this->getDocumentRequirements($programId);
        }

        $cacheKey = "lookup:document_requirements:{$programId}:ay:{$academicYearId}";

        return Cache::remember($cacheKey, self::TTL_LONG, function () use ($programId, $academicYearId) {
            // Load global requirements for this program
            $globals = DocumentRequirement::active()
                ->ordered()
                ->forProgram($programId)
                ->get(['id', 'code', 'name', 'description', 'reference_image_path', 'upload_message', 'is_required', 'is_active', 'sort_order']);

            // Load AY-specific overrides for these requirements
            $reqIds = $globals->pluck('id');
            $overrides = AcademicYearDocumentRequirement::where('academic_year_id', $academicYearId)
                ->whereIn('document_requirement_id', $reqIds)
                ->get()
                ->keyBy('document_requirement_id');

            if ($overrides->isEmpty()) {
                return $globals;
            }

            // Merge overrides into global requirements and re-sort
            return $globals
                ->map(function ($req) use ($overrides) {
                    $override = $overrides->get($req->id);
                    if ($override) {
                        $req->is_required = $override->is_required;
                        $req->is_active   = $override->is_active;
                        $req->sort_order  = $override->sort_order;
                    }
                    return $req;
                })
                ->filter(fn ($req) => $req->is_active)
                ->sortBy('sort_order')
                ->values();
        });
    }

    /**
     * Clear all cached requirement entries for a given academic year.
     */
    public function clearAYRequirementCache(string $academicYearId): void
    {
        // Clear program-scoped AY caches for all programs
        $programIds = Program::where('status', 'active')->pluck('id');
        foreach ($programIds as $programId) {
            Cache::forget("lookup:document_requirements:{$programId}:ay:{$academicYearId}");
        }
    }

    /**
     * Clear all cached requirement entries for a given program (base + all AY-scoped).
     */
    public function clearProgramRequirementCache(string $programId): void
    {
        Cache::forget("lookup:document_requirements:{$programId}");

        // Clear AY-scoped caches for this program
        $academicYearIds = \App\Models\AcademicYear::pluck('id');
        foreach ($academicYearIds as $ayId) {
            Cache::forget("lookup:document_requirements:{$programId}:ay:{$ayId}");
        }
    }

    /**
     * Clear all lookup caches.
     */
    public function clearLookupCaches(): void
    {
        $keys = [
            'lookup:semesters',
            'lookup:academic_years',
            'lookup:document_statuses',
            'lookup:programs',
            'lookup:heis',
            'lookup:review_types',
            'lookup:compliance_statuses',
            'lookup:liquidation_statuses',
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
        $this->getReviewTypes();
        $this->getComplianceStatuses();
        $this->getLiquidationStatuses();
    }
}
