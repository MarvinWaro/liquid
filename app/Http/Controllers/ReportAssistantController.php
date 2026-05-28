<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ReportAssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Throwable;

class ReportAssistantController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        $this->authorizeAssistant($request->user());

        return Inertia::render('report-assistant', [
            'isConfigured' => filled(config('ai.providers.openai.key')),
        ]);
    }

    public function answer(Request $request, ReportAssistantService $assistant): JsonResponse
    {
        $user = $request->user();
        $this->authorizeAssistant($user);

        $validated = $request->validate([
            'messages' => ['required', 'array', 'min:1', 'max:12'],
            'messages.*.role' => ['required', 'in:user,assistant'],
            'messages.*.content' => ['required', 'string', 'max:2000'],
        ]);

        if (! filled(config('ai.providers.openai.key'))) {
            return response()->json([
                'message' => 'The report assistant is not configured. An administrator must set the OpenAI API key.',
            ], 503);
        }

        try {
            return response()->json($assistant->answer($user, $validated['messages']));
        } catch (Throwable $exception) {
            $context = [
                'user_id' => $user->id,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ];

            // Walk the exception chain to find the underlying HTTP error.
            // The SDK wraps RequestException in its own RateLimitedException,
            // so we need the original body to tell apart distinct 429 causes
            // (real rate limit vs insufficient_quota — same status, very
            // different remediation).
            $providerBody = null;
            $providerStatus = null;
            for ($current = $exception; $current !== null; $current = $current->getPrevious()) {
                $context['exception_chain'][] = $current::class.': '.mb_substr($current->getMessage(), 0, 500);

                if ($current instanceof \Illuminate\Http\Client\RequestException) {
                    $providerStatus = $current->response->status();
                    $providerBody = $current->response->body();
                    $context['provider_status'] = $providerStatus;
                    $context['provider_body'] = mb_substr($providerBody, 0, 2000);
                    break;
                }
            }

            Log::warning('Report assistant request failed.', $context);

            $errorCode = null;
            if (is_string($providerBody)) {
                $decoded = json_decode($providerBody, true);
                $errorCode = is_array($decoded) ? ($decoded['error']['code'] ?? null) : null;
            }

            // Distinguish OpenAI's overloaded 429 status:
            //   - insufficient_quota → billing problem, won't resolve by waiting
            //   - rate_limit_exceeded → transient TPM/RPM cap, retry shortly
            if ($errorCode === 'insufficient_quota') {
                return response()->json([
                    'message' => 'The AI provider returned "insufficient quota" — the OpenAI account has no remaining balance. Add a payment method or top up credits at https://platform.openai.com/settings/organization/billing, then try again.',
                ], 402);
            }

            $isRateLimit = $providerStatus === 429
                || $exception instanceof \Laravel\Ai\Exceptions\RateLimitedException;

            if ($isRateLimit) {
                return response()->json([
                    'message' => 'The AI provider hit a rate limit. Please wait a few seconds and try again.',
                ], 429);
            }

            return response()->json([
                'message' => 'The report assistant could not complete this request. Please try again.',
            ], 502);
        }
    }

    private function authorizeAssistant(User $user): void
    {
        abort_unless($user->canUseReportAssistant(), 403, 'Unauthorized action.');
    }
}
