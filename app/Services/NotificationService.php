<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Liquidation;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class NotificationService
{
    /**
     * Actions that are relevant for notifications (skip noisy auto-logged CRUD).
     */
    private const NOTIFIABLE_ACTIONS = [
        'submitted',
        'endorsed_to_accounting',
        'returned_to_hei',
        'endorsed_to_coa',
        'returned_to_rc',
        'uploaded_document',
        'added_gdrive_link',
        'deleted_document',
        'imported_beneficiaries',
        'bulk_imported',
        'toggled_status',
        'updated_tracking',
        'updated_running_data',
    ];

    /**
     * Dispatch notifications based on an activity log entry.
     * Determines recipients based on the action and subject.
     */
    public static function dispatch(
        string $action,
        string $description,
        ?Model $subject = null,
        ?string $module = null,
    ): void {
        if (!in_array($action, self::NOTIFIABLE_ACTIONS)) {
            return;
        }

        $actor = auth()->user();
        if (!$actor) {
            return;
        }

        $recipients = self::resolveRecipients($action, $subject, $actor);

        if ($recipients->isEmpty()) {
            return;
        }

        $subjectType = $subject ? get_class($subject) : null;
        $subjectLabel = $subject ? self::resolveSubjectLabel($subject) : null;

        $rows = $recipients->map(fn (User $user) => [
            'id' => \Illuminate\Support\Str::uuid()->toString(),
            'user_id' => $user->id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'action' => $action,
            'description' => $description,
            'subject_type' => $subjectType,
            'subject_id' => $subject?->id,
            'subject_label' => $subjectLabel,
            'module' => $module,
            'created_at' => now(),
            'updated_at' => now(),
        ])->toArray();

        Notification::insert($rows);
    }

    /**
     * Resolve who should receive the notification.
     */
    private static function resolveRecipients(string $action, ?Model $subject, User $actor): Collection
    {
        $recipients = collect();

        if ($subject instanceof Liquidation) {
            $recipients = self::resolveLiquidationRecipients($action, $subject, $actor);
        }

        // For user-related actions, notify the affected user
        if ($subject instanceof User && $subject->id !== $actor->id) {
            $recipients->push($subject);
        }

        // Always exclude the actor
        return $recipients->filter(fn (User $u) => $u->id !== $actor->id)->unique('id');
    }

    /**
     * Resolve recipients for liquidation-related actions.
     */
    private static function resolveLiquidationRecipients(string $action, Liquidation $liquidation, User $actor): Collection
    {
        $recipients = collect();

        // Load relationships we need
        $liquidation->loadMissing(['hei', 'creator']);

        // The user who created this liquidation
        if ($liquidation->creator) {
            $recipients->push($liquidation->creator);
        }

        // HEI users tied to this liquidation's institution
        if ($liquidation->hei_id) {
            $heiUsers = User::whereHas('role', fn ($q) => $q->where('name', 'HEI'))
                ->where('hei_id', $liquidation->hei_id)
                ->where('status', 'active')
                ->get();
            $recipients = $recipients->merge($heiUsers);
        }

        // Regional Coordinators for the HEI's region
        if ($liquidation->hei?->region_id) {
            $rcs = User::whereHas('role', fn ($q) => $q->where('name', 'Regional Coordinator'))
                ->where('region_id', $liquidation->hei->region_id)
                ->where('status', 'active')
                ->get();
            $recipients = $recipients->merge($rcs);
        }

        // For endorsement actions, also notify accountants
        if (in_array($action, ['endorsed_to_accounting', 'endorsed_to_coa', 'returned_to_rc'])) {
            $accountants = User::whereHas('role', fn ($q) => $q->where('name', 'Accountant'))
                ->where('status', 'active')
                ->get();
            $recipients = $recipients->merge($accountants);
        }

        return $recipients;
    }

    /**
     * Resolve a human-readable label for the subject.
     */
    private static function resolveSubjectLabel(Model $subject): ?string
    {
        foreach (['control_no', 'name', 'email', 'uii', 'code', 'file_name'] as $attr) {
            if (!empty($subject->$attr)) {
                return (string) $subject->$attr;
            }
        }

        return (string) $subject->id;
    }
}
