/**
 * Property-based tests for JWT utility
 * **Feature: bookmark-manager, Property 23: JWT Token Refresh Validity**
 * **Validates: Requirements 1.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  refreshTokens,
} from './jwt.js';

// Arbitrary for generating valid UUIDs
const uuidArb = fc.uuid();

// Arbitrary for generating valid email addresses
const emailArb = fc.emailAddress();

describe('JWT Token Refresh Validity', () => {
  /**
   * **Feature: bookmark-manager, Property 23: JWT Token Refresh Validity**
   * **Validates: Requirements 1.4**
   *
   * For any valid refresh token, exchanging it for a new access token should
   * produce a valid JWT that can authenticate API requests.
   */
  it('should produce valid access token when refreshing with valid refresh token', () => {
    fc.assert(
      fc.property(uuidArb, emailArb, (userId, email) => {
        // Generate initial token pair
        const initialTokens = generateTokenPair(userId, email);

        // Refresh tokens using the refresh token
        const refreshedTokens = refreshTokens(initialTokens.refreshToken);

        // Refreshed tokens should not be null
        expect(refreshedTokens).not.toBeNull();

        if (refreshedTokens) {
          // The new access token should be verifiable
          const decodedAccess = verifyAccessToken(refreshedTokens.accessToken);
          expect(decodedAccess).not.toBeNull();
          expect(decodedAccess?.userId).toBe(userId);
          expect(decodedAccess?.email).toBe(email);
          expect(decodedAccess?.type).toBe('access');
        }
      }),
      { numRuns: 100 }
    );
  });


  it('should produce valid refresh token when refreshing (token rotation)', () => {
    fc.assert(
      fc.property(uuidArb, emailArb, (userId, email) => {
        // Generate initial token pair
        const initialTokens = generateTokenPair(userId, email);

        // Refresh tokens
        const refreshedTokens = refreshTokens(initialTokens.refreshToken);

        expect(refreshedTokens).not.toBeNull();

        if (refreshedTokens) {
          // The new refresh token should also be verifiable
          const decodedRefresh = verifyRefreshToken(refreshedTokens.refreshToken);
          expect(decodedRefresh).not.toBeNull();
          expect(decodedRefresh?.userId).toBe(userId);
          expect(decodedRefresh?.email).toBe(email);
          expect(decodedRefresh?.type).toBe('refresh');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve user identity through token refresh', () => {
    fc.assert(
      fc.property(uuidArb, emailArb, (userId, email) => {
        // Generate initial token pair
        const initialTokens = generateTokenPair(userId, email);
        const initialDecoded = verifyAccessToken(initialTokens.accessToken);

        // Refresh tokens
        const refreshedTokens = refreshTokens(initialTokens.refreshToken);

        expect(refreshedTokens).not.toBeNull();

        if (refreshedTokens) {
          const refreshedDecoded = verifyAccessToken(refreshedTokens.accessToken);

          // User identity should be preserved
          expect(refreshedDecoded?.userId).toBe(initialDecoded?.userId);
          expect(refreshedDecoded?.email).toBe(initialDecoded?.email);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should return null when refreshing with invalid token', () => {
    const result = refreshTokens('invalid-token');
    expect(result).toBeNull();
  });

  it('should return null when refreshing with access token instead of refresh token', () => {
    fc.assert(
      fc.property(uuidArb, emailArb, (userId, email) => {
        const tokens = generateTokenPair(userId, email);

        // Trying to refresh with access token should fail
        const result = refreshTokens(tokens.accessToken);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('should return positive expiresIn value', () => {
    fc.assert(
      fc.property(uuidArb, emailArb, (userId, email) => {
        const tokens = generateTokenPair(userId, email);
        expect(tokens.expiresIn).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
