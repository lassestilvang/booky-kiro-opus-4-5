/**
 * Property-based tests for Bulk Operation Service
 * Tests business logic properties for bulk bookmark operations
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../db/client.js';
import { createBookmarkForUser } from './bookmark.service.js';
import { executeBulkOperation, BulkActionType } from './bulk-operation.service.js';

// Test user for property tests
let testUserId: string;
let testCollectionId: string;
let testCollection2Id: string;

beforeAll(async () => {
  // Create a test user
  const user = await prisma.user.create({
    data: {
      email: `test-bulk-ops-${Date.now()}@test.com`,
      passwordHash: 'test-hash',
      name: 'Test User',
    },
  });
  testUserId = user.id;

  // Create test collections
  const collection = await prisma.collection.create({
    data: {
      ownerId: testUserId,
      title: 'Test Collection',
      icon: 'folder',
    },
  });
  testCollectionId = collection.id;

  const collection2 = await prisma.collection.create({
    data: {
      ownerId: testUserId,
      title: 'Test Collection 2',
      icon: 'folder',
    },
  });
  testCollection2Id = collection2.id;
});

afterAll(async () => {
  // Clean up test data
  await prisma.bookmarkTag.deleteMany({
    where: { bookmark: { ownerId: testUserId } },
  });
  await prisma.bookmark.deleteMany({ where: { ownerId: testUserId } });
  await prisma.tag.deleteMany({ where: { ownerId: testUserId } });
  await prisma.collection.deleteMany({ where: { ownerId: testUserId } });
  await prisma.user.delete({ where: { id: testUserId } });
});


beforeEach(async () => {
  // Clean up bookmarks and tags before each test
  await prisma.bookmarkTag.deleteMany({
    where: { bookmark: { ownerId: testUserId } },
  });
  await prisma.bookmark.deleteMany({ where: { ownerId: testUserId } });
  await prisma.tag.deleteMany({ where: { ownerId: testUserId } });
});

/**
 * Helper to create multiple bookmarks for testing
 */
async function createTestBookmarks(count: number): Promise<string[]> {
  const bookmarkIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const result = await createBookmarkForUser(testUserId, {
      url: `https://example.com/bulk-test-${Date.now()}-${i}-${Math.random()}`,
      collectionId: testCollectionId,
    });
    if (result.success && result.bookmark) {
      bookmarkIds.push(result.bookmark.id);
    }
  }
  return bookmarkIds;
}

