<?php

declare(strict_types=1);

namespace App\Services;

use App\AI\Sdk\DomainToolAdapter;
use App\AI\ToolRegistry;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use JsonException;
use Laravel\Ai\AnonymousAgent;
use Laravel\Ai\Messages\AssistantMessage;
use Laravel\Ai\Messages\UserMessage;
use Laravel\Ai\Responses\AgentResponse;
use RuntimeException;

/**
 * Coordinates the model/tool loop for the internal report assistant.
 *
 * Built on the Laravel AI SDK's AnonymousAgent — the SDK handles the
 * provider HTTP, the tool-call loop, and tool result collection. We focus
 * on (1) wiring our domain tools as SDK tools via DomainToolAdapter,
 * (2) translating the SDK response into our { answer, data, followups,
 * compact } shape, and (3) post-processing the model's #COMPACT# /
 * #FOLLOWUPS# markers.
 */
class ReportAssistantService
{
    public function __construct(private readonly ToolRegistry $tools) {}

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @return array{answer: string, data: array<int, array{tool: string, arguments: array<string, mixed>, result: array<string, mixed>}>, followups: array<int, string>, compact: bool}
     */
    public function answer(User $user, array $messages): array
    {
        if ($messages === []) {
            throw new RuntimeException('No messages were provided.');
        }

        $latest = end($messages);
        if (! is_array($latest) || ($latest['role'] ?? null) !== 'user') {
            throw new RuntimeException('The last message must come from the user.');
        }

        $history = array_slice($messages, 0, -1);
        $prompt = (string) ($latest['content'] ?? '');

        $agent = new AnonymousAgent(
            instructions: $this->instructions(),
            messages: $this->buildHistory($history),
            tools: $this->buildTools($user),
        );

        $response = $agent->prompt(
            prompt: $prompt,
            provider: (string) config('ai.default', 'openai'),
            model: $this->resolveModel(),
            timeout: (int) config('services.report_assistant.timeout', 45),
        );

        [$answer, $followups, $compact] = $this->parseModelReply($response->text);

        $toolResults = $this->collectToolResults($response);

        // Safety net: even if the model misjudged and emitted #COMPACT#,
        // force the structured display when we know the table is essential
        // (multi-row breakdown with no unmatched filters).
        if ($compact && $this->shouldForceShowTable($toolResults)) {
            $compact = false;
        }

        // User-stated preference ALWAYS wins. If the user said "no graph" /
        // "text only" / "no chart" / etc., honor that even if the LLM forgot
        // to emit #COMPACT# and even if shouldForceShowTable would otherwise
        // unhide the card. Their explicit intent overrides our defaults.
        if ($this->userRequestedCompact($prompt)) {
            $compact = true;
        }

        $this->logSuccess($user, $response, $toolResults, $compact, $followups);

        return [
            'answer' => $answer,
            'data' => $toolResults,
            'followups' => $followups,
            'compact' => $compact,
        ];
    }

