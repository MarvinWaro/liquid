<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Resolution remarks were only ever written into the ticket thread as a
     * "Resolution note: ..." message, so the ticket itself had no idea how it
     * had been resolved — the outcome could not be shown beside "Resolved by X
     * on Y" without scrolling the conversation.
     *
     * The thread message stays as history. This column is current state, the
     * same distinction resolved_at and resolved_by already follow.
     */
    public function up(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->text('resolution_remarks')->nullable()->after('resolved_by');
        });

        $this->backfillFromThreadMessages();
    }

    public function down(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->dropColumn('resolution_remarks');
        });
    }

    /**
     * Recover remarks for tickets resolved before this column existed, so the
     * banner is not blank for every historical ticket.
     *
     * Only the newest "Resolution note: " message written by the resolver is
     * used, which is exactly what updateStatus() creates. Anything that does not
     * match that shape is left alone rather than guessed at.
     */
    private function backfillFromThreadMessages(): void
    {
        $prefix = 'Resolution note: ';

        DB::table('support_tickets')
            ->whereNotNull('resolved_at')
            ->whereNotNull('resolved_by')
            ->orderBy('id')
            ->chunkById(200, function ($tickets) use ($prefix) {
                foreach ($tickets as $ticket) {
                    $note = DB::table('support_ticket_messages')
                        ->where('support_ticket_id', $ticket->id)
                        ->where('user_id', $ticket->resolved_by)
                        ->where('body', 'like', $prefix.'%')
                        ->orderByDesc('created_at')
                        ->value('body');

                    if ($note === null) {
                        continue;
                    }

                    DB::table('support_tickets')
                        ->where('id', $ticket->id)
                        ->update(['resolution_remarks' => substr($note, strlen($prefix))]);
                }
            });
    }
};