describe('Bulk Operations Affect All Selected Items', () => {
  /**
   * **Feature: bookmark-manager, Property 16: Bulk Operations Affect All Selected Items**
   * **Validates: Requirements 14.1, 14.2, 14.3**
   *
   * For any bulk operation (add tags, move, delete) on a set of bookmark IDs,
   * the operation should affect exactly those bookmarks and no others.
   */

  it('bulk addTags should add tags to all selected bookmarks and no others', async () => {
    const countArb = fc.integer({ min: 2, max: 5 });
    const tagCountArb = fc.integer({ min: 1, max: 3 });

    await fc.assert(
      fc.asyncProperty(countArb, tagCountArb, async (bookmarkCount, tagCount) => {
        // Create bookmarks
        const allBookmarkIds = await createTestBookmarks(bookmarkCount + 2);
        const selectedIds = allBookmarkIds.slice(0, bookmarkCount);
        const unselectedIds = allBookmarkIds.slice(bookmarkCount);

        // Generate tag names
        const tagNames = Array.from({ length: tagCount }, (_, i) => `bulk-tag-${Date.now()}-${i}`);

        // Execute bulk add tags
        const result = await executeBulkOperation(testUserId, {
          bookmarkIds: selectedIds,
          action: BulkActionType.ADD_TAGS,
          payload: { tags: tagNames },
        });

        expect(result.success).toBe(true);
        expect(result.affectedCount).toBe(selectedIds.length);

        // Verify selected bookmarks have the tags
        for (const bookmarkId of selectedIds) {
          const tags = await prisma.bookmarkTag.findMany({
            where: { bookmarkId },
            include: { tag: true },
          });
          const tagNamesOnBookmark = tags.map(t => t.tag.name);
          for (const tagName of tagNames) {
            expect(tagNamesOnBookmark).toContain(tagName);
          }
        }

        // Verify unselected bookmarks do NOT have the tags
        for (const bookmarkId of unselectedIds) {
          const tags = await prisma.bookmarkTag.findMany({
            where: { bookmarkId },
            include: { tag: true },
          });
          const tagNamesOnBookmark = tags.map(t => t.tag.name);
          for (const tagName of tagNames) {
            expect(tagNamesOnBookmark).not.toContain(tagName);
          }
        }
      }),
      { numRuns: 10 }
    );
  });

  it('bulk removeTags should remove tags from all selected bookmarks and no others', async () => {
    const countArb = fc.integer({ min: 2, max: 4 });

    await fc.assert(
      fc.asyncProperty(countArb, async (bookmarkCount) => {
        const tagName = `remove-tag-${Date.now()}`;

        // Create bookmarks with the tag
        const allBookmarkIds: string[] = [];
        for (let i = 0; i < bookmarkCount + 2; i++) {
          const result = await createBookmarkForUser(testUserId, {
            url: `https://example.com/remove-test-${Date.now()}-${i}-${Math.random()}`,
            collectionId: testCollectionId,
            tags: [tagName],
          });
          if (result.success && result.bookmark) {
            allBookmarkIds.push(result.bookmark.id);
          }
        }

        const selectedIds = allBookmarkIds.slice(0, bookmarkCount);
        const unselectedIds = allBookmarkIds.slice(bookmarkCount);

        // Execute bulk remove tags
        const result = await executeBulkOperation(testUserId, {
          bookmarkIds: selectedIds,
          action: BulkActionType.REMOVE_TAGS,
          payload: { tags: [tagName] },
        });

        expect(result.success).toBe(true);
        expect(result.affectedCount).toBe(selectedIds.length);

        // Verify selected bookmarks no longer have the tag
        for (const bookmarkId of selectedIds) {
          const tags = await prisma.bookmarkTag.findMany({
            where: { bookmarkId },
            include: { tag: true },
          });
          const tagNamesOnBookmark = tags.map(t => t.tag.name);
          expect(tagNamesOnBookmark).not.toContain(tagName);
        }

        // Verify unselected bookmarks still have the tag
        for (const bookmarkId of unselectedIds) {
          const tags = await prisma.bookmarkTag.findMany({
            where: { bookmarkId },
            include: { tag: true },
          });
          const tagNamesOnBookmark = tags.map(t => t.tag.name);
          expect(tagNamesOnBookmark).toContain(tagName);
        }
      }),
      { numRuns: 10 }
    );
  });

  it('bulk move should move all selected bookmarks to target collection and no others', async () => {
    const countArb = fc.integer({ min: 2, max: 5 });

    await fc.assert(
      fc.asyncProperty(countArb, async (bookmarkCount) => {
        // Create bookmarks in first collection
        const allBookmarkIds = await createTestBookmarks(bookmarkCount + 2);
        const selectedIds = allBookmarkIds.slice(0, bookmarkCount);
        const unselectedIds = allBookmarkIds.slice(bookmarkCount);

        // Execute bulk move
        const result = await executeBulkOperation(testUserId, {
          bookmarkIds: selectedIds,
          action: BulkActionType.MOVE,
          payload: { collectionId: testCollection2Id },
        });

        expect(result.success).toBe(true);
        expect(result.affectedCount).toBe(selectedIds.length);

        // Verify selected bookmarks are in the new collection
        for (const bookmarkId of selectedIds) {
          const bookmark = await prisma.bookmark.findUnique({ where: { id: bookmarkId } });
          expect(bookmark?.collectionId).toBe(testCollection2Id);
        }

        // Verify unselected bookmarks are still in the original collection
        for (const bookmarkId of unselectedIds) {
          const bookmark = await prisma.bookmark.findUnique({ where: { id: bookmarkId } });
          expect(bookmark?.collectionId).toBe(testCollectionId);
        }
      }),
      { numRuns: 10 }
    );
  });

  it('bulk delete should delete all selected bookmarks and no others', async () => {
    const countArb = fc.integer({ min: 2, max: 5 });

    await fc.assert(
      fc.asyncProperty(countArb, async (bookmarkCount) => {
        // Create bookmarks
        const allBookmarkIds = await createTestBookmarks(bookmarkCount + 2);
        const selectedIds = allBookmarkIds.slice(0, bookmarkCount);
        const unselectedIds = allBookmarkIds.slice(bookmarkCount);

        // Execute bulk delete
        const result = await executeBulkOperation(testUserId, {
          bookmarkIds: selectedIds,
          action: BulkActionType.DELETE,
        });

        expect(result.success).toBe(true);
        expect(result.affectedCount).toBe(selectedIds.length);

        // Verify selected bookmarks are deleted
        for (const bookmarkId of selectedIds) {
          const bookmark = await prisma.bookmark.findUnique({ where: { id: bookmarkId } });
          expect(bookmark).toBeNull();
        }

        // Verify unselected bookmarks still exist
        for (const bookmarkId of unselectedIds) {
          const bookmark = await prisma.bookmark.findUnique({ where: { id: bookmarkId } });
          expect(bookmark).not.toBeNull();
        }
      }),
      { numRuns: 10 }
    );
  });

  it('bulk operations should not affect bookmarks owned by other users', async () => {
    // Create another user
    const otherUser = await prisma.user.create({
      data: {
        email: `other-user-${Date.now()}@test.com`,
        passwordHash: 'test-hash',
        name: 'Other User',
      },
    });

    const otherCollection = await prisma.collection.create({
      data: {
        ownerId: otherUser.id,
        title: 'Other Collection',
        icon: 'folder',
      },
    });

    // Create bookmark for other user
    const otherBookmark = await prisma.bookmark.create({
      data: {
        ownerId: otherUser.id,
        collectionId: otherCollection.id,
        url: 'https://example.com/other-user-bookmark',
        normalizedUrl: 'https://example.com/other-user-bookmark',
        title: 'Other User Bookmark',
        domain: 'example.com',
        type: 'ARTICLE',
      },
    });

    // Create bookmark for test user
    const testBookmarkIds = await createTestBookmarks(2);

    // Try to include other user's bookmark in bulk operation
    const result = await executeBulkOperation(testUserId, {
      bookmarkIds: [...testBookmarkIds, otherBookmark.id],
      action: BulkActionType.DELETE,
    });

    // Should only affect test user's bookmarks
    expect(result.success).toBe(true);
    expect(result.affectedCount).toBe(testBookmarkIds.length);

    // Other user's bookmark should still exist
    const otherBookmarkAfter = await prisma.bookmark.findUnique({
      where: { id: otherBookmark.id },
    });
    expect(otherBookmarkAfter).not.toBeNull();

    // Clean up other user's data
    await prisma.bookmark.deleteMany({ where: { ownerId: otherUser.id } });
    await prisma.collection.deleteMany({ where: { ownerId: otherUser.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });
});


describe('Sort Order Persistence', () => {
  /**
   * **Feature: bookmark-manager, Property 17: Sort Order Persistence**
   * **Validates: Requirements 14.4**
   *
   * For any manual reordering of bookmarks within a collection,
   * fetching the bookmarks should return them in the persisted order.
   */

  it('should persist and return bookmarks in the specified sort order', async () => {
    const countArb = fc.integer({ min: 3, max: 6 });

    await fc.assert(
      fc.asyncProperty(countArb, async (bookmarkCount) => {
        // Create bookmarks
        const bookmarkIds = await createTestBookmarks(bookmarkCount);

        // Generate a random permutation of sort orders
        const sortOrders = Array.from({ length: bookmarkCount }, (_, i) => i);
        // Shuffle the sort orders
        for (let i = sortOrders.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [sortOrders[i], sortOrders[j]] = [sortOrders[j]!, sortOrders[i]!];
        }

        // Create orders array with shuffled sort orders
        const orders = bookmarkIds.map((bookmarkId, index) => ({
          bookmarkId,
          sortOrder: sortOrders[index]!,
        }));

        // Execute reorder operation
        const result = await executeBulkOperation(testUserId, {
          bookmarkIds,
          action: BulkActionType.REORDER,
          payload: { orders },
        });

        expect(result.success).toBe(true);
        expect(result.affectedCount).toBe(bookmarkCount);

        // Fetch bookmarks sorted by sortOrder
        const bookmarks = await prisma.bookmark.findMany({
          where: {
            id: { in: bookmarkIds },
            ownerId: testUserId,
          },
          orderBy: { sortOrder: 'asc' },
        });

        // Verify the order matches what we set
        for (let i = 0; i < bookmarks.length; i++) {
          const bookmark = bookmarks[i]!;
          const expectedOrder = orders.find(o => o.bookmarkId === bookmark.id);
          expect(bookmark.sortOrder).toBe(expectedOrder?.sortOrder);
        }

        // Verify bookmarks are returned in ascending sortOrder
        for (let i = 1; i < bookmarks.length; i++) {
          expect(bookmarks[i]!.sortOrder).toBeGreaterThanOrEqual(bookmarks[i - 1]!.sortOrder);
        }
      }),
      { numRuns: 10 }
    );
  });

  it('should maintain sort order after other operations', async () => {
    // Create bookmarks with specific sort orders
    const bookmarkIds = await createTestBookmarks(4);

    // Set specific sort orders
    const orders = bookmarkIds.map((bookmarkId, index) => ({
      bookmarkId,
      sortOrder: (bookmarkIds.length - 1 - index) * 10, // Reverse order: 30, 20, 10, 0
    }));

    await executeBulkOperation(testUserId, {
      bookmarkIds,
      action: BulkActionType.REORDER,
      payload: { orders },
    });

    // Add a tag to some bookmarks (should not affect sort order)
    await executeBulkOperation(testUserId, {
      bookmarkIds: bookmarkIds.slice(0, 2),
      action: BulkActionType.ADD_TAGS,
      payload: { tags: ['test-tag'] },
    });

    // Verify sort orders are preserved
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        id: { in: bookmarkIds },
        ownerId: testUserId,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Verify the order is still as we set it
    for (const bookmark of bookmarks) {
      const expectedOrder = orders.find(o => o.bookmarkId === bookmark.id);
      expect(bookmark.sortOrder).toBe(expectedOrder?.sortOrder);
    }
  });

  it('should handle reordering with duplicate sort order values', async () => {
    // Create bookmarks
    const bookmarkIds = await createTestBookmarks(3);

    // Set sort orders with duplicates (allowed - just means undefined order among duplicates)
    const orders = [
      { bookmarkId: bookmarkIds[0]!, sortOrder: 1 },
      { bookmarkId: bookmarkIds[1]!, sortOrder: 1 }, // Same as first
      { bookmarkId: bookmarkIds[2]!, sortOrder: 2 },
    ];

    const result = await executeBulkOperation(testUserId, {
      bookmarkIds,
      action: BulkActionType.REORDER,
      payload: { orders },
    });

    expect(result.success).toBe(true);

    // Verify sort orders are set correctly
    for (const order of orders) {
      const bookmark = await prisma.bookmark.findUnique({
        where: { id: order.bookmarkId },
      });
      expect(bookmark?.sortOrder).toBe(order.sortOrder);
    }
  });
});