    /**
     * Emit a single structured INFO-level log per successful request. Powers
     * usage analytics, cost reconciliation against the OpenAI bill, and
     * "who asked the assistant X last week" audit queries. No prompt text or
     * answer text is logged — only metadata, since the prompts contain
     * admin-level queries on financial data.
     *
     * @param  array<int, array{tool: string, arguments: array<string, mixed>, result: array<string, mixed>}>  $toolResults
     * @param  array<int, string>  $followups
     */
    private function logSuccess(
        User $user,
        AgentResponse $response,
        array $toolResults,
        bool $compact,
        array $followups,
    ): void {
        $usage = $response->usage;
        $totalTokens = $usage->promptTokens
            + $usage->completionTokens
            + $usage->reasoningTokens;

        Log::info('Report assistant request handled.', [
            'user_id' => $user->id,
            'role' => $user->role?->name,
            'tools_called' => array_column($toolResults, 'tool'),
            'tool_call_count' => count($toolResults),
            'prompt_tokens' => $usage->promptTokens,
            'completion_tokens' => $usage->completionTokens,
            'reasoning_tokens' => $usage->reasoningTokens,
            'total_tokens' => $totalTokens,
            'compact' => $compact,
            'followups_count' => count($followups),
            'model' => $response->meta->model,
            'provider' => $response->meta->provider,
        ]);
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     * @return array<int, UserMessage|AssistantMessage>
     */
    private function buildHistory(array $history): array
    {
        $messages = [];
        foreach ($history as $entry) {
            $role = $entry['role'] ?? null;
            $content = (string) ($entry['content'] ?? '');

            if ($role === 'user') {
                $messages[] = new UserMessage($content);
            } elseif ($role === 'assistant') {
                $messages[] = new AssistantMessage($content);
            }
        }

        return $messages;
    }

    /**
     * @return array<int, DomainToolAdapter>
     */
    private function buildTools(User $user): array
    {
        $adapters = [];
        foreach ($this->tools->all() as $domain) {
            $adapters[] = new DomainToolAdapter($domain, $user);
        }

        return $adapters;
    }

    /**
     * @return array<int, array{tool: string, arguments: array<string, mixed>, result: array<string, mixed>}>
     */
    private function collectToolResults(AgentResponse $response): array
    {
        $output = [];

        foreach ($response->toolResults as $toolResult) {
            $decoded = null;
            if (is_string($toolResult->result)) {
                try {
                    $decoded = json_decode($toolResult->result, true, flags: JSON_THROW_ON_ERROR);
                } catch (JsonException) {
                    $decoded = null;
                }
            } elseif (is_array($toolResult->result)) {
                $decoded = $toolResult->result;
            }

            $output[] = [
                'tool' => (string) $toolResult->name,
                'arguments' => is_array($toolResult->arguments) ? $toolResult->arguments : [],
                'result' => is_array($decoded) ? $decoded : ['raw' => $toolResult->result],
            ];
        }

        return $output;
    }

    /**
     * Resolve the model name. We honor a project-specific env override first
     * (back-compat with prior versions of this service) and fall back to the
     * SDK's per-provider default if unset.
     */
    private function resolveModel(): ?string
    {
        $configured = config('services.report_assistant.model');
        if (is_string($configured) && $configured !== '') {
            return $configured;
        }

        return null;
    }

    /**
     * Detect explicit "hide the visualization" intent in the user's latest
     * message. Recognized phrasings:
     *   - "no graph" / "no chart" / "no table" / "no visual" / "no figure"
     *   - "text only" / "just text"
     *   - "just the number" / "just the count" / "just a number" / "just a count"
     *   - "hide the graph/chart/table"
     *   - "compact" / "compact answer" / "compact reply" / "simple answer"
     *
     * Case-insensitive; matches on word boundaries to avoid false positives
     * like "telegraph" matching "graph".
     */
    private function userRequestedCompact(string $prompt): bool
    {
        return preg_match(
            '/\b(no\s+(graph|chart|table|visual|figure)s?|text\s+only|just\s+(text|a\s+)?(number|count|the\s+(number|count))|hide\s+(the\s+)?(graph|chart|table|visual)|compact(\s+(answer|reply))?|simple\s+answer)\b/i',
            $prompt,
        ) === 1;
    }

    /**
     * Override the LLM's compact flag in cases where we can prove the table
     * is essential: any get_liquidation_summary call that returned 2+
     * breakdown rows and had no unmatched filters.
     *
     * @param  array<int, array{tool: string, arguments: array<string, mixed>, result: array<string, mixed>}>  $toolResults
     */
    private function shouldForceShowTable(array $toolResults): bool
    {
        foreach ($toolResults as $entry) {
            if ($entry['tool'] !== 'get_liquidation_summary') {
                continue;
            }

            $result = $entry['result'];
            $breakdown = is_array($result['breakdown'] ?? null) ? $result['breakdown'] : [];
            $unmatched = is_array($result['unmatched_filters'] ?? null) ? $result['unmatched_filters'] : [];

            if (count($breakdown) >= 2 && $unmatched === []) {
                return true;
            }
        }

        return false;
    }

    /**
     * Parse the LLM's reply into:
     *  - the visible answer
     *  - the follow-up questions (after #FOLLOWUPS#)
     *  - whether the structured data card should be hidden (#COMPACT#)
     *
     * @return array{0: string, 1: array<int, string>, 2: bool}
     */
    private function parseModelReply(string $raw): array
    {
        $followups = [];

        if (str_contains($raw, '###FOLLOWUPS###')) {
            [$raw, $tail] = explode('###FOLLOWUPS###', $raw, 2);

            foreach (preg_split('/\R/', trim($tail)) ?: [] as $line) {
                $cleaned = trim(preg_replace('/^[-*\d.\s]+/', '', trim($line)) ?? '');
                if ($cleaned === '' || mb_strlen($cleaned) > 160) {
                    continue;
                }
                $followups[] = $cleaned;
                if (count($followups) >= 4) {
                    break;
                }
            }
        }

        $compact = false;
        if (str_contains($raw, '###COMPACT###')) {
            $compact = true;
            $raw = str_replace('###COMPACT###', '', $raw);
        }

        return [trim($raw), $followups, $compact];
    }

    private function instructions(): string
    {
        return <<<'PROMPT'
You are the internal Liquidation Report Assistant for UniFAST administrators.

Your scope is strictly limited to reporting on liquidation data returned by the provided tools.

DOMAIN KNOWLEDGE — read carefully:
- "UniFAST" is the umbrella program family (Unified Student Financial Assistance System), comprising TES and TDP programs. If a user filters by "UniFAST", "Unifast", or "UFAST", treat it as programs: ["TES", "TDP"] — do NOT pass "Unifast" as a literal program filter (it does not exist as a code).
- "STuFAPs" / "STUFAPS" refers to the non-UniFAST programs (CMSP, ACEF, CHED TDP variants, SIDA-SGP, etc.). Pass through to the tool only when the user explicitly named one of those program codes.
- All other program filters must match an exact program code or name. If unsure, do NOT guess — return the user's value verbatim to the tool and respond to whatever the tool says.

Tool routing — pick exactly one tool per question, then answer:
- "Summarize / total / breakdown / ranking / trend" → get_liquidation_summary. If the user did not name a filter, pass empty arrays for all filter parameters.
- "List / which / show me specific records" → list_liquidations.
- An explicit control number → find_liquidation.
- "How many HEIs / which HEI is named X / list HEIs in region Y" → list_heis.
- list_reference_data is a LAST RESORT. Only call it when a previous tool result returned the value under "unmatched_filters" and you need to map it to a valid code. Do NOT call list_reference_data for generic questions.

CHOOSING order_by FOR get_liquidation_summary (per-HEI / per-group totals):
- Default (largest disbursements first) → use disbursed_desc OR omit the field.
- "Top N completed / fully liquidated / best performing / highest completion rate" → liquidation_percentage_desc.
- "Lagging / lowest completion / worst performing / needs attention" → liquidation_percentage_asc.
- "Largest outstanding / biggest unliquidated balance" (per HEI/group total) → unliquidated_desc.
- "Most records / most submissions" → records_desc.
- "Most grantees / most beneficiaries" → grantees_desc.
The breakdown returns up to 50 rows.

CHOOSING order_by FOR list_liquidations (per-record):
- Default (alphabetical control number) → use control_no_asc OR omit the field.
- "Records / liquidations with largest outstanding balance" → unliquidated_desc.
- "Largest single disbursement" → disbursed_desc.
- "Largest single liquidated amount" → liquidated_desc.
- "Most recent submissions" → date_submitted_desc.

AGGREGATION GRANULARITY — pick carefully:
- "Which HEIs have the most X" → get_liquidation_summary (HEI-aggregate totals across all that HEI's records).
- "Which liquidations / records / ledgers have the most X" → list_liquidations (one row per liquidation, no HEI aggregation).
These give different rankings: an HEI with many small records may have a larger TOTAL than an HEI whose biggest single record is the largest in the system.

STATUS FILTERS — match the question's intent:
- "Outstanding / unliquidated balance / who still owes / not yet liquidated" → pass liquidation_statuses: ["UNLIQUIDATED", "PARTIALLY_LIQUIDATED"]. Fully Liquidated records contribute ₱0 to the outstanding balance — including them inflates the record count without changing the sum, which is misleading.
- "Fully liquidated / completed / paid off / closed out" → pass liquidation_statuses: ["FULLY_LIQUIDATED"].
- "Partially liquidated / in progress / still being processed" → pass liquidation_statuses: ["PARTIALLY_LIQUIDATED"].
- "Total disbursed / how much money went out / received" → no liquidation_statuses filter; all non-voided records count.
- "Voided / cancelled" → pass liquidation_statuses: ["VOIDED"] to explicitly opt them in.
When in doubt about whether to filter, prefer NOT filtering for neutral count questions and DO filter for "outstanding / completed / in progress" questions where the status is the semantic core of what's being asked.

UNMATCHED FILTERS — only narrate when actually present:
- Check the tool result's "unmatched_filters" field.
- If it is EMPTY OR MISSING (because the user did not supply any filters, or all filters matched): do NOT mention filters at all. Do NOT write phrases like "no filters were applied" or "the system did not recognize any filters" — that is noise, not information.
- If it is NON-EMPTY: your FIRST sentence must clearly state which value(s) the system did not recognize, then emit ###COMPACT### (see below). Example: "The system did not recognize 'Unifast' as a program code — UniFAST covers TES and TDP. Try filtering by TES or TDP instead."

How to compose your reply:
- Keep your reply concise: 1–3 sentences of analysis.
- Address what the user actually asked. "Trend by X" / "comparison" / "breakdown" questions are about the values across categories — speak to which category leads, which lags, and any obvious gap. Do NOT pivot to record counts when the user asked about amounts or percentages.
- You MAY quote integer counts (records, grantees, total_matching, HEI counts) from the tool result directly in your prose. These are single integers and safe to mention. Example: "Region 12 has 155 HEIs and BARMM has 22 HEIs."
- You MAY quote category names directly from the breakdown: HEI names, program codes, region names, academic year labels, status names. These are strings, not figures — low transcription risk. Example: "Notre Dame of Marbel University, Korbel Foundation College, and I-Link College have all reached 100% liquidation."
- You MUST NOT quote currency amounts (₱), percentages, dates, or control numbers in prose. The table renders these accurately; restating them risks transcription errors. Reference them qualitatively ("the largest", "roughly a third").
- When the user asks "top N by X" or "which Y has completed / leads / lags": call the tool with the matching order_by, then read the FIRST N breakdown rows and quote their labels by name. Do NOT claim a result is empty without scanning the breakdown.
- Do NOT produce bullet lists or tables of figures yourself. Even if the user asks for "bullet form" or "in a table", reply with prose — the UI already renders the structured data.
- If a tool returned zero records (and no unmatched filter caused it), say so plainly in one sentence.

COMPACT MODE — strict allow-list:
- Append ###COMPACT### on its own line at the end of your reply ONLY in these cases:
  1. The user asked a count/yes-no/lookup question best answered with one or two integers ("how many HEIs", "is there a record for X").
  2. find_liquidation returned found=false.
  3. unmatched_filters is non-empty (table is empty/uninformative).
  4. The tool returned zero records (no breakdown rows to show).
  5. The user explicitly asked for a textual / non-visual response — phrases like "text only", "no graph", "no chart", "no table", "just the number", "compact", "simple answer", or similar. Honor this regardless of the answer's complexity; the user has the final say on rendering.
- NEVER append ###COMPACT### for:
  - Breakdown questions (by program, by AY, by region, by HEI, by status, etc.)
  - Trend, ranking, comparison, or "which is highest/lowest" questions.
  - Any get_liquidation_summary call that returned 2 or more breakdown rows.
- When in doubt, OMIT the marker — defaulting to showing the table is always safer than hiding informative data.

After your insight (and optional ###COMPACT### line), emit a follow-up block in EXACTLY this format:
###FOLLOWUPS###
- <short suggested next question, under 80 characters>
- <short suggested next question>
- <short suggested next question>

Follow-up rules:
- Always emit the block, even if the answer was "no records" (suggest broadening filters).
- 2 to 3 questions. Each must be specific to liquidation reporting AND grounded in the current result.
- No quotation marks. No numbering. Just hyphen + space + question.
- The block is stripped from the visible reply by the application — do not reference it in your prose.

Hard rules:
- Make at most one tool call per user question unless an earlier result genuinely requires a follow-up (e.g. unmatched filter).
- Never invent values, records, names, codes, or counts.
- Read-only assistant: never claim to edit, approve, endorse, upload, delete, or export a record.
- For questions outside liquidation reporting, explain that this assistant only analyzes liquidation reporting data.
PROMPT;
    }
}
