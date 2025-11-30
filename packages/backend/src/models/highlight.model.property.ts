/**
 * Property-based tests for Highlight model
 * **Feature: bookmark-manager, Property 3: Highlight Serialization Round-Trip**
 * **Validates: Requirements 11.6, 11.7**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  Highlight,
  HighlightColor,
  PositionContext,
  serializeHighlight,
  deserializeHighlight,
} from './highlight.model.js';

// Arbitrary for generating valid HighlightColor values
const highlightColorArb = fc.constantFrom(
  HighlightColor.YELLOW,
  HighlightColor.GREEN,
  HighlightColor.BLUE,
  HighlightColor.PINK,
  HighlightColor.PURPLE
);

// Arbitrary for generating valid UUIDs
const uuidArb = fc.uuid();

// Arbitrary for generating optional nullable strings
const optionalStringArb = fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null });

// Arbitrary for generating valid CSS selectors
const cssSelectorArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_.#[]= '.split('')),
  { minLength: 1, maxLength: 100 }
).filter(s => s.trim().length > 0);

// Arbitrary for generating valid PositionContext objects
const positionContextArb: fc.Arbitrary<PositionContext> = fc.record({
  startOffset: fc.integer({ min: 0, max: 10000 }),
  endOffset: fc.integer({ min: 0, max: 10000 }),
  containerSelector: cssSelectorArb,
  surroundingText: fc.string({ minLength: 0, maxLength: 500 }),
});

// Arbitrary for generating valid Highlight objects
const highlightArb: fc.Arbitrary<Highlight> = fc.record({
  id: uuidArb,
  bookmarkId: uuidArb,
  ownerId: uuidArb,
  textSelected: fc.string({ minLength: 1, maxLength: 1000 }),
  color: highlightColorArb,
  annotationMd: optionalStringArb,
  positionContext: positionContextArb,
  snapshotId: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  createdAt: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
  updatedAt: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
});


describe('Highlight Serialization Round-Trip', () => {
  /**
   * **Feature: bookmark-manager, Property 3: Highlight Serialization Round-Trip**
   * **Validates: Requirements 11.6, 11.7**
   * 
   * For any valid highlight object with position context, serializing to JSON
   * and then deserializing should produce an equivalent highlight object
   * with position context preserved.
   */
  it('should preserve all fields including position context through serialize/deserialize cycle', () => {
    fc.assert(
      fc.property(highlightArb, (highlight) => {
        const serialized = serializeHighlight(highlight);
        const deserialized = deserializeHighlight(serialized);

        // Compare all fields
        expect(deserialized.id).toBe(highlight.id);
        expect(deserialized.bookmarkId).toBe(highlight.bookmarkId);
        expect(deserialized.ownerId).toBe(highlight.ownerId);
        expect(deserialized.textSelected).toBe(highlight.textSelected);
        expect(deserialized.color).toBe(highlight.color);
        expect(deserialized.annotationMd).toBe(highlight.annotationMd);
        expect(deserialized.snapshotId).toBe(highlight.snapshotId);
        
        // Verify position context is preserved
        expect(deserialized.positionContext.startOffset).toBe(highlight.positionContext.startOffset);
        expect(deserialized.positionContext.endOffset).toBe(highlight.positionContext.endOffset);
        expect(deserialized.positionContext.containerSelector).toBe(highlight.positionContext.containerSelector);
        expect(deserialized.positionContext.surroundingText).toBe(highlight.positionContext.surroundingText);
        
        // Dates are compared by time value since they're serialized as ISO strings
        expect(deserialized.createdAt.getTime()).toBe(highlight.createdAt.getTime());
        expect(deserialized.updatedAt.getTime()).toBe(highlight.updatedAt.getTime());
      }),
      { numRuns: 100 }
    );
  });

  it('should produce valid JSON when serializing', () => {
    fc.assert(
      fc.property(highlightArb, (highlight) => {
        const serialized = serializeHighlight(highlight);
        expect(() => JSON.parse(serialized)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid JSON when deserializing', () => {
    expect(() => deserializeHighlight('not valid json')).toThrow();
    expect(() => deserializeHighlight('{}')).toThrow();
    expect(() => deserializeHighlight('{"id": "not-a-uuid"}')).toThrow();
  });

  it('should reject highlights with invalid position context', () => {
    const invalidHighlight = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      bookmarkId: '550e8400-e29b-41d4-a716-446655440001',
      ownerId: '550e8400-e29b-41d4-a716-446655440002',
      textSelected: 'some text',
      color: 'YELLOW',
      positionContext: {
        startOffset: -1, // Invalid: negative offset
        endOffset: 10,
        containerSelector: 'div',
        surroundingText: 'context',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => deserializeHighlight(JSON.stringify(invalidHighlight))).toThrow();
  });
});
