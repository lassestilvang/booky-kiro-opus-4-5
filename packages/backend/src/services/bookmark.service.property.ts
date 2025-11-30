/**
 * Property-based tests for Bookmark Service
 * Tests business logic properties for bookmark operations
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../db/client.js';
import {
  createBookmarkForUser,
  deleteBookmarkForUser,
} from './bookmark.service.js';
import { normalizeURL } from '../utils/url-normalizer.js';

// Test user for property tests
let testUserId: string;
let testCollectionId: string;

// Arbitrary for generating URLs with various paths
const urlWithPathArb = fc.tuple(
  fc.constantFrom('https://example.com', 'https://test.org', 'https://demo.net'),
  fc.array(fc.stringMatching(/^[a-z0-9-]+$/), { minLength: 0, maxLength: 3 })
).map(([base, pathParts]) => {
  const path = pathParts.length > 0 ? '/' + pathParts.join('/') : '';
  return base + path;
});

beforeAll(async () => {
  // Create a test user
  const user = await prisma.user.create({
    data: {
      email: `test-bookmark-service-${Date.now()}@test.com`,
      passwordHash: 'test-hash',
      name: 'Test User',
    },
  });
  testUserId = user.id;

  // Create a test collection
  const collection = await prisma.collection.create({
    data: {
      ownerId: testUserId,
      title: 'Test Collection',
      icon: 'folder',
    },
  });
  testCollectionId = collection.id;
});


afterAll(async () => {
  // Clean up test data
  await prisma.bookmark.deleteMany({ where: { ownerId: testUserId } });
  await prisma.collection.deleteMany({ where: { ownerId: testUserId } });
  await prisma.tag.deleteMany({ where: { ownerId: testUserId } });
  await prisma.user.delete({ where: { id: testUserId } });
});

beforeEach(async () => {
  // Clean up bookmarks before each test
  await prisma.bookmark.deleteMany({ where: { ownerId: testUserId } });
});

describe('Bookmark Creation Populates Required Fields', () => {
  /**
   * **Feature: bookmark-manager, Property 12: Bookmark Creation Populates Required Fields**
   * **Validates: Requirements 2.1, 2.2**
   * 
   * For any valid URL submitted for bookmark creation, the resulting bookmark
   * should have non-empty title, domain, type, ownerId, and timestamps.
   */
  it('should populate all required fields for any valid URL', async () => {
    await fc.assert(
      fc.asyncProperty(urlWithPathArb, async (url) => {
        const result = await createBookmarkForUser(testUserId, {
          url,
          collectionId: testCollectionId,
        });

        expect(result.success).toBe(true);
        expect(result.bookmark).toBeDefined();

        const bookmark = result.bookmark!;

        // Required fields must be populated
        expect(bookmark.id).toBeTruthy();
        expect(bookmark.ownerId).toBe(testUserId);
        expect(bookmark.collectionId).toBe(testCollectionId);
        expect(bookmark.title).toBeTruthy();
        expect(bookmark.title.length).toBeGreaterThan(0);
        expect(bookmark.domain).toBeTruthy();
        expect(bookmark.domain.length).toBeGreaterThan(0);
        expect(bookmark.type).toBeTruthy();
        expect(['LINK', 'ARTICLE', 'VIDEO', 'IMAGE', 'DOCUMENT', 'AUDIO']).toContain(bookmark.type);
        expect(bookmark.url).toBe(url);
        expect(bookmark.normalizedUrl).toBeTruthy();
        expect(bookmark.createdAt).toBeInstanceOf(Date);
        expect(bookmark.updatedAt).toBeInstanceOf(Date);

        // Clean up
        await deleteBookmarkForUser(bookmark.id, testUserId);
      }),
      { numRuns: 20 } // Reduced runs due to database operations
    );
  });
});


