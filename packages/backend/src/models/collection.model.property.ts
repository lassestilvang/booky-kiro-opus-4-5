/**
 * Property-based tests for Collection model
 * **Feature: bookmark-manager, Property 2: Collection Serialization Round-Trip**
 * **Validates: Requirements 3.6, 3.7**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  Collection,
  serializeCollection,
  deserializeCollection,
} from './collection.model.js';

// Arbitrary for generating valid UUIDs
const uuidArb = fc.uuid();

// Arbitrary for generating optional nullable strings
const optionalStringArb = fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null });

// Arbitrary for generating optional nullable UUIDs
const optionalUuidArb = fc.option(uuidArb, { nil: null });

// Arbitrary for generating valid Collection objects
const collectionArb: fc.Arbitrary<Collection> = fc.record({
  id: uuidArb,
  ownerId: uuidArb,
  title: fc.string({ minLength: 1, maxLength: 200 }),
  description: optionalStringArb,
  icon: fc.string({ minLength: 1, maxLength: 50 }),
  color: fc.option(fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`), { nil: null }),
  isPublic: fc.boolean(),
  shareSlug: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  sortOrder: fc.integer({ min: 0, max: 1000000 }),
  parentId: optionalUuidArb,
  createdAt: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
  updatedAt: fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
});

describe('Collection Serialization Round-Trip', () => {
  /**
   * **Feature: bookmark-manager, Property 2: Collection Serialization Round-Trip**
   * **Validates: Requirements 3.6, 3.7**
   * 
   * For any valid collection object, serializing to JSON and then deserializing
   * should produce an equivalent collection object with all fields preserved.
   */
  it('should preserve all fields through serialize/deserialize cycle', () => {
    fc.assert(
      fc.property(collectionArb, (collection) => {
        const serialized = serializeCollection(collection);
        const deserialized = deserializeCollection(serialized);

        // Compare all fields
        expect(deserialized.id).toBe(collection.id);
        expect(deserialized.ownerId).toBe(collection.ownerId);
        expect(deserialized.title).toBe(collection.title);
        expect(deserialized.description).toBe(collection.description);
        expect(deserialized.icon).toBe(collection.icon);
        expect(deserialized.color).toBe(collection.color);
        expect(deserialized.isPublic).toBe(collection.isPublic);
        expect(deserialized.shareSlug).toBe(collection.shareSlug);
        expect(deserialized.sortOrder).toBe(collection.sortOrder);
        expect(deserialized.parentId).toBe(collection.parentId);
        // Dates are compared by time value since they're serialized as ISO strings
        expect(deserialized.createdAt.getTime()).toBe(collection.createdAt.getTime());
        expect(deserialized.updatedAt.getTime()).toBe(collection.updatedAt.getTime());
      }),
      { numRuns: 100 }
    );
  });

  it('should produce valid JSON when serializing', () => {
    fc.assert(
      fc.property(collectionArb, (collection) => {
        const serialized = serializeCollection(collection);
        expect(() => JSON.parse(serialized)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid JSON when deserializing', () => {
    expect(() => deserializeCollection('not valid json')).toThrow();
    expect(() => deserializeCollection('{}')).toThrow();
    expect(() => deserializeCollection('{"id": "not-a-uuid"}')).toThrow();
  });
});
