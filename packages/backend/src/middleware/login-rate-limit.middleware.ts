/**
 * Login Rate Limit Middleware
 * Requirements: 1.6
 *
 * Middleware to check and enforce login rate limits
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { checkLoginAllowed, recordFailedAttempt, clearFailedAttempts } from '../services/rate-limiter.service.js';

/**
 * Extracts the identifier for rate limiting (email from body or IP)
 */
function getIdentifier(request: FastifyRequest): string {
  const body = request.body as { email?: string } | undefined;
  // Prefer email for account-based lockout, fall back to IP
  return body?.email?.toLowerCase() || request.ip;
}

/**
 * Pre-handler middleware to check if login is allowed
 * Returns 429 if account is locked
 */
export async function loginRateLimitPreHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const identifier = getIdentifier(request);
  const result = await checkLoginAllowed(identifier);

  if (!result.allowed) {
    return reply.status(429).send({
      error: {
        code: 'AUTH_003',
        message: result.error || 'Too many failed login attempts',
        details: {
          lockedUntil: result.lockedUntil?.toISOString(),
          retryAfter: result.lockedUntil
            ? Math.ceil((result.lockedUntil.getTime() - Date.now()) / 1000)
            : undefined,
        },
        requestId: request.id,
      },
    });
  }

  // Store identifier for use in response handler
  (request as any).rateLimitIdentifier = identifier;
}


/**
 * Records a failed login attempt
 * Call this when authentication fails
 */
export async function recordLoginFailure(request: FastifyRequest): Promise<{
  remainingAttempts: number;
  lockedUntil?: Date;
}> {
  const identifier = (request as any).rateLimitIdentifier || getIdentifier(request);
  const result = await recordFailedAttempt(identifier);

  return {
    remainingAttempts: result.remainingAttempts,
    lockedUntil: result.lockedUntil,
  };
}

/**
 * Clears failed attempts on successful login
 * Call this when authentication succeeds
 */
export async function clearLoginFailures(request: FastifyRequest): Promise<void> {
  const identifier = (request as any).rateLimitIdentifier || getIdentifier(request);
  await clearFailedAttempts(identifier);
}

/**
 * Helper to add rate limit info to error response
 */
export function formatRateLimitError(
  remainingAttempts: number,
  lockedUntil?: Date
): {
  remainingAttempts: number;
  lockedUntil?: string;
  retryAfter?: number;
} {
  return {
    remainingAttempts,
    lockedUntil: lockedUntil?.toISOString(),
    retryAfter: lockedUntil
      ? Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)
      : undefined,
  };
}
