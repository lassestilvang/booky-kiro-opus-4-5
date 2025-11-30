/**
 * Property-based tests for Tag Service
 * Tests business logic properties for tag operations
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../db/client.js';
import {
  createTagForUser,
  getTagSuggestionsForUser,
  mergeTagsForUser,
  getTagBookmarkCount,
} from './tag.service.js';
import { createBookmarkForUser } from './bookmark.service.js';
import { normalizeTagName } from '../models/tag.model.js';

// Test user for property tests
let testUserId: string;

// Arbitrary for generating tag names (alphanumeric with some special chars)
const tagNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9-]{1,20}$/);

beforeAll(async () => {
  // Create a test user
  const user = await prisma.user.create({
    data: {
      email: `test-tag-service-${Date.now()}@test.com`,
      passwordHash: 'test-hash',
      name: 'Test User',
    },
  });
  testUserId = user.id;
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
  // Clean up tags and bookmarks before each test
  await prisma.bookmarkTag.deleteMany({
    where: { bookmark: { ownerId: testUserId } },
  });
  await prisma.bookmark.deleteMany({ where: { ownerId: testUserId } });
  await prisma.tag.deleteMany({ where: { ownerId: testUserId } });
});


describe('Tag Suggestions Match Prefix', () => {
  /**
   * **Feature: bookmark-manager, Property 9: Tag Suggestions Match Prefix**
   * **Validates: Requirements 4.6**
   * 
   * For any tag suggestion query with a prefix, all returned tag suggestions
   * should start with that prefix (case-insensitive).
   */
  it('should return only tags that start with the given prefix', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a set of tag names
        fc.array(tagNameArb, { minLength: 3, maxLength: 10 }),
        // Generate a prefix to search for
        fc.stringMatching(/^[A-Za-z]{1,3}$/),
        async (tagNames, prefix) => {
          // Make tag names unique by adding random suffix
          const uniqueTagNames = tagNames.map(
            (name, i) => `${name}-${Date.now()}-${i}`
          );

          // Create tags
          const createdTagIds: string[] = [];
          for (const name of uniqueTagNames) {
            const result = await createTagForUser(testUserId, { name });
            if (result.success && result.tag) {
              createdTagIds.push(result.tag.id);
            }
          }

          // Get suggestions for the prefix
          const suggestions = await getTagSuggestionsForUser(testUserId, prefix);

          // Verify all suggestions start with the prefix (case-insensitive)
          const normalizedPrefix = prefix.toLowerCase();
          for (const tag of suggestions) {
            const normalizedTagName = tag.normalizedName;
            expect(normalizedTagName.startsWith(normalizedPrefix)).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should return empty array for empty prefix', async () => {
    // Create some tags first
    await createTagForUser(testUserId, { name: 'TestTag1' });
    await createTagForUser(testUserId, { name: 'TestTag2' });

    // Empty prefix should return empty array
    const suggestions = await getTagSuggestionsForUser(testUserId, '');
    expect(suggestions).toEqual([]);

    // Whitespace-only prefix should return empty array
    const suggestionsWhitespace = await getTagSuggestionsForUser(testUserId, '   ');
    expect(suggestionsWhitespace).toEqual([]);
  });

  it('should be case-insensitive when matching prefix', async () => {
    await fc.assert(
      fc.asyncProperty(
        tagNameArb,
        async (tagName) => {
          const uniqueTagName = `${tagName}-${Date.now()}`;
          
          // Create a tag
          const result = await createTagForUser(testUserId, { name: uniqueTagName });
          expect(result.success).toBe(true);

          // Get the first 2 characters as prefix
          const prefix = uniqueTagName.slice(0, 2);

          // Search with lowercase prefix
          const suggestionsLower = await getTagSuggestionsForUser(
            testUserId,
            prefix.toLowerCase()
          );

          // Search with uppercase prefix
          const suggestionsUpper = await getTagSuggestionsForUser(
            testUserId,
            prefix.toUpperCase()
          );

          // Both should find the tag
          const foundInLower = suggestionsLower.some(
            t => t.normalizedName === normalizeTagName(uniqueTagName)
          );
          const foundInUpper = suggestionsUpper.some(
            t => t.normalizedName === normalizeTagName(uniqueTagName)
          );

          expect(foundInLower).toBe(true);
          expect(foundInUpper).toBe(true);
        }
      ),
      { numRuns: 15 }
    );
  });
});



