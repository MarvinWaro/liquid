<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Support\Str;

trait LogsActivity
{
    /**
     * Flag to enable/disable auto-logging.
     * Set to false before bulk operations to prevent excessive log entries.
     */
    public static bool $loggingEnabled = true;

    protected static function bootLogsActivity(): void
    {
        static::created(function ($model) {
            if (! static::$loggingEnabled) {
                return;
            }
            if ($model instanceof ActivityLog) {
                return;
            }

            ActivityLog::log(
                action: 'created',
                description: 'Created '.static::getActivityModelLabel().' '.static::resolveActivityLabel($model),
                subject: $model,
                module: static::getActivityModule(),
            );
        });

        static::updated(function ($model) {
            if (! static::$loggingEnabled) {
                return;
            }
            if ($model instanceof ActivityLog) {
                return;
            }

            $changes = $model->getChanges();
            $original = collect($model->getOriginal())
                ->only(array_keys($changes))
                ->except(['updated_at'])
                ->toArray();
            $new = collect($changes)->except(['updated_at'])->toArray();

            // Skip if only updated_at changed
            if (empty($new)) {
                return;
            }

            // Filter out sensitive fields
            $sensitiveFields = ['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'];
            $original = collect($original)->except($sensitiveFields)->toArray();
            $new = collect($new)->except($sensitiveFields)->toArray();

            // Transform to human-readable field names and values
            [$original, $new] = static::transformActivityValues($model, $original, $new);

            ActivityLog::log(
                action: 'updated',
                description: 'Updated '.static::getActivityModelLabel().' '.static::resolveActivityLabel($model),
                subject: $model,
                module: static::getActivityModule(),
                oldValues: $original ?: null,
                newValues: $new ?: null,
            );
        });

        static::deleted(function ($model) {
            if (! static::$loggingEnabled) {
                return;
            }
            if ($model instanceof ActivityLog) {
                return;
            }

            ActivityLog::log(
                action: 'deleted',
                description: 'Deleted '.static::getActivityModelLabel().' '.static::resolveActivityLabel($model),
                subject: $model,
                module: static::getActivityModule(),
            );
        });
    }

    /**
     * Get the human-readable model name for log messages.
     */
    protected static function getActivityModelLabel(): string
    {
        return str_replace('_', ' ', Str::snake(class_basename(static::class)));
    }

    /**
     * Get the module name for grouping in the logs.
     */
    protected static function getActivityModule(): string
    {
        return class_basename(static::class);
    }

    /**
     * Resolve a label for the model instance.
     */
    private static function resolveActivityLabel($model): string
    {
        foreach (['control_no', 'name', 'email', 'uii', 'code', 'file_name'] as $attr) {
            if (! empty($model->$attr)) {
                return (string) $model->$attr;
            }
        }

        return (string) $model->id;
    }

    /**
     * Define FK fields that should be resolved to readable names.
     * Override in models to map foreign key columns to [RelationshipName, DisplayAttribute].
     *
     * Example: ['role_id' => ['role', 'name']]
     * This means: resolve role_id UUID by loading $model->role->name
     */
    protected static function getActivityForeignKeys(): array
    {
        return [];
    }

    /**
     * Define friendly field labels for the change diff.
     * Override in models to rename raw DB columns to human-readable names.
     *
     * Example: ['hei_id' => 'HEI', 'program_id' => 'Program']
     */
    protected static function getActivityFieldLabels(): array
    {
        return [];
    }

    /**
     * Fields to exclude from the change diff entirely.
     * Override in models to hide noisy internal fields.
     */
    protected static function getActivityHiddenFields(): array
    {
        return [];
    }

    /**
     * Transform old/new values to human-readable field names and values.
     */
    private static function transformActivityValues($model, array $old, array $new): array
    {
        $fkMap = static::getActivityForeignKeys();
        $labels = static::getActivityFieldLabels();
        $hidden = static::getActivityHiddenFields();

        // Remove hidden fields
        $old = collect($old)->except($hidden)->toArray();
        $new = collect($new)->except($hidden)->toArray();

        $transformedOld = [];
        $transformedNew = [];

        foreach ($new as $field => $newValue) {
            $oldValue = $old[$field] ?? null;
            $label = $labels[$field] ?? Str::headline(str_replace('_id', '', $field));

            // Resolve FK UUIDs to display names
            if (isset($fkMap[$field])) {
                [$relation, $displayAttr] = $fkMap[$field];
                $relatedModel = $model->$relation()->getRelated();

                if ($oldValue) {
                    $oldRecord = $relatedModel->find($oldValue);
                    $oldValue = $oldRecord ? $oldRecord->$displayAttr : $oldValue;
                }
                if ($newValue) {
                    $newRecord = $relatedModel->find($newValue);
                    $newValue = $newRecord ? $newRecord->$displayAttr : $newValue;
                }
            }

            $transformedOld[$label] = $oldValue;
            $transformedNew[$label] = $newValue;
        }

        return [$transformedOld, $transformedNew];
    }
}
