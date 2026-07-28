<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Log;

class ImportBatch extends Model
{
    use HasUuid;

    /** Queued and still inserting rows. imported_count is the live progress. */
    public const STATUS_PROCESSING = 'processing';

    /** Import finished; rows exist and the batch can be undone or downloaded. */
    public const STATUS_ACTIVE = 'active';

    /** Rows were rolled back via the undo action. */
    public const STATUS_UNDONE = 'undone';

    /** The job threw. See failed_reason. */
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'user_id',
        'file_name',
        'file_path',
        'file_size',
        'total_rows',
        'imported_count',
        'status',
        'failed_reason',
        'undone_at',
    ];

    protected function casts(): array
    {
        return [
            'total_rows' => 'integer',
            'imported_count' => 'integer',
            'file_size' => 'integer',
            'undone_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function liquidations(): HasMany
    {
        return $this->hasMany(Liquidation::class, 'import_batch_id');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isUndone(): bool
    {
        return $this->status === self::STATUS_UNDONE;
    }

    public function isProcessing(): bool
    {
        return $this->status === self::STATUS_PROCESSING;
    }

    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    /**
     * Whole-number insert progress for the client poll.
     *
     * Reports honestly, including 100 once every row is in but the batch has not
     * closed out yet. That last window is real — the job still has bookkeeping to
     * do — so the client distinguishes "finalising" from "finished" via `done`,
     * never by the number. An earlier version capped this at 99 to stop the bar
     * claiming 100 too early, which only produced "4,334 of 4,334 · 99%".
     */
    public function progressPercent(): int
    {
        if (! $this->isProcessing()) {
            return 100;
        }

        if ($this->total_rows < 1) {
            return 0;
        }

        return (int) min(100, floor(($this->imported_count / $this->total_rows) * 100));
    }

    /**
     * A batch is presumed abandoned after this long without its row count moving.
     *
     * The worker bumps imported_count after every chunk, and the closing phase is
     * one update plus a notification insert — sub-second in practice — so half a
     * minute of silence is already a wide margin.
     */
    private const STALL_THRESHOLD_SECONDS = 30;

    /**
     * Close out a batch whose worker died without finishing the bookkeeping.
     *
     * Without this a batch can sit in `processing` forever — blocking undo, blocking
     * the next import, and leaving the client polling an end that never comes. The
     * worker can vanish for reasons the job's own error handling can never catch:
     * the process being killed, OOM, a deploy mid-import, or stale code that breaks
     * the job's failure handler too.
     *
     * Called on read (progress polls, history listing) so recovery needs no cron.
     * Returns true when the status was changed.
     */
    public function reconcileIfStalled(): bool
    {
        if (! $this->isProcessing()) {
            return false;
        }

        if ($this->updated_at->diffInSeconds(now()) < self::STALL_THRESHOLD_SECONDS) {
            return false;
        }

        // Every row the batch promised is in the database — only the closing
        // status write was lost, so completing it here is accurate, not a guess.
        if ($this->total_rows > 0 && $this->imported_count >= $this->total_rows) {
            $this->update([
                'status' => self::STATUS_ACTIVE,
                'failed_reason' => null,
            ]);

            Log::info('Recovered a stalled import batch that had finished inserting.', [
                'batch_id' => $this->id,
                'rows' => $this->imported_count,
            ]);

            return true;
        }

        $this->update([
            'status' => self::STATUS_FAILED,
            'failed_reason' => "The import stopped unexpectedly after {$this->imported_count} of {$this->total_rows} row(s). Those records were saved — undo this batch to roll them back, then re-import.",
        ]);

        Log::warning('Marked a stalled import batch as failed.', [
            'batch_id' => $this->id,
            'imported' => $this->imported_count,
            'total' => $this->total_rows,
        ]);

        return true;
    }
}
