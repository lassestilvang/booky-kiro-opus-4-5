/**
 * Property-based tests for Tag model
 * **Feature: bookmark-manager, Property 7: Tag Normalization Consistency**
 * **Validates: Requirements 4.1**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeTagName, createTagWithNormalizedName } from './tag.model.js';

describe('Tag Normalization Consistency', () => {
  /**
   * **Feature: bookmark-manager, Property 7: Tag Normalization Consistency**
   * **Validates: Requirements 4.1**
   * 
   * For any tag name string, normalizing it should produce a lowercase, trimmed string,
   * and normalizing twice should produce the same result (idempotence).
   */
  it('should produce lowercase output for any input', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (tagName) => {
        const normalized = normalizeTagName(tagName);
        expect(normalized).toBe(normalized.toLowerCase());
      }),
      { numRuns: 100 }
    );
  });

  it('should produce trimmed output for any input', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (tagName) => {
        const normalized = normalizeTagName(tagName);
        expect(normalized).toBe(normalized.trim());
      }),
      { numRuns: 100 }
    );
  });

  it('should be idempotent - normalizing twice equals normalizing once', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (tagName) => {
        const normalizedOnce = normalizeTagName(tagName);
        const normalizedTwice = normalizeTagName(normalizedOnce);
        expect(normalizedTwice).toBe(normalizedOnce);
      }),
      { numRuns: 100 }
    );
  });

  it('should normalize tags with various whitespace patterns', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 5 }),
        fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 5 }),
        (core, leadingWhitespace, trailingWhitespace) => {
          const tagWithWhitespace = leadingWhitespace + core + trailingWhitespace;
          const normalized = normalizeTagName(tagWithWhitespace);
          // Should not have leading or trailing whitespace
          expect(normalized).toBe(normalized.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce consistent normalized names via createTagWithNormalizedName', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (tagName) => {
        const result = createTagWithNormalizedName(tagName);
        // normalizedName should match what normalizeTagName produces
        expect(result.normalizedName).toBe(normalizeTagName(tagName));
        // name should be trimmed but preserve case
        expect(result.name).toBe(tagName.trim());
      }),
      { numRuns: 100 }
    );
  });

  it('should treat case-different tags as equivalent after normalization', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (tagName) => {
          const lower = normalizeTagName(tagName.toLowerCase());
          const upper = normalizeTagName(tagName.toUpperCase());
          const mixed = normalizeTagName(tagName);
          // All case variants should normalize to the same value
          expect(lower).toBe(upper);
          expect(upper).toBe(mixed);
        }
      ),
      { numRuns: 100 }
    );
  });
});
