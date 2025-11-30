/**
 * Property-based tests for URL Normalizer
 * Requirements: 2.6
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  normalizeURL,
  hasTrackingParams,
  extractDomain,
  validateURL,
  TRACKING_PARAMS,
} from './url-normalizer.js';

// Arbitrary for generating valid URL paths
const pathSegmentArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
  { minLength: 1, maxLength: 20 }
);

const pathArb = fc
  .array(pathSegmentArb, { minLength: 0, maxLength: 5 })
  .map(segments => '/' + segments.join('/'));

// Arbitrary for generating valid domain names
const domainArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
      minLength: 1,
      maxLength: 20,
    }),
    fc.constantFrom('.com', '.org', '.net', '.io', '.dev', '.co')
  )
  .map(([name, tld]) => name + tld);

// Arbitrary for generating non-tracking query parameter names
const nonTrackingParamNameArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 1,
    maxLength: 10,
  })
  .filter(name => {
    const lower = name.toLowerCase();
    return (
      !TRACKING_PARAMS.includes(lower) &&
      !lower.startsWith('utm_') &&
      !lower.startsWith('fb_') &&
      !lower.startsWith('hsa_')
    );
  });

// Arbitrary for generating query parameter values
const paramValueArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  { minLength: 1, maxLength: 20 }
);

// Arbitrary for generating non-tracking query parameters
const nonTrackingParamsArb = fc
  .array(fc.tuple(nonTrackingParamNameArb, paramValueArb), { minLength: 0, maxLength: 5 })
  .map(pairs => {
    if (pairs.length === 0) return '';
    const params = new URLSearchParams();
    pairs.forEach(([key, value]) => params.append(key, value));
    return '?' + params.toString();
  });

// Arbitrary for generating valid URLs without tracking params
const validURLArb = fc
  .tuple(
    fc.constantFrom('http', 'https'),
    fc.boolean(), // include www?
    domainArb,
    pathArb,
    nonTrackingParamsArb
  )
  .map(([protocol, includeWww, domain, path, query]) => {
    const host = includeWww ? `www.${domain}` : domain;
    return `${protocol}://${host}${path}${query}`;
  });

// Arbitrary for generating tracking parameter names
const trackingParamNameArb = fc.constantFrom(
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  'twclid',
  'mc_cid',
  'mc_eid',
  'ref',
  '_ga',
  'yclid'
);

// Arbitrary for generating URLs with tracking parameters
const urlWithTrackingArb = fc
  .tuple(
    validURLArb,
    fc.array(fc.tuple(trackingParamNameArb, paramValueArb), { minLength: 1, maxLength: 5 })
  )
  .map(([baseUrl, trackingParams]) => {
    const parsed = new URL(baseUrl);
    trackingParams.forEach(([key, value]) => {
      parsed.searchParams.append(key, value);
    });
    return parsed.toString();
  });

describe('URL Normalization Idempotence', () => {
  /**
   * **Feature: bookmark-manager, Property 5: URL Normalization Idempotence**
   * **Validates: Requirements 2.6**
   *
   * For any URL string, normalizing it twice should produce the same result
   * as normalizing it once (normalize(normalize(url)) === normalize(url)).
   */
  it('should be idempotent: normalize(normalize(url)) === normalize(url)', () => {
    fc.assert(
      fc.property(validURLArb, (url) => {
        const normalizedOnce = normalizeURL(url);
        const normalizedTwice = normalizeURL(normalizedOnce);

        expect(normalizedTwice).toBe(normalizedOnce);
      }),
      { numRuns: 100 }
    );
  });

  it('should be idempotent for URLs with tracking parameters', () => {
    fc.assert(
      fc.property(urlWithTrackingArb, (url) => {
        const normalizedOnce = normalizeURL(url);
        const normalizedTwice = normalizeURL(normalizedOnce);

        expect(normalizedTwice).toBe(normalizedOnce);
      }),
      { numRuns: 100 }
    );
  });

  it('should produce consistent results regardless of query param order', () => {
    fc.assert(
      fc.property(
        domainArb,
        fc.array(fc.tuple(nonTrackingParamNameArb, paramValueArb), { minLength: 2, maxLength: 5 }),
        (domain, params) => {
          // Create URL with params in original order
          const url1 = new URL(`https://${domain}/`);
          params.forEach(([k, v]) => url1.searchParams.append(k, v));

          // Create URL with params in reversed order
          const url2 = new URL(`https://${domain}/`);
          [...params].reverse().forEach(([k, v]) => url2.searchParams.append(k, v));

          const normalized1 = normalizeURL(url1.toString());
          const normalized2 = normalizeURL(url2.toString());

          expect(normalized1).toBe(normalized2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('URL Normalization Removes Tracking Parameters', () => {
  /**
   * **Feature: bookmark-manager, Property 6: URL Normalization Removes Tracking Parameters**
   * **Validates: Requirements 2.6**
   *
   * For any URL with tracking parameters (utm_*, fbclid, gclid), the normalized URL
   * should not contain those parameters while preserving all other query parameters.
   */
  it('should remove all tracking parameters from URLs', () => {
    fc.assert(
      fc.property(urlWithTrackingArb, (url) => {
        const normalized = normalizeURL(url);

        // Verify no tracking params remain
        expect(hasTrackingParams(normalized)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve non-tracking query parameters', () => {
    fc.assert(
      fc.property(
        domainArb,
        fc.array(fc.tuple(nonTrackingParamNameArb, paramValueArb), { minLength: 1, maxLength: 3 }),
        fc.array(fc.tuple(trackingParamNameArb, paramValueArb), { minLength: 1, maxLength: 3 }),
        (domain, nonTrackingParams, trackingParams) => {
          // Build URL with both tracking and non-tracking params
          const url = new URL(`https://${domain}/path`);
          nonTrackingParams.forEach(([k, v]) => url.searchParams.append(k, v));
          trackingParams.forEach(([k, v]) => url.searchParams.append(k, v));

          const normalized = normalizeURL(url.toString());
          const normalizedUrl = new URL(normalized);

          // All non-tracking params should be preserved
          nonTrackingParams.forEach(([key, value]) => {
            expect(normalizedUrl.searchParams.get(key)).toBe(value);
          });

          // No tracking params should remain
          trackingParams.forEach(([key]) => {
            expect(normalizedUrl.searchParams.has(key)).toBe(false);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle URLs with only tracking parameters', () => {
    fc.assert(
      fc.property(
        domainArb,
        fc.array(fc.tuple(trackingParamNameArb, paramValueArb), { minLength: 1, maxLength: 5 }),
        (domain, trackingParams) => {
          const url = new URL(`https://${domain}/page`);
          trackingParams.forEach(([k, v]) => url.searchParams.append(k, v));

          const normalized = normalizeURL(url.toString());
          const normalizedUrl = new URL(normalized);

          // Should have no query params at all
          expect(normalizedUrl.search).toBe('');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should remove utm_ prefixed parameters regardless of suffix', () => {
    fc.assert(
      fc.property(
        domainArb,
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
          minLength: 1,
          maxLength: 10,
        }),
        paramValueArb,
        (domain, suffix, value) => {
          const url = `https://${domain}/page?utm_${suffix}=${value}`;
          const normalized = normalizeURL(url);

          expect(hasTrackingParams(normalized)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Domain Extraction', () => {
  it('should extract domain without www prefix', () => {
    fc.assert(
      fc.property(domainArb, pathArb, (domain, path) => {
        const urlWithWww = `https://www.${domain}${path}`;
        const urlWithoutWww = `https://${domain}${path}`;

        expect(extractDomain(urlWithWww)).toBe(domain);
        expect(extractDomain(urlWithoutWww)).toBe(domain);
      }),
      { numRuns: 100 }
    );
  });

  it('should lowercase the domain', () => {
    fc.assert(
      fc.property(domainArb, (domain) => {
        const upperDomain = domain.toUpperCase();
        const url = `https://${upperDomain}/path`;

        expect(extractDomain(url)).toBe(domain.toLowerCase());
      }),
      { numRuns: 100 }
    );
  });
});

describe('URL Validation', () => {
  it('should accept valid http and https URLs', () => {
    fc.assert(
      fc.property(validURLArb, (url) => {
        const result = validateURL(url);
        expect(result.isValid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject non-http/https protocols', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ftp', 'file', 'mailto', 'javascript', 'data'),
        domainArb,
        (protocol, domain) => {
          const url = `${protocol}://${domain}/path`;
          const result = validateURL(url);
          expect(result.isValid).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});