describe('Duplicate Detection Uses Normalized URLs', () => {
  /**
   * **Feature: bookmark-manager, Property 11: Duplicate Detection Uses Normalized URLs**
   * **Validates: Requirements 17.1, 17.2**
   * 
   * For any two URLs that normalize to the same value, saving both should
   * result in the second being flagged as a duplicate.
   */
  it('should detect duplicates using normalized URLs', async () => {
    // Generate pairs of URLs that normalize to the same value
    const urlVariationsArb: fc.Arbitrary<[string, string]> = fc.constantFrom(
      // Same URL with different tracking params
      ['https://example.com/page?utm_source=test', 'https://example.com/page?utm_campaign=other'] as [string, string],
      // Same URL with/without trailing slash
      ['https://example.com/page/', 'https://example.com/page'] as [string, string],
      // Same URL with different case in host
      ['https://EXAMPLE.com/page', 'https://example.com/page'] as [string, string],
      // Same URL with default port
      ['https://example.com:443/page', 'https://example.com/page'] as [string, string],
    );

    await fc.assert(
      fc.asyncProperty(urlVariationsArb, async (urlPair) => {
        const [url1, url2] = urlPair;
        // Verify they normalize to the same value
        const normalized1 = normalizeURL(url1);
        const normalized2 = normalizeURL(url2);
        expect(normalized1).toBe(normalized2);

        // Create first bookmark
        const result1 = await createBookmarkForUser(testUserId, {
          url: url1,
          collectionId: testCollectionId,
        });
        expect(result1.success).toBe(true);
        expect(result1.bookmark!.isDuplicate).toBe(false);

        // Create second bookmark with URL that normalizes to same value
        const result2 = await createBookmarkForUser(testUserId, {
          url: url2,
          collectionId: testCollectionId,
        });
        expect(result2.success).toBe(true);
        expect(result2.bookmark!.isDuplicate).toBe(true);

        // Clean up
        await deleteBookmarkForUser(result1.bookmark!.id, testUserId);
        await deleteBookmarkForUser(result2.bookmark!.id, testUserId);
      }),
      { numRuns: 4 } // Limited runs since we have specific test cases
    );
  });

  it('should not flag as duplicate when URLs normalize differently', async () => {
    const url1Options = [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://other.com/page',
      'https://test.org/different'
    ] as const;
    const url2Options = [
      'https://example.com/other',
      'https://different.com/page',
      'https://another.org/path'
    ] as const;
    
    const differentUrlsArb = fc.tuple(
      fc.constantFrom(...url1Options),
      fc.constantFrom(...url2Options)
    ).filter(([u1, u2]) => normalizeURL(u1) !== normalizeURL(u2));

    await fc.assert(
      fc.asyncProperty(differentUrlsArb, async (urlPair) => {
        const [url1, url2] = urlPair;
        // Create first bookmark
        const result1 = await createBookmarkForUser(testUserId, {
          url: url1,
          collectionId: testCollectionId,
        });
        expect(result1.success).toBe(true);

        // Create second bookmark with different normalized URL
        const result2 = await createBookmarkForUser(testUserId, {
          url: url2,
          collectionId: testCollectionId,
        });
        expect(result2.success).toBe(true);
        expect(result2.bookmark!.isDuplicate).toBe(false);

        // Clean up
        await deleteBookmarkForUser(result1.bookmark!.id, testUserId);
        await deleteBookmarkForUser(result2.bookmark!.id, testUserId);
      }),
      { numRuns: 10 }
    );
  });
});


describe('Bookmark Deletion Removes Associated Data', () => {
  /**
   * **Feature: bookmark-manager, Property 13: Bookmark Deletion Removes Associated Data**
   * **Validates: Requirements 2.5**
   * 
   * For any bookmark with associated highlights and tags, deleting the bookmark
   * should result in zero highlights and zero tag associations remaining for that bookmark ID.
   */
  it('should remove all associated data when bookmark is deleted', async () => {
    const tagNamesArb = fc.array(
      fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
      { minLength: 1, maxLength: 3 }
    );

    await fc.assert(
      fc.asyncProperty(tagNamesArb, async (tagNames) => {
        // Create a bookmark with tags
        const result = await createBookmarkForUser(testUserId, {
          url: `https://example.com/test-${Date.now()}-${Math.random()}`,
          collectionId: testCollectionId,
          tags: tagNames,
        });
        expect(result.success).toBe(true);
        const bookmarkId = result.bookmark!.id;

        // Create a highlight for this bookmark
        await prisma.highlight.create({
          data: {
            bookmarkId,
            ownerId: testUserId,
            textSelected: 'Test highlight text',
            color: 'YELLOW',
            positionContext: { startOffset: 0, endOffset: 10, containerSelector: 'p', surroundingText: '' },
          },
        });

        // Verify data exists before deletion
        const tagsBefore = await prisma.bookmarkTag.count({ where: { bookmarkId } });
        const highlightsBefore = await prisma.highlight.count({ where: { bookmarkId } });
        expect(tagsBefore).toBeGreaterThan(0);
        expect(highlightsBefore).toBe(1);

        // Delete the bookmark
        const deleteResult = await deleteBookmarkForUser(bookmarkId, testUserId);
        expect(deleteResult.success).toBe(true);

        // Verify all associated data is removed
        const tagsAfter = await prisma.bookmarkTag.count({ where: { bookmarkId } });
        const highlightsAfter = await prisma.highlight.count({ where: { bookmarkId } });
        expect(tagsAfter).toBe(0);
        expect(highlightsAfter).toBe(0);

        // Verify bookmark itself is gone
        const bookmarkAfter = await prisma.bookmark.findUnique({ where: { id: bookmarkId } });
        expect(bookmarkAfter).toBeNull();
      }),
      { numRuns: 10 }
    );
  });
});
