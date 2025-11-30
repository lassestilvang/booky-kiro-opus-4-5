/**
 * Property-based tests for Collection Service
 * Tests business logic properties for collection operations
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../db/client.js';
import {
  createCollectionForUser,
  deleteCollectionForUser,
  makeCollectionPublic,
  ensureDefaultCollection,
} from './collection.service.js';
import { createBookmarkForUser } from './bookmark.service.js';

// Test user for property tests
let testUserId: string;

// Arbitrary for generating collection titles
const collectionTitleArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 -]{2,30}$/);

// Arbitrary for generating valid URLs
const urlArb = fc.tuple(
  fc.constantFrom('https://example.com', 'https://test.org', 'https://demo.net'),
  fc.array(fc.stringMatching(/^[a-z0-9-]+$/), { minLength: 0, maxLength: 2 })
).map(([base, pathParts]) => {
  const path = pathParts.length > 0 ? '/' + pathParts.join('/') : '';
  return base + path;
});

beforeAll(async () => {
  // Create a test user
  const user = await prisma.user.create({
    data: {
      email: `test-collection-service-${Date.now()}@test.com`,
      passwordHash: 'test-hash',
      name: 'Test User',
    },
  });
  testUserId = user.id;
});

afterAll(async () => {
  // Clean up test data
  await prisma.bookmark.deleteMany({ where: { ownerId: testUserId } });
  await prisma.collection.deleteMany({ where: { ownerId: testUserId } });
  await prisma.user.delete({ where: { id: testUserId } });
});

beforeEach(async () => {
  // Clean up collections and bookmarks before each test (except default Unsorted)
  await prisma.bookmark.deleteMany({ where: { ownerId: testUserId } });
  await prisma.collection.deleteMany({ 
    where: { 
      ownerId: testUserId,
      title: { not: 'Unsorted' },
    },
  });
});


describe('Collection Deletion Preserves Bookmarks', () => {
  /**
   * **Feature: bookmark-manager, Property 14: Collection Deletion Preserves Bookmarks**
   * **Validates: Requirements 3.4**
   * 
   * For any collection containing bookmarks, deleting the collection should move
   * all contained bookmarks to the "Unsorted" collection rather than deleting them.
   */
  it('should move bookmarks to Unsorted when collection is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        collectionTitleArb,
        fc.array(urlArb, { minLength: 1, maxLength: 5 }),
        async (title, urls) => {
          // Ensure we have the default Unsorted collection
          const unsortedCollection = await ensureDefaultCollection(testUserId);

          // Create a new collection
          const collectionResult = await createCollectionForUser(testUserId, {
            title,
            icon: 'folder',
          });
          expect(collectionResult.success).toBe(true);
          const collectionId = collectionResult.collection!.id;

          // Create bookmarks in this collection
          const bookmarkIds: string[] = [];
          for (const url of urls) {
            const uniqueUrl = `${url}?t=${Date.now()}-${Math.random()}`;
            const bookmarkResult = await createBookmarkForUser(testUserId, {
              url: uniqueUrl,
              collectionId,
            });
            expect(bookmarkResult.success).toBe(true);
            bookmarkIds.push(bookmarkResult.bookmark!.id);
          }

          // Verify bookmarks are in the collection
          const bookmarksBefore = await prisma.bookmark.findMany({
            where: { id: { in: bookmarkIds } },
          });
          expect(bookmarksBefore.length).toBe(urls.length);
          expect(bookmarksBefore.every(b => b.collectionId === collectionId)).toBe(true);

          // Delete the collection
          const deleteResult = await deleteCollectionForUser(collectionId, testUserId);
          expect(deleteResult.success).toBe(true);
          expect(deleteResult.movedBookmarks).toBe(urls.length);

          // Verify bookmarks still exist and are now in Unsorted
          const bookmarksAfter = await prisma.bookmark.findMany({
            where: { id: { in: bookmarkIds } },
          });
          expect(bookmarksAfter.length).toBe(urls.length);
          expect(bookmarksAfter.every(b => b.collectionId === unsortedCollection.id)).toBe(true);

          // Verify the original collection is deleted
          const deletedCollection = await prisma.collection.findUnique({
            where: { id: collectionId },
          });
          expect(deletedCollection).toBeNull();

          // Clean up bookmarks
          await prisma.bookmark.deleteMany({ where: { id: { in: bookmarkIds } } });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should not delete the Unsorted collection', async () => {
    // Ensure we have the default Unsorted collection
    const unsortedCollection = await ensureDefaultCollection(testUserId);

    // Try to delete the Unsorted collection
    const deleteResult = await deleteCollectionForUser(unsortedCollection.id, testUserId);
    
    expect(deleteResult.success).toBe(false);
    expect(deleteResult.errorCode).toBe('COLLECTION_CANNOT_DELETE_UNSORTED');

    // Verify the collection still exists
    const collection = await prisma.collection.findUnique({
      where: { id: unsortedCollection.id },
    });
    expect(collection).not.toBeNull();
  });
});


describe('Public Collection Slug Uniqueness', () => {
  /**
   * **Feature: bookmark-manager, Property 15: Public Collection Slug Uniqueness**
   * **Validates: Requirements 3.5**
   * 
   * For any two collections set as public, their generated share slugs should be different.
   */
  it('should generate unique slugs for multiple public collections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(collectionTitleArb, { minLength: 2, maxLength: 5 }),
        async (titles) => {
          const collectionIds: string[] = [];
          const shareSlugs: string[] = [];

          try {
            // Create multiple collections and make them public
            for (const title of titles) {
              const uniqueTitle = `${title}-${Date.now()}-${Math.random()}`;
              const collectionResult = await createCollectionForUser(testUserId, {
                title: uniqueTitle,
                icon: 'folder',
              });
              expect(collectionResult.success).toBe(true);
              collectionIds.push(collectionResult.collection!.id);

              // Make the collection public
              const publicResult = await makeCollectionPublic(
                collectionResult.collection!.id,
                testUserId
              );
              expect(publicResult.success).toBe(true);
              expect(publicResult.collection!.isPublic).toBe(true);
              expect(publicResult.collection!.shareSlug).toBeTruthy();
              shareSlugs.push(publicResult.collection!.shareSlug!);
            }

            // Verify all slugs are unique
            const uniqueSlugs = new Set(shareSlugs);
            expect(uniqueSlugs.size).toBe(shareSlugs.length);

            // Verify slugs are non-empty strings
            for (const slug of shareSlugs) {
              expect(typeof slug).toBe('string');
              expect(slug.length).toBeGreaterThan(0);
            }
          } finally {
            // Clean up collections
            for (const id of collectionIds) {
              await prisma.collection.delete({ where: { id } }).catch(() => {});
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should return existing slug when making already-public collection public again', async () => {
    // Create a collection
    const collectionResult = await createCollectionForUser(testUserId, {
      title: `Test Public ${Date.now()}`,
      icon: 'folder',
    });
    expect(collectionResult.success).toBe(true);
    const collectionId = collectionResult.collection!.id;

    try {
      // Make it public
      const publicResult1 = await makeCollectionPublic(collectionId, testUserId);
      expect(publicResult1.success).toBe(true);
      const slug1 = publicResult1.collection!.shareSlug;

      // Make it public again
      const publicResult2 = await makeCollectionPublic(collectionId, testUserId);
      expect(publicResult2.success).toBe(true);
      const slug2 = publicResult2.collection!.shareSlug;

      // Should return the same slug
      expect(slug1).toBe(slug2);
    } finally {
      await prisma.collection.delete({ where: { id: collectionId } }).catch(() => {});
    }
  });
});
