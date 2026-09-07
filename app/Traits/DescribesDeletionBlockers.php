<?php

namespace App\Traits;

use Illuminate\Support\Str;

/**
 * Shared phrasing for "this record is attached to things, do not delete it".
 *
 * The counting itself is per-model, so each user of this trait supplies its own
 * deletionBlockers(). Only the sentence-building is shared - it was written
 * twice otherwise, and the two copies would drift.
 */
trait DescribesDeletionBlockers
{
    /**
     * Records that a hard delete of this row would destroy or orphan.
     *
     * @return array<string, int> Singular label => count, empty when safe to delete.
     */
    abstract public function deletionBlockers(): array;

    /**
     * Human-readable summary of deletionBlockers(), e.g.
     * "40 liquidations and 12 uploaded documents".
     */
    public function describeDeletionBlockers(): string
    {
        $parts = [];
        foreach ($this->deletionBlockers() as $label => $count) {
            $parts[] = $count.' '.Str::plural($label, $count);
        }

        if (count($parts) <= 1) {
            return implode('', $parts);
        }

        $last = array_pop($parts);

        return implode(', ', $parts).' and '.$last;
    }
}
