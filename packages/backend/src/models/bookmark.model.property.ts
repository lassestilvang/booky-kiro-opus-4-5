/**
 * Property-based tests for Bookmark model
 * **Feature: bookmark-manager, Property 1: Bookmark Serialization Round-Trip**
 * **Validates: Requirements 2.7, 2.8**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  Bookmark,
  BookmarkType,
  serializeBookmark,
  deserializeBookmark,
} from './bookmark.model.js';

// Arbitrary for generating valid BookmarkType values
const bookmarkTypeArb = fc.constantFrom(
  BookmarkType.LINK,
  BookmarkType.ARTICLE,
  BookmarkType.VIDEO,
  BookmarkType.IMAGE,
  BookmarkType.DOCUMENT,
  BookmarkType.AUDIO
);

// Arbitrary for generating valid URLs
const urlArb = fc.webUrl({ withFragments: false, withQueryParameters: false });

// Arbitrary for generating valid domain names
const domainArb = fc.domain();

// Arbitrary for generating valid UUIDs
const uuidArb = fc.uuid();

// Arbitrary for generating optional nullable strings
const optionalStringArb = fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null });

// Arbitrary for generating valid Bookmark objects
const bookmarkArb: fc.Arbitrary<Bookmark> = fc.record({
  id: uuidArb,
  ownerId: uuidArb,
  collectionId: uuidArb,
  url: urlArb,
  normalizedUrl: fc.string({ minLength: 1, maxLength: 2000 }),
  title: fc.string({ minLength: 1, maxLength: 500 }),
  excerpt: optionalStringArb,
  coverUrl: fc.option(urlArb, { nil: null }),
  domain: domainArb,
  type: bookmarkTypeArb,
  contentSnapshotPath: optionalStringArb,
  contentIndexed: fc.boolean(),
  isDuplicate: fc.boolean(),
  isBroken: fc.boolean(),
  isFavorite: fc.boolean(),
  sortOrder: fc.integer({ min: 0, max: 1000000 }),
  note: optionalStringArb,
  createdAt: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
  updatedAt: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
});


describe('Bookmark Serialization Round-Trip', () => {
  /**
   * **Feature: bookmark-manager, Property 1: Bookmark Serialization Round-Trip**
   * **Validates: Requirements 2.7, 2.8**
   * 
   * For any valid bookmark object, serializing to JSON and then deserializing
   * should produce an equivalent bookmark object with all fields preserved.
   */
  it('should preserve all fields through serialize/deserialize cycle', () => {
    fc.assert(
      fc.property(bookmarkArb, (bookmark) => {
        const serialized = serializeBookmark(bookmark);
        const deserialized = deserializeBookmark(serialized);

        // Compare all fields
        expect(deserialized.id).toBe(bookmark.id);
        expect(deserialized.ownerId).toBe(bookmark.ownerId);
        expect(deserialized.collectionId).toBe(bookmark.collectionId);
        expect(deserialized.url).toBe(bookmark.url);
        expect(deserialized.normalizedUrl).toBe(bookmark.normalizedUrl);
        expect(deserialized.title).toBe(bookmark.title);
        expect(deserialized.excerpt).toBe(bookmark.excerpt);
        expect(deserialized.coverUrl).toBe(bookmark.coverUrl);
        expect(deserialized.domain).toBe(bookmark.domain);
        expect(deserialized.type).toBe(bookmark.type);
        expect(deserialized.contentSnapshotPath).toBe(bookmark.contentSnapshotPath);
        expect(deserialized.contentIndexed).toBe(bookmark.contentIndexed);
        expect(deserialized.isDuplicate).toBe(bookmark.isDuplicate);
        expect(deserialized.isBroken).toBe(bookmark.isBroken);
        expect(deserialized.isFavorite).toBe(bookmark.isFavorite);
        expect(deserialized.sortOrder).toBe(bookmark.sortOrder);
        expect(deserialized.note).toBe(bookmark.note);
        // Dates are compared by time value since they're serialized as ISO strings
        expect(deserialized.createdAt.getTime()).toBe(bookmark.createdAt.getTime());
        expect(deserialized.updatedAt.getTime()).toBe(bookmark.updatedAt.getTime());
      }),
      { numRuns: 100 }
    );
  });

  it('should produce valid JSON when serializing', () => {
    fc.assert(
      fc.property(bookmarkArb, (bookmark) => {
        const serialized = serializeBookmark(bookmark);
        // Should not throw when parsing
        expect(() => JSON.parse(serialized)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid JSON when deserializing', () => {
    expect(() => deserializeBookmark('not valid json')).toThrow();
    expect(() => deserializeBookmark('{}')).toThrow();
    expect(() => deserializeBookmark('{"id": "not-a-uuid"}')).toThrow();
  });
});
