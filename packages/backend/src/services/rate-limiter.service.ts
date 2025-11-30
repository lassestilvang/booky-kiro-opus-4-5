/**
 * Rate Limiter Service - Login attempt rate limiting with Redis
 * Requirements: 1.6
 *
 * Implements account lockout after 5 failed attempts within 15 minutes
 */
import { redis } from '../db/redis.js';

// Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes lockout

// Redis key prefixes
const FAILED_ATTEMPTS_PREFIX = 'auth:failed:';
const LOCKOUT_PREFIX = 'auth:lockout:';

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil?: Date;
  error?: string;
}

/**
 * Generates Redis key for failed attempts counter
 */
function getFailedAttemptsKey(identifier: string): string {
  return `${FAILED_ATTEMPTS_PREFIX}${identifier}`;
}

/**
 * Generates Redis key for lockout status
 */
function getLockoutKey(identifier: string): string {
  return `${LOCKOUT_PREFIX}${identifier}`;
}

/**
 * Checks if a login attempt is allowed for the given identifier (email or IP)
 * Requirements: 1.6
 */
export async function checkLoginAllowed(identifier: string): Promise<RateLimitResult> {
  const lockoutKey = getLockoutKey(identifier);
  const failedKey = getFailedAttemptsKey(identifier);

  // Check if account is locked
  const lockoutTTL = await redis.ttl(lockoutKey);
  if (lockoutTTL > 0) {
    const lockedUntil = new Date(Date.now() + lockoutTTL * 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil,
      error: 'Account temporarily locked due to too many failed attempts',
    };
  }

  // Get current failed attempts count
  const failedAttempts = await redis.get(failedKey);
  const currentAttempts = failedAttempts ? parseInt(failedAttempts, 10) : 0;
  const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - currentAttempts);

  return {
    allowed: true,
    remainingAttempts,
  };
}


/**
 * Records a failed login attempt
 * Locks the account if max attempts exceeded
 * Requirements: 1.6
 */
export async function recordFailedAttempt(identifier: string): Promise<RateLimitResult> {
  const lockoutKey = getLockoutKey(identifier);
  const failedKey = getFailedAttemptsKey(identifier);

  // Increment failed attempts counter
  const newCount = await redis.incr(failedKey);

  // Set expiry on first attempt
  if (newCount === 1) {
    await redis.expire(failedKey, LOCKOUT_WINDOW_SECONDS);
  }

  // Check if we should lock the account
  if (newCount >= MAX_FAILED_ATTEMPTS) {
    // Lock the account
    await redis.setex(lockoutKey, LOCKOUT_DURATION_SECONDS, '1');

    // Clear the failed attempts counter
    await redis.del(failedKey);

    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_SECONDS * 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil,
      error: 'Account temporarily locked due to too many failed attempts',
    };
  }

  const remainingAttempts = MAX_FAILED_ATTEMPTS - newCount;
  return {
    allowed: true,
    remainingAttempts,
  };
}

/**
 * Clears failed attempts on successful login
 */
export async function clearFailedAttempts(identifier: string): Promise<void> {
  const failedKey = getFailedAttemptsKey(identifier);
  await redis.del(failedKey);
}

/**
 * Manually unlocks an account (for admin use)
 */
export async function unlockAccount(identifier: string): Promise<void> {
  const lockoutKey = getLockoutKey(identifier);
  const failedKey = getFailedAttemptsKey(identifier);

  await redis.del(lockoutKey);
  await redis.del(failedKey);
}

/**
 * Gets the current lockout status for an identifier
 */
export async function getLockoutStatus(identifier: string): Promise<{
  isLocked: boolean;
  lockedUntil?: Date;
  failedAttempts: number;
}> {
  const lockoutKey = getLockoutKey(identifier);
  const failedKey = getFailedAttemptsKey(identifier);

  const lockoutTTL = await redis.ttl(lockoutKey);
  const failedAttempts = await redis.get(failedKey);

  return {
    isLocked: lockoutTTL > 0,
    lockedUntil: lockoutTTL > 0 ? new Date(Date.now() + lockoutTTL * 1000) : undefined,
    failedAttempts: failedAttempts ? parseInt(failedAttempts, 10) : 0,
  };
}
