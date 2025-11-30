/**
 * OAuth Service - OAuth2 PKCE flow for browser extension
 * Requirements: 1.3
 */
import { prisma } from '../db/client.js';
import {
  generateAuthorizationCode,
  verifyCodeChallenge,
  isValidCodeChallenge,
  isValidCodeVerifier,
} from '../utils/pkce.js';
import { generateTokenPair, type TokenPair } from '../utils/jwt.js';
import type { PublicUser } from '../models/user.model.js';
import { toPublicUser } from '../models/user.model.js';

// In-memory store for authorization codes (in production, use Redis)
// Maps authorization code to { userId, codeChallenge, expiresAt }
interface AuthCodeData {
  userId: string;
  email: string;
  codeChallenge: string;
  expiresAt: Date;
}

const authorizationCodes = new Map<string, AuthCodeData>();

// Authorization code expiry time (10 minutes)
const AUTH_CODE_EXPIRY_MS = 10 * 60 * 1000;

export interface AuthorizeResult {
  success: boolean;
  authorizationCode?: string;
  error?: string;
  errorCode?: string;
}

export interface TokenExchangeResult {
  success: boolean;
  tokens?: TokenPair;
  user?: PublicUser;
  error?: string;
  errorCode?: string;
}

export const OAuthErrorCodes = {
  INVALID_CODE_CHALLENGE: 'OAUTH_INVALID_CODE_CHALLENGE',
  INVALID_CODE_VERIFIER: 'OAUTH_INVALID_CODE_VERIFIER',
  INVALID_AUTH_CODE: 'OAUTH_INVALID_AUTH_CODE',
  AUTH_CODE_EXPIRED: 'OAUTH_AUTH_CODE_EXPIRED',
  PKCE_VERIFICATION_FAILED: 'OAUTH_PKCE_VERIFICATION_FAILED',
  USER_NOT_FOUND: 'OAUTH_USER_NOT_FOUND',
} as const;


/**
 * Creates an authorization code after user authentication
 * The code is bound to the code_challenge for PKCE validation
 * Requirements: 1.3
 */
export function createAuthorizationCode(
  userId: string,
  email: string,
  codeChallenge: string
): AuthorizeResult {
  // Validate code challenge
  if (!isValidCodeChallenge(codeChallenge)) {
    return {
      success: false,
      error: 'Invalid code challenge format',
      errorCode: OAuthErrorCodes.INVALID_CODE_CHALLENGE,
    };
  }

  // Generate authorization code
  const authorizationCode = generateAuthorizationCode();

  // Store with expiry
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);
  authorizationCodes.set(authorizationCode, {
    userId,
    email,
    codeChallenge,
    expiresAt,
  });

  // Clean up expired codes periodically
  cleanupExpiredCodes();

  return {
    success: true,
    authorizationCode,
  };
}

/**
 * Exchanges an authorization code for tokens using PKCE verification
 * Requirements: 1.3
 */
export async function exchangeCodeForTokens(
  authorizationCode: string,
  codeVerifier: string
): Promise<TokenExchangeResult> {
  // Validate code verifier format
  if (!isValidCodeVerifier(codeVerifier)) {
    return {
      success: false,
      error: 'Invalid code verifier format',
      errorCode: OAuthErrorCodes.INVALID_CODE_VERIFIER,
    };
  }

  // Get stored authorization code data
  const codeData = authorizationCodes.get(authorizationCode);

  if (!codeData) {
    return {
      success: false,
      error: 'Invalid or unknown authorization code',
      errorCode: OAuthErrorCodes.INVALID_AUTH_CODE,
    };
  }

  // Check expiry
  if (new Date() > codeData.expiresAt) {
    authorizationCodes.delete(authorizationCode);
    return {
      success: false,
      error: 'Authorization code has expired',
      errorCode: OAuthErrorCodes.AUTH_CODE_EXPIRED,
    };
  }

  // Verify PKCE - code_verifier must match code_challenge
  if (!verifyCodeChallenge(codeVerifier, codeData.codeChallenge)) {
    return {
      success: false,
      error: 'PKCE verification failed',
      errorCode: OAuthErrorCodes.PKCE_VERIFICATION_FAILED,
    };
  }

  // Authorization code is single-use - delete it
  authorizationCodes.delete(authorizationCode);

  // Verify user still exists
  const user = await prisma.user.findUnique({
    where: { id: codeData.userId },
  });

  if (!user) {
    return {
      success: false,
      error: 'User not found',
      errorCode: OAuthErrorCodes.USER_NOT_FOUND,
    };
  }

  // Generate tokens
  const tokens = generateTokenPair(codeData.userId, codeData.email);

  return {
    success: true,
    tokens,
    user: toPublicUser(user as any),
  };
}

/**
 * Cleans up expired authorization codes
 */
function cleanupExpiredCodes(): void {
  const now = new Date();
  for (const [code, data] of authorizationCodes.entries()) {
    if (now > data.expiresAt) {
      authorizationCodes.delete(code);
    }
  }
}

/**
 * Revokes an authorization code (for testing or security purposes)
 */
export function revokeAuthorizationCode(authorizationCode: string): boolean {
  return authorizationCodes.delete(authorizationCode);
}

/**
 * Gets the count of active authorization codes (for monitoring)
 */
export function getActiveAuthCodeCount(): number {
  cleanupExpiredCodes();
  return authorizationCodes.size;
}
