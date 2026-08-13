<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Services\SignedUrlCache;
use App\Traits\HasUuid;
use App\Traits\LogsActivity;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasUuid, LogsActivity, Notifiable, TwoFactorAuthenticatable;

    protected static function getActivityModule(): string
    {
        return 'User Management';
    }

    protected static function getActivityForeignKeys(): array
    {
        return [
            'role_id' => ['role', 'name'],
            'hei_id' => ['hei', 'name'],
            'region_id' => ['region', 'name'],
            'program_id' => ['program', 'name'],
        ];
    }

    protected static function getActivityFieldLabels(): array
    {
        return [
            'role_id' => 'Role',
            'hei_id' => 'HEI',
            'region_id' => 'Region',
            'program_id' => 'Program',
            'name' => 'Name',
            'email' => 'Email',
            'status' => 'Status',
        ];
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'hei_id',
        'region_id',
        'program_id',
        'status',
        'avatar',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected $appends = ['avatar_url'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'last_active_at' => 'datetime',
        ];
    }

    public function getAvatarUrlAttribute(): ?string
    {
        // Cached: a comment thread reads this once per comment, and the same
        // handful of authors write most of them. See SignedUrlCache.
        return SignedUrlCache::get($this->avatar);
    }

    /**
     * Get the role that owns the user.
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Direct per-user permission grants — additive on top of the user's role.
     * Effective permissions = role's permissions ∪ these.
     */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'user_permission')->withTimestamps();
    }

    /**
     * Get the HEI that owns the user (for HEI users).
     */
    public function hei(): BelongsTo
    {
        return $this->belongsTo(HEI::class);
    }

    /**
     * Get the region for this user.
     */
    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    /**
     * Get the primary program assigned to this user (legacy single-program field).
     */
    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    /**
     * Get all programs assigned to this user (many-to-many via pivot).
     */
    public function programs(): BelongsToMany
    {
        return $this->belongsToMany(Program::class, 'user_program')->withTimestamps();
    }

    /**
     * Liquidations this user has pinned to the top of their own table view.
     * Per-user bookmark — does not affect other users or reports.
     */
    public function pinnedLiquidations(): BelongsToMany
    {
        return $this->belongsToMany(Liquidation::class, 'user_liquidation_pins')
            ->withPivot('pinned_at')
            ->orderByPivot('pinned_at', 'desc');
    }

    /**
     * Check if user is a STUFAPS Focal.
     */
    public function isSTUFAPSFocal(): bool
    {
        return $this->role && $this->role->name === 'STUFAPS Focal';
    }

    /**
     * Get all program IDs this user can access (assigned programs + their children).
     * Returns null if user has no program assignments (meaning they see all programs).
     */
    public function getScopedProgramIds(): ?array
    {
        $assignedIds = $this->programs()->pluck('programs.id')->all();

        if (empty($assignedIds)) {
            return null;
        }

        // Include children of each assigned program
        $childIds = Program::whereIn('parent_id', $assignedIds)->pluck('id')->all();

        return array_values(array_unique(array_merge($assignedIds, $childIds)));
    }

    /**
     * Get all program IDs under the same parent as the user's assigned programs.
     * Used for summary views so STUFAPS Focals see consolidated data across all sibling sub-programs.
     */
    public function getParentScopedProgramIds(): ?array
    {
        $assignedIds = $this->programs()->pluck('programs.id')->all();

        if (empty($assignedIds)) {
            return null;
        }

        // Find parent IDs of assigned programs
        $parentIds = Program::whereIn('id', $assignedIds)
            ->whereNotNull('parent_id')
            ->pluck('parent_id')
            ->unique()
            ->all();

        if (empty($parentIds)) {
            // Assigned programs have no parent — fall back to scoped
            return $this->getScopedProgramIds();
        }

        // All children under those parents (all sibling sub-programs)
        $allChildIds = Program::whereIn('parent_id', $parentIds)->pluck('id')->all();

        return array_values(array_unique(array_merge($assignedIds, $allChildIds)));
    }

    /**
     * Check if user has a specific permission.
     */
    public function hasPermission(string $permissionName): bool
    {
        // Granted via the user's role...
        if ($this->role && $this->role->hasPermission($permissionName)) {
            return true;
        }

        // ...or granted directly to this specific user (additive override).
        if ($this->relationLoaded('permissions')) {
            return $this->permissions->contains('name', $permissionName);
        }

        return $this->permissions()->where('name', $permissionName)->exists();
    }

    /**
     * Check if user is admin.
     */
    public function isAdmin(): bool
    {
        return $this->role && $this->role->name === 'Admin';
    }

    /**
     * Check if user is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Check if user can create admins.
     */
    public function canCreateAdmins(): bool
    {
        return $this->hasPermission('create_admins');
    }

    /**
     * Limit the initial report assistant rollout to reporting administrators.
     */
    public function canUseReportAssistant(): bool
    {
        return in_array($this->role?->name, ['Admin', 'Super Admin'], true)
            && $this->hasPermission('view_reports');
    }

    /**
     * Get navigation abilities for the user.
     * This determines which navigation items the user can see.
     */
    public function getNavigationAbilities(): array
    {
        // Ensure permissions are loaded to avoid N+1 queries (many checks below).
        // Includes direct per-user grants so hasPermission() stays query-free.
        $this->loadMissing('role.permissions', 'permissions');

        return [
            'canViewDashboard' => true, // Everyone can see dashboard
            'canViewLiquidation' => $this->hasPermission('view_liquidation'),
            'canViewReports' => $this->hasPermission('view_reports'),
            'canUseReportAssistant' => $this->canUseReportAssistant(),
            'canViewRoles' => $this->hasPermission('view_roles'),
            'canViewUsers' => $this->hasPermission('view_users'),
            'canViewHEI' => $this->hasPermission('view_hei'),
            'canViewRegions' => $this->hasPermission('view_regions'),
            'canViewPrograms' => $this->hasPermission('view_programs'),
            'canViewSemesters' => $this->hasPermission('view_semesters'),
            'canViewAcademicYears' => $this->hasPermission('view_academic_years'),
            'canViewDocumentRequirements' => $this->hasPermission('view_document_requirements'),
            'canViewTemplates' => $this->hasPermission('view_templates'),
            'canViewActivityLogs' => $this->hasPermission('view_activity_logs'),
            'canAccessActivityLogs' => $this->hasPermission('view_activity_logs')
                || $this->hasPermission('view_own_activity_logs'),
            // Deliberately role-based, not permission-based: queue health exposes
            // job payloads and exception messages, so it should not be grantable
            // by editing a role.
            'canViewQueueHealth' => $this->isSuperAdmin(),
            'canViewSummaryAY' => $this->hasPermission('view_summary_ay'),
            'canViewSummaryHEI' => $this->hasPermission('view_summary_hei'),
            'canCreateAnnouncements' => $this->hasPermission('create_announcements'),
            'canEditAnnouncements' => $this->hasPermission('edit_announcements'),
            'canDeleteAnnouncements' => $this->hasPermission('delete_announcements'),
            'canCreateTicket' => $this->hasPermission('create_ticket'),
        ];
    }

    /**
     * Check if user is super admin.
     */
    public function isSuperAdmin(): bool
    {
        return $this->role && $this->role->name === 'Super Admin';
    }

    /**
     * Check if user is regional coordinator.
     */
    public function isRegionalCoordinator(): bool
    {
        return $this->role && $this->role->name === 'Regional Coordinator';
    }

    /**
     * Get the region label for display.
     */
    public function getRegionLabel(): ?string
    {
        return $this->region?->name;
    }
}
