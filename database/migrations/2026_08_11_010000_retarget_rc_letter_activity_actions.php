<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * RC letters are uploaded through the same endpoint as requirement documents,
     * so they were logged as plain 'uploaded_document' / 'deleted_document'. The
     * frontend maps the action to a section anchor, which sent an HEI clicking an
     * RC letter notification to the Document Requirements list instead of the
     * RC Letters card.
     *
     * The controller now records 'uploaded_rc_letter' / 'deleted_rc_letter'. This
     * brings existing rows in line so old notifications land in the right place
     * too — only the action changes; wording, timestamp, actor and read state are
     * untouched.
     */
    private const MAPPINGS = [
        ['uploaded_document', 'uploaded_rc_letter', '% for RC Letter in liquidation %'],
        ['deleted_document', 'deleted_rc_letter', '% for RC Letter from liquidation %'],
    ];

    private const TABLES = ['notifications', 'activity_logs'];

    public function up(): void
    {
        // "RC Letter" here is the literal document_type the upload branch writes,
        // never a requirement name — the description pattern is what distinguishes
        // the two. If a document requirement is ever named "RC Letter" this would
        // become ambiguous, so guard against that rather than mislabel real rows.
        if ($this->hasRequirementNamedRcLetter()) {
            return;
        }

        foreach (self::TABLES as $table) {
            foreach (self::MAPPINGS as [$from, $to, $pattern]) {
                DB::table($table)
                    ->where('action', $from)
                    ->where('description', 'like', $pattern)
                    ->update(['action' => $to]);
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            foreach (self::MAPPINGS as [$from, $to]) {
                DB::table($table)->where('action', $to)->update(['action' => $from]);
            }
        }
    }

    private function hasRequirementNamedRcLetter(): bool
    {
        return DB::table('document_requirements')
            ->where('name', 'like', '%RC Letter%')
            ->exists();
    }
};
