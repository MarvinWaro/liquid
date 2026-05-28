<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Stateless bearer-token auth for the MCP HTTP endpoint.
 *
 * External MCP clients (Claude Desktop, Cursor, etc.) cannot share a Laravel
 * session, so we authenticate via a single shared bearer token and impersonate
 * a configured administrator account for the duration of the request. Compare
 * tokens with hash_equals to defeat timing attacks.
 */
class AuthenticateMcpClient
{
    public function handle(Request $request, Closure $next): Response
    {
        $configuredKey = (string) config('services.mcp.api_key');
        $configuredEmail = (string) config('services.mcp.user_email');

        if ($configuredKey === '' || $configuredEmail === '') {
            return $this->reject(503, 'The MCP endpoint is not configured. Set MCP_API_KEY and MCP_USER_EMAIL.');
        }

        $presented = $this->extractBearer($request);

        if ($presented === null || ! hash_equals($configuredKey, $presented)) {
            return $this->reject(401, 'Invalid or missing bearer token.');
        }

        $user = User::query()
            ->where('email', $configuredEmail)
            ->where('status', 'active')
            ->first();

        if (! $user instanceof User || ! $user->canUseReportAssistant()) {
            return $this->reject(403, 'The configured MCP user cannot access reporting tools.');
        }

        Auth::setUser($user);

        return $next($request);
    }

    private function extractBearer(Request $request): ?string
    {
        $header = (string) $request->header('Authorization', '');

        if (! str_starts_with($header, 'Bearer ')) {
            return null;
        }

        $token = trim(substr($header, 7));

        return $token === '' ? null : $token;
    }

    private function reject(int $status, string $message): JsonResponse
    {
        return new JsonResponse([
            'error' => $message,
        ], $status);
    }
}