describe('Tag Merge Preserves Bookmark Count', () => {
  /**
   * **Feature: bookmark-manager, Property 10: Tag Merge Preserves Bookmark Count**
   * **Validates: Requirements 4.7**
   * 
   * For any tag merge operation, the total number of bookmarks associated with
   * the target tag after merge should equal the sum of bookmarks from both
   * source and target tags (minus duplicates - bookmarks that had both tags).
   */
  it('should preserve total bookmark count after merge (accounting for duplicates)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Number of bookmarks with only source tag
        fc.integer({ min: 1, max: 3 }),
        // Number of bookmarks with only target tag
        fc.integer({ min: 1, max: 3 }),
        // Number of bookmarks with both tags (duplicates)
        fc.integer({ min: 0, max: 2 }),
        async (sourceOnlyCount, targetOnlyCount, bothCount) => {
          // Create source and target tags
          const sourceTagName = `source-${Date.now()}-${Math.random()}`;
          const targetTagName = `target-${Date.now()}-${Math.random()}`;

          const sourceResult = await createTagForUser(testUserId, { name: sourceTagName });
          const targetResult = await createTagForUser(testUserId, { name: targetTagName });

          expect(sourceResult.success).toBe(true);
          expect(targetResult.success).toBe(true);

          const sourceTagId = sourceResult.tag!.id;
          const targetTagId = targetResult.tag!.id;

          // Create bookmarks with only source tag
          for (let i = 0; i < sourceOnlyCount; i++) {
            const url = `https://source-only.com/${Date.now()}-${i}-${Math.random()}`;
            await createBookmarkForUser(testUserId, {
              url,
              tags: [sourceTagName],
            });
          }

          // Create bookmarks with only target tag
          for (let i = 0; i < targetOnlyCount; i++) {
            const url = `https://target-only.com/${Date.now()}-${i}-${Math.random()}`;
            await createBookmarkForUser(testUserId, {
              url,
              tags: [targetTagName],
            });
          }

          // Create bookmarks with both tags
          for (let i = 0; i < bothCount; i++) {
            const url = `https://both-tags.com/${Date.now()}-${i}-${Math.random()}`;
            await createBookmarkForUser(testUserId, {
              url,
              tags: [sourceTagName, targetTagName],
            });
          }

          // Get counts before merge
          const sourceCountBefore = await getTagBookmarkCount(sourceTagId, testUserId);
          const targetCountBefore = await getTagBookmarkCount(targetTagId, testUserId);

          expect(sourceCountBefore.success).toBe(true);
          expect(targetCountBefore.success).toBe(true);

          // Expected: source has sourceOnlyCount + bothCount
          // Expected: target has targetOnlyCount + bothCount
          expect(sourceCountBefore.count).toBe(sourceOnlyCount + bothCount);
          expect(targetCountBefore.count).toBe(targetOnlyCount + bothCount);

          // Merge source into target
          const mergeResult = await mergeTagsForUser(sourceTagId, targetTagId, testUserId);
          expect(mergeResult.success).toBe(true);

          // Get count after merge
          const targetCountAfter = await getTagBookmarkCount(targetTagId, testUserId);
          expect(targetCountAfter.success).toBe(true);

          // Expected count after merge:
          // sourceOnlyCount + targetOnlyCount + bothCount
          // (duplicates are not double-counted)
          const expectedCount = sourceOnlyCount + targetOnlyCount + bothCount;
          expect(targetCountAfter.count).toBe(expectedCount);

          // Source tag should no longer exist
          const sourceCountAfter = await getTagBookmarkCount(sourceTagId, testUserId);
          expect(sourceCountAfter.success).toBe(false);
          expect(sourceCountAfter.errorCode).toBe('TAG_NOT_FOUND');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should not allow merging a tag into itself', async () => {
    const tagName = `self-merge-${Date.now()}`;
    const result = await createTagForUser(testUserId, { name: tagName });
    expect(result.success).toBe(true);

    const tagId = result.tag!.id;

    const mergeResult = await mergeTagsForUser(tagId, tagId, testUserId);
    expect(mergeResult.success).toBe(false);
    expect(mergeResult.errorCode).toBe('TAG_MERGE_SAME_TAG');
  });

  it('should fail when source tag does not exist', async () => {
    const targetTagName = `target-${Date.now()}`;
    const targetResult = await createTagForUser(testUserId, { name: targetTagName });
    expect(targetResult.success).toBe(true);

    const mergeResult = await mergeTagsForUser(
      'non-existent-id',
      targetResult.tag!.id,
      testUserId
    );
    expect(mergeResult.success).toBe(false);
    expect(mergeResult.errorCode).toBe('TAG_SOURCE_NOT_FOUND');
  });

  it('should fail when target tag does not exist', async () => {
    const sourceTagName = `source-${Date.now()}`;
    const sourceResult = await createTagForUser(testUserId, { name: sourceTagName });
    expect(sourceResult.success).toBe(true);

    const mergeResult = await mergeTagsForUser(
      sourceResult.tag!.id,
      'non-existent-id',
      testUserId
    );
    expect(mergeResult.success).toBe(false);
    expect(mergeResult.errorCode).toBe('TAG_TARGET_NOT_FOUND');
  });
});
