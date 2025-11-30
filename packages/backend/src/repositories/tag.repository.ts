/**
 * Tag Repository - Database operations for tags
 * Requirements: 4.1, 4.6, 4.7
 */
import { prisma } from '../db/client.js';
import type { Tag } from '../models/tag.model.js';

export interface CreateTagData {
  ownerId: string;
  name: string;
  normalizedName: string;
  color?: string | null;
}

export interface UpdateTagData {
  name?: string;
  normalizedName?: string;
  color?: string | null;
}

/**
 * Creates a new tag in the database
 * Requirements: 4.1
 */
export async function createTag(data: CreateTagData): Promise<Tag> {
  const tag = await prisma.tag.create({
    data: {
      ownerId: data.ownerId,
      name: data.name,
      normalizedName: data.normalizedName,
      color: data.color ?? null,
    },
  });

  return tag as Tag;
}

/**
 * Finds a tag by ID
 */
export async function findTagById(id: string): Promise<Tag | null> {
  const tag = await prisma.tag.findUnique({
    where: { id },
  });

  return tag as Tag | null;
}

/**
 * Finds a tag by ID with ownership check
 */
export async function findTagByIdAndOwner(
  id: string,
  ownerId: string
): Promise<Tag | null> {
  const tag = await prisma.tag.findFirst({
    where: { id, ownerId },
  });

  return tag as Tag | null;
}


/**
 * Finds a tag by normalized name for a user
 */
export async function findTagByNormalizedName(
  normalizedName: string,
  ownerId: string
): Promise<Tag | null> {
  const tag = await prisma.tag.findFirst({
    where: { normalizedName, ownerId },
  });

  return tag as Tag | null;
}

/**
 * Finds all tags for a user
 * Requirements: 4.1
 */
export async function findTagsByOwner(ownerId: string): Promise<Tag[]> {
  const tags = await prisma.tag.findMany({
    where: { ownerId },
    orderBy: { name: 'asc' },
  });

  return tags as Tag[];
}

/**
 * Finds tags with bookmark counts for a user
 */
export async function findTagsWithBookmarkCounts(
  ownerId: string
): Promise<(Tag & { _count: { bookmarks: number } })[]> {
  const tags = await prisma.tag.findMany({
    where: { ownerId },
    include: {
      _count: {
        select: { bookmarks: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return tags as (Tag & { _count: { bookmarks: number } })[];
}

/**
 * Gets tag suggestions based on prefix matching
 * Requirements: 4.6
 */
export async function getTagSuggestions(
  ownerId: string,
  prefix: string,
  limit: number = 10
): Promise<Tag[]> {
  const normalizedPrefix = prefix.toLowerCase().trim();
  
  const tags = await prisma.tag.findMany({
    where: {
      ownerId,
      normalizedName: {
        startsWith: normalizedPrefix,
      },
    },
    orderBy: [
      // Order by usage count (most used first)
      { bookmarks: { _count: 'desc' } },
      { name: 'asc' },
    ],
    take: limit,
  });

  return tags as Tag[];
}


/**
 * Updates a tag
 */
export async function updateTag(
  id: string,
  ownerId: string,
  data: UpdateTagData
): Promise<Tag | null> {
  // First verify ownership
  const existing = await findTagByIdAndOwner(id, ownerId);
  if (!existing) {
    return null;
  }

  const tag = await prisma.tag.update({
    where: { id },
    data,
  });

  return tag as Tag;
}

/**
 * Deletes a tag
 * Note: BookmarkTag associations are cascade deleted via Prisma schema
 */
export async function deleteTag(id: string, ownerId: string): Promise<boolean> {
  // First verify ownership
  const existing = await findTagByIdAndOwner(id, ownerId);
  if (!existing) {
    return false;
  }

  await prisma.tag.delete({
    where: { id },
  });

  return true;
}

/**
 * Gets all bookmark IDs associated with a tag
 */
export async function getBookmarkIdsByTag(tagId: string): Promise<string[]> {
  const bookmarkTags = await prisma.bookmarkTag.findMany({
    where: { tagId },
    select: { bookmarkId: true },
  });

  return bookmarkTags.map(bt => bt.bookmarkId);
}

/**
 * Counts bookmarks associated with a tag
 */
export async function countBookmarksByTag(tagId: string): Promise<number> {
  return prisma.bookmarkTag.count({
    where: { tagId },
  });
}

/**
 * Merges source tag into target tag
 * Requirements: 4.7
 * 
 * This operation:
 * 1. Moves all bookmark associations from source to target
 * 2. Deletes the source tag
 * 3. Returns the count of affected bookmarks
 */
export async function mergeTags(
  sourceTagId: string,
  targetTagId: string,
  ownerId: string
): Promise<{ success: boolean; affectedBookmarks: number }> {
  // Verify both tags exist and belong to the user
  const sourceTag = await findTagByIdAndOwner(sourceTagId, ownerId);
  const targetTag = await findTagByIdAndOwner(targetTagId, ownerId);

  if (!sourceTag || !targetTag) {
    return { success: false, affectedBookmarks: 0 };
  }

  // Get all bookmark IDs associated with source tag
  const sourceBookmarkIds = await getBookmarkIdsByTag(sourceTagId);

  // Get all bookmark IDs already associated with target tag
  const targetBookmarkIds = await getBookmarkIdsByTag(targetTagId);
  const targetBookmarkIdSet = new Set(targetBookmarkIds);

  // Find bookmarks that need new associations (not already linked to target)
  const bookmarksToLink = sourceBookmarkIds.filter(id => !targetBookmarkIdSet.has(id));

  // Create new associations for target tag
  if (bookmarksToLink.length > 0) {
    await prisma.bookmarkTag.createMany({
      data: bookmarksToLink.map(bookmarkId => ({
        bookmarkId,
        tagId: targetTagId,
      })),
      skipDuplicates: true,
    });
  }

  // Delete the source tag (cascade deletes its BookmarkTag associations)
  await prisma.tag.delete({
    where: { id: sourceTagId },
  });

  return {
    success: true,
    affectedBookmarks: sourceBookmarkIds.length,
  };
}

/**
 * Gets or creates a tag by name for a user
 */
export async function getOrCreateTag(
  ownerId: string,
  name: string,
  normalizedName: string
): Promise<Tag> {
  // Try to find existing tag
  const existing = await findTagByNormalizedName(normalizedName, ownerId);
  if (existing) {
    return existing;
  }

  // Create new tag
  return createTag({
    ownerId,
    name: name.trim(),
    normalizedName,
  });
}
