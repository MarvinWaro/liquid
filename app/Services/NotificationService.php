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
        'created_liquidation',
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
        'mentioned_in_comment',
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
        $liquidation->loadMissing(['hei', 'creator', 'program']);

        // The user who created this liquidation
        if ($liquidation->creator) {
            $recipients->push($liquidation->creator);
        }

        // HEI users tied to this liquidation's institution
        // Skip internal workflow actions (endorsements between RC/Accountant/COA)
        $internalActions = ['endorsed_to_accounting', 'endorsed_to_coa', 'returned_to_rc'];
        if ($liquidation->hei_id && !in_array($action, $internalActions)) {
            $heiUsers = User::whereHas('role', fn ($q) => $q->where('name', 'HEI'))
                ->where('hei_id', $liquidation->hei_id)
                ->where('status', 'active')
                ->get();
            $recipients = $recipients->merge($heiUsers);
        }

        $isSTUFAPSProgram = $liquidation->program && $liquidation->program->parent_id;

        // Regional Coordinators — only for non-STUFAPS liquidations
        // STUFAPS sub-program liquidations are managed by STUFAPS Focals, not RCs
        if (!$isSTUFAPSProgram && $liquidation->hei?->region_id) {
            $rcs = User::whereHas('role', fn ($q) => $q->where('name', 'Regional Coordinator'))
                ->where('region_id', $liquidation->hei->region_id)
                ->where('status', 'active')
                ->get();
            $recipients = $recipients->merge($rcs);
        }

        // STUFAPS Focals assigned to the same program
        if ($isSTUFAPSProgram) {
            $focals = User::whereHas('role', fn ($q) => $q->where('name', 'STUFAPS Focal'))
                ->whereHas('programs', fn ($q) => $q->where('programs.id', $liquidation->program_id))
                ->where('status', 'active')
                ->get();
            $recipients = $recipients->merge($focals);
        }

        // Admins and Super Admins always get notified
        $admins = User::whereHas('role', fn ($q) => $q->whereIn('name', ['Admin', 'Super Admin']))
            ->where('status', 'active')
            ->get();
        $recipients = $recipients->merge($admins);

        // For endorsement actions, also notify accountants and COA
        if (in_array($action, ['endorsed_to_accounting', 'endorsed_to_coa', 'returned_to_rc'])) {
            $accountants = User::whereHas('role', fn ($q) => $q->where('name', 'Accountant'))
                ->where('status', 'active')
                ->get();
            $recipients = $recipients->merge($accountants);
        }

        if ($action === 'endorsed_to_coa') {
            $coaUsers = User::whereHas('role', fn ($q) => $q->where('name', 'COA'))
                ->where('status', 'active')
                ->get();
            $recipients = $recipients->merge($coaUsers);
        }

        return $recipients;
    }

    /**
     * Backfill notifications for a newly created HEI user.
     * Creates notifications for all existing liquidations tied to their HEI
     * so they don't miss events that happened before their account existed.
     */
    public static function backfillForNewHEIUser(User $heiUser): void
    {
        if (!$heiUser->hei_id) {
            return;
        }

        $liquidations = Liquidation::where('hei_id', $heiUser->hei_id)
            ->with('creator')
            ->get();

        if ($liquidations->isEmpty()) {
            return;
        }

        $rows = [];
        foreach ($liquidations as $liquidation) {
            $actor = $liquidation->creator;
            $actorName = $actor?->name ?? 'System';

            $rows[] = [
                'id' => \Illuminate\Support\Str::uuid()->toString(),
                'user_id' => $heiUser->id,
                'actor_id' => $actor?->id,
                'actor_name' => $actorName,
                'action' => 'created_liquidation',
                'description' => 'Created liquidation '.$liquidation->control_no.' for your institution',
                'subject_type' => Liquidation::class,
                'subject_id' => $liquidation->id,
                'subject_label' => $liquidation->control_no,
                'module' => 'Liquidation',
                'created_at' => $liquidation->created_at,
                'updated_at' => now(),
            ];
        }

        Notification::insert($rows);
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
