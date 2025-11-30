/**
 * PKCE (Proof Key for Code Exchange) Utility
 * Requirements: 1.3
 *
 * Implements OAuth2 PKCE extension for secure authorization in public clients
 * like browser extensions.
 */
import crypto from 'crypto';

/**
 * Generates a cryptographically random code verifier
 * The verifier is a high-entropy random string between 43-128 characters
 */
export function generateCodeVerifier(): string {
  // Generate 32 bytes of random data (will result in 43 base64url characters)
  const buffer = crypto.randomBytes(32);
  return base64UrlEncode(buffer);
}

/**
 * Generates a code challenge from a code verifier using SHA256
 * The challenge is sent in the authorization request
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64UrlEncode(hash);
}

/**
 * Verifies that a code verifier matches a code challenge
 * Used during token exchange to validate the PKCE flow
 */
export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
  const computedChallenge = generateCodeChallenge(verifier);
  return computedChallenge === challenge;
}

/**
 * Base64 URL encoding (RFC 4648)
 * Replaces + with -, / with _, and removes padding =
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}


/**
 * Generates an authorization code for the OAuth2 flow
 * This code is exchanged for tokens after user authentication
 */
export function generateAuthorizationCode(): string {
  const buffer = crypto.randomBytes(32);
  return base64UrlEncode(buffer);
}

/**
 * Validates that a code verifier meets PKCE requirements
 * - Must be between 43 and 128 characters
 * - Must only contain unreserved URI characters (A-Z, a-z, 0-9, -, ., _, ~)
 */
export function isValidCodeVerifier(verifier: string): boolean {
  if (verifier.length < 43 || verifier.length > 128) {
    return false;
  }

  // Check for valid characters (unreserved URI characters)
  const validPattern = /^[A-Za-z0-9\-._~]+$/;
  return validPattern.test(verifier);
}

/**
 * Validates that a code challenge meets PKCE requirements
 * - Must be a valid base64url encoded string
 * - For SHA256, should be 43 characters (256 bits / 6 bits per char)
 */
export function isValidCodeChallenge(challenge: string): boolean {
  // SHA256 produces 32 bytes, which is 43 base64url characters
  if (challenge.length !== 43) {
    return false;
  }

  // Check for valid base64url characters
  const validPattern = /^[A-Za-z0-9\-_]+$/;
  return validPattern.test(challenge);
}

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Generates a complete PKCE pair (verifier and challenge)
 * Convenience function for clients
 */
export function generatePKCEPair(): PKCEPair {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}
