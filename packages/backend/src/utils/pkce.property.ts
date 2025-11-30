/**
 * Property-based tests for PKCE utility
 * **Feature: bookmark-manager, Property 24: PKCE Code Verifier Validation**
 * **Validates: Requirements 1.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
  generatePKCEPair,
  isValidCodeVerifier,
  isValidCodeChallenge,
} from './pkce.js';

describe('PKCE Code Verifier Validation', () => {
  /**
   * **Feature: bookmark-manager, Property 24: PKCE Code Verifier Validation**
   * **Validates: Requirements 1.3**
   *
   * For any OAuth2 PKCE flow, the token exchange should succeed only when
   * the code_verifier matches the original code_challenge using SHA256.
   */
  it('should verify code challenge when verifier matches', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        // Generate a PKCE pair
        const { codeVerifier, codeChallenge } = generatePKCEPair();

        // Verification should succeed with matching verifier
        const isValid = verifyCodeChallenge(codeVerifier, codeChallenge);
        expect(isValid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should fail verification when verifier does not match challenge', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        // Generate two different PKCE pairs
        const pair1 = generatePKCEPair();
        const pair2 = generatePKCEPair();

        // Cross-verification should fail (verifier from pair1, challenge from pair2)
        // Note: There's an astronomically small chance they could match by coincidence
        const isValid = verifyCodeChallenge(pair1.codeVerifier, pair2.codeChallenge);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });


  it('should generate valid code verifiers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const verifier = generateCodeVerifier();

        // Should be valid according to PKCE spec
        expect(isValidCodeVerifier(verifier)).toBe(true);

        // Should be at least 43 characters (256 bits base64url encoded)
        expect(verifier.length).toBeGreaterThanOrEqual(43);
        expect(verifier.length).toBeLessThanOrEqual(128);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid code challenges', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier);

        // Should be valid according to PKCE spec
        expect(isValidCodeChallenge(challenge)).toBe(true);

        // SHA256 produces 32 bytes = 43 base64url characters
        expect(challenge.length).toBe(43);
      }),
      { numRuns: 100 }
    );
  });

  it('should produce deterministic challenges for same verifier', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const verifier = generateCodeVerifier();

        // Same verifier should always produce same challenge
        const challenge1 = generateCodeChallenge(verifier);
        const challenge2 = generateCodeChallenge(verifier);

        expect(challenge1).toBe(challenge2);
      }),
      { numRuns: 100 }
    );
  });

  it('should produce unique verifiers on each generation', () => {
    const verifiers = new Set<string>();

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const verifier = generateCodeVerifier();

        // Each verifier should be unique (cryptographically random)
        expect(verifiers.has(verifier)).toBe(false);
        verifiers.add(verifier);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid code verifiers', () => {
    // Too short
    expect(isValidCodeVerifier('abc')).toBe(false);

    // Too long (> 128 characters)
    expect(isValidCodeVerifier('a'.repeat(129))).toBe(false);

    // Invalid characters
    expect(isValidCodeVerifier('abc!@#$%^&*()' + 'a'.repeat(40))).toBe(false);
  });

  it('should reject invalid code challenges', () => {
    // Wrong length
    expect(isValidCodeChallenge('abc')).toBe(false);
    expect(isValidCodeChallenge('a'.repeat(44))).toBe(false);

    // Invalid characters (padding = is not allowed in base64url)
    expect(isValidCodeChallenge('abc=def' + 'a'.repeat(36))).toBe(false);
  });
});
