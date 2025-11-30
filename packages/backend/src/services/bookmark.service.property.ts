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



describe('Filter Results Satisfy Filter Criteria', () => {
  /**
   * **Feature: bookmark-manager, Property 8: Filter Results Satisfy Filter Criteria**
   * **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
   * 
   * For any bookmark filter query (by tags, type, domain, or date range),
   * all returned bookmarks should satisfy all specified filter criteria.
   */
  it('should return only bookmarks matching tag filter (AND logic)', async () => {
    // Create bookmarks with different tag combinations
    const tag1 = `tag1-${Date.now()}`;
    const tag2 = `tag2-${Date.now()}`;
    const tag3 = `tag3-${Date.now()}`;

    // Bookmark with tag1 only
    const b1 = await createBookmarkForUser(testUserId, {
      url: `https://example.com/b1-${Date.now()}`,
      collectionId: testCollectionId,
      tags: [tag1],
    });

    // Bookmark with tag1 and tag2
    const b2 = await createBookmarkForUser(testUserId, {
      url: `https://example.com/b2-${Date.now()}`,
      collectionId: testCollectionId,
      tags: [tag1, tag2],
    });

    // Bookmark with all three tags
    const b3 = await createBookmarkForUser(testUserId, {
      url: `https://example.com/b3-${Date.now()}`,
      collectionId: testCollectionId,
      tags: [tag1, tag2, tag3],
    });

    // Import listBookmarks
    const { listBookmarks } = await import('./bookmark.service.js');

    // Filter by tag1 only - should return all 3
    const result1 = await listBookmarks(testUserId, { tags: [tag1] });
    expect(result1.data.length).toBe(3);

    // Filter by tag1 AND tag2 - should return b2 and b3
    const result2 = await listBookmarks(testUserId, { tags: [tag1, tag2] });
    expect(result2.data.length).toBe(2);
    const ids2 = result2.data.map(b => b.id);
    expect(ids2).toContain(b2.bookmark!.id);
    expect(ids2).toContain(b3.bookmark!.id);
    expect(ids2).not.toContain(b1.bookmark!.id);

    // Filter by all three tags - should return only b3
    const result3 = await listBookmarks(testUserId, { tags: [tag1, tag2, tag3] });
    expect(result3.data.length).toBe(1);
    expect(result3.data[0]?.id).toBe(b3.bookmark!.id);

    // Clean up
    await deleteBookmarkForUser(b1.bookmark!.id, testUserId);
    await deleteBookmarkForUser(b2.bookmark!.id, testUserId);
    await deleteBookmarkForUser(b3.bookmark!.id, testUserId);
  });

  it('should return only bookmarks matching type filter', async () => {
    const typeArb = fc.constantFrom('ARTICLE', 'VIDEO', 'IMAGE') as fc.Arbitrary<'ARTICLE' | 'VIDEO' | 'IMAGE'>;

    await fc.assert(
      fc.asyncProperty(typeArb, async (filterType) => {
        const { listBookmarks } = await import('./bookmark.service.js');

        // Create bookmarks of different types
        const articleUrl = `https://example.com/article-${Date.now()}-${Math.random()}`;
        const videoUrl = `https://youtube.com/watch?v=${Date.now()}`;
        const imageUrl = `https://imgur.com/image-${Date.now()}.jpg`;

        const article = await createBookmarkForUser(testUserId, {
          url: articleUrl,
          collectionId: testCollectionId,
        });
        const video = await createBookmarkForUser(testUserId, {
          url: videoUrl,
          collectionId: testCollectionId,
        });
        const image = await createBookmarkForUser(testUserId, {
          url: imageUrl,
          collectionId: testCollectionId,
        });

        // Filter by type
        const result = await listBookmarks(testUserId, { type: filterType });

        // All results should match the filter type
        for (const bookmark of result.data) {
          expect(bookmark.type).toBe(filterType);
        }

        // Clean up
        await deleteBookmarkForUser(article.bookmark!.id, testUserId);
        await deleteBookmarkForUser(video.bookmark!.id, testUserId);
        await deleteBookmarkForUser(image.bookmark!.id, testUserId);
      }),
      { numRuns: 3 }
    );
  });

  it('should return only bookmarks matching domain filter', async () => {
    const { listBookmarks } = await import('./bookmark.service.js');

    // Create bookmarks from different domains
    const b1 = await createBookmarkForUser(testUserId, {
      url: `https://example.com/page-${Date.now()}`,
      collectionId: testCollectionId,
    });
    const b2 = await createBookmarkForUser(testUserId, {
      url: `https://test.org/page-${Date.now()}`,
      collectionId: testCollectionId,
    });
    const b3 = await createBookmarkForUser(testUserId, {
      url: `https://demo.net/page-${Date.now()}`,
      collectionId: testCollectionId,
    });

    // Filter by domain
    const result = await listBookmarks(testUserId, { domain: 'example.com' });

    // All results should be from example.com
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    for (const bookmark of result.data) {
      expect(bookmark.domain).toBe('example.com');
    }

    // Clean up
    await deleteBookmarkForUser(b1.bookmark!.id, testUserId);
    await deleteBookmarkForUser(b2.bookmark!.id, testUserId);
    await deleteBookmarkForUser(b3.bookmark!.id, testUserId);
  });

  it('should return only bookmarks within date range filter', async () => {
    const { listBookmarks } = await import('./bookmark.service.js');

    // Create a bookmark
    const bookmark = await createBookmarkForUser(testUserId, {
      url: `https://example.com/dated-${Date.now()}`,
      collectionId: testCollectionId,
    });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Filter with date range that includes today
    const resultIncluded = await listBookmarks(testUserId, {
      dateFrom: yesterday,
      dateTo: tomorrow,
    });
    expect(resultIncluded.data.some(b => b.id === bookmark.bookmark!.id)).toBe(true);

    // Filter with date range in the past
    const resultExcluded = await listBookmarks(testUserId, {
      dateFrom: lastWeek,
      dateTo: yesterday,
    });
    expect(resultExcluded.data.some(b => b.id === bookmark.bookmark!.id)).toBe(false);

    // Clean up
    await deleteBookmarkForUser(bookmark.bookmark!.id, testUserId);
  });

  it('should apply multiple filters together', async () => {
    const { listBookmarks } = await import('./bookmark.service.js');

    const tag = `multi-filter-${Date.now()}`;

    // Create bookmarks with different combinations
    const b1 = await createBookmarkForUser(testUserId, {
      url: `https://example.com/multi1-${Date.now()}`,
      collectionId: testCollectionId,
      tags: [tag],
    });
    const b2 = await createBookmarkForUser(testUserId, {
      url: `https://test.org/multi2-${Date.now()}`,
      collectionId: testCollectionId,
      tags: [tag],
    });
    const b3 = await createBookmarkForUser(testUserId, {
      url: `https://example.com/multi3-${Date.now()}`,
      collectionId: testCollectionId,
    });

    // Filter by both tag AND domain
    const result = await listBookmarks(testUserId, {
      tags: [tag],
      domain: 'example.com',
    });

    // Should only return b1 (has tag AND is from example.com)
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.id).toBe(b1.bookmark!.id);

    // Clean up
    await deleteBookmarkForUser(b1.bookmark!.id, testUserId);
    await deleteBookmarkForUser(b2.bookmark!.id, testUserId);
    await deleteBookmarkForUser(b3.bookmark!.id, testUserId);
  });
});
