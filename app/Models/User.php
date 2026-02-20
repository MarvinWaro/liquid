<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable, HasUuid;

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
        ];
    }

    public function getAvatarUrlAttribute(): ?string
    {
        if (!$this->avatar) {
            return null;
        }

        return '/storage/' . $this->avatar;
    }

    /**
     * Get the role that owns the user.
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
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
     * Check if user has a specific permission.
     */
    public function hasPermission(string $permissionName): bool
    {
        return $this->role && $this->role->hasPermission($permissionName);
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
     * Get navigation abilities for the user.
     * This determines which navigation items the user can see.
     */
    public function getNavigationAbilities(): array
    {
        return [
            'canViewDashboard' => true, // Everyone can see dashboard
            'canViewLiquidation' => $this->hasPermission('view_liquidation'),
            'canViewRoles' => $this->hasPermission('view_roles'),
            'canViewUsers' => $this->hasPermission('view_users'),
            'canViewHEI' => $this->hasPermission('view_hei'),
            'canViewRegions' => $this->hasPermission('view_regions'),
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
