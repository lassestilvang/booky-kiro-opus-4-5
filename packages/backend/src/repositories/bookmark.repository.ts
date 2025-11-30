/**
 * Bookmark Repository - Database operations for bookmarks
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
import { prisma } from '../db/client.js';
import type { Bookmark, BookmarkType } from '../models/bookmark.model.js';
import type { Prisma } from '@prisma/client';

export interface BookmarkFilters {
  collectionId?: string;
  tags?: string[];
  type?: BookmarkType;
  domain?: string;
  dateFrom?: Date;
  dateTo?: Date;
  isFavorite?: boolean;
  isBroken?: boolean;
  isDuplicate?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'sortOrder';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateBookmarkData {
  ownerId: string;
  collectionId: string;
  url: string;
  normalizedUrl: string;
  title: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  domain: string;
  type: BookmarkType;
  note?: string | null;
  isDuplicate?: boolean;
}

export interface UpdateBookmarkData {
  collectionId?: string;
  title?: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  note?: string | null;
  isFavorite?: boolean;
  isBroken?: boolean;
  sortOrder?: number;
  contentSnapshotPath?: string | null;
  contentIndexed?: boolean;
}


/**
 * Creates a new bookmark in the database
 */
export async function createBookmark(data: CreateBookmarkData): Promise<Bookmark> {
  const bookmark = await prisma.bookmark.create({
    data: {
      ownerId: data.ownerId,
      collectionId: data.collectionId,
      url: data.url,
      normalizedUrl: data.normalizedUrl,
      title: data.title,
      excerpt: data.excerpt ?? null,
      coverUrl: data.coverUrl ?? null,
      domain: data.domain,
      type: data.type,
      note: data.note ?? null,
      isDuplicate: data.isDuplicate ?? false,
    },
  });

  return bookmark as Bookmark;
}

/**
 * Finds a bookmark by ID
 */
export async function findBookmarkById(id: string): Promise<Bookmark | null> {
  const bookmark = await prisma.bookmark.findUnique({
    where: { id },
  });

  return bookmark as Bookmark | null;
}

/**
 * Finds a bookmark by ID with ownership check
 */
export async function findBookmarkByIdAndOwner(
  id: string,
  ownerId: string
): Promise<Bookmark | null> {
  const bookmark = await prisma.bookmark.findFirst({
    where: { id, ownerId },
  });

  return bookmark as Bookmark | null;
}

/**
 * Finds bookmarks by normalized URL for duplicate detection
 */
export async function findBookmarksByNormalizedUrl(
  normalizedUrl: string,
  ownerId: string
): Promise<Bookmark[]> {
  const bookmarks = await prisma.bookmark.findMany({
    where: { normalizedUrl, ownerId },
  });

  return bookmarks as Bookmark[];
}


/**
 * Finds bookmarks by user with filters and pagination
 */
export async function findBookmarksByUser(
  ownerId: string,
  filters: BookmarkFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<Bookmark>> {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = pagination;

  const where: Prisma.BookmarkWhereInput = { ownerId };

  // Apply filters
  if (filters.collectionId) {
    where.collectionId = filters.collectionId;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.domain) {
    where.domain = filters.domain;
  }

  if (filters.isFavorite !== undefined) {
    where.isFavorite = filters.isFavorite;
  }

  if (filters.isBroken !== undefined) {
    where.isBroken = filters.isBroken;
  }

  if (filters.isDuplicate !== undefined) {
    where.isDuplicate = filters.isDuplicate;
  }

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      where.createdAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.createdAt.lte = filters.dateTo;
    }
  }

  // Tag filter - bookmarks must have ALL specified tags (AND logic)
  // Requirements: 4.2
  if (filters.tags && filters.tags.length > 0) {
    const normalizedTags = filters.tags.map(t => t.toLowerCase());
    // Use AND logic: bookmark must have every specified tag
    where.AND = normalizedTags.map(tagName => ({
      tags: {
        some: {
          tag: {
            normalizedName: tagName,
          },
        },
      },
    }));
  }

  // Simple text search on title and excerpt
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { excerpt: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  // Get total count
  const total = await prisma.bookmark.count({ where });

  // Get paginated results
  const bookmarks = await prisma.bookmark.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data: bookmarks as Bookmark[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}


/**
 * Updates a bookmark
 */
export async function updateBookmark(
  id: string,
  ownerId: string,
  data: UpdateBookmarkData
): Promise<Bookmark | null> {
  // First verify ownership
  const existing = await findBookmarkByIdAndOwner(id, ownerId);
  if (!existing) {
    return null;
  }

  const bookmark = await prisma.bookmark.update({
    where: { id },
    data,
  });

  return bookmark as Bookmark;
}

/**
 * Deletes a bookmark and all associated data
 * Cascade delete handles highlights and tag associations via Prisma schema
 */
export async function deleteBookmark(id: string, ownerId: string): Promise<boolean> {
  // First verify ownership
  const existing = await findBookmarkByIdAndOwner(id, ownerId);
  if (!existing) {
    return false;
  }

  await prisma.bookmark.delete({
    where: { id },
  });

  return true;
}

/**
 * Gets bookmark with tags
 */
export async function findBookmarkWithTags(
  id: string,
  ownerId: string
): Promise<(Bookmark & { tags: { tag: { id: string; name: string } }[] }) | null> {
  const bookmark = await prisma.bookmark.findFirst({
    where: { id, ownerId },
    include: {
      tags: {
        include: {
          tag: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  return bookmark as (Bookmark & { tags: { tag: { id: string; name: string } }[] }) | null;
}

/**
 * Adds tags to a bookmark
 */
export async function addTagsToBookmark(
  bookmarkId: string,
  tagIds: string[]
): Promise<void> {
  await prisma.bookmarkTag.createMany({
    data: tagIds.map(tagId => ({
      bookmarkId,
      tagId,
    })),
    skipDuplicates: true,
  });
}

/**
 * Removes tags from a bookmark
 */
export async function removeTagsFromBookmark(
  bookmarkId: string,
  tagIds: string[]
): Promise<void> {
  await prisma.bookmarkTag.deleteMany({
    where: {
      bookmarkId,
      tagId: { in: tagIds },
    },
  });
}

/**
 * Gets all tag IDs associated with a bookmark
 */
export async function getBookmarkTagIds(bookmarkId: string): Promise<string[]> {
  const tags = await prisma.bookmarkTag.findMany({
    where: { bookmarkId },
    select: { tagId: true },
  });

  return tags.map(t => t.tagId);
}

/**
 * Counts bookmarks in a collection
 */
export async function countBookmarksInCollection(collectionId: string): Promise<number> {
  return prisma.bookmark.count({
    where: { collectionId },
  });
}

/**
 * Moves bookmarks to a different collection
 */
export async function moveBookmarksToCollection(
  bookmarkIds: string[],
  collectionId: string,
  ownerId: string
): Promise<number> {
  const result = await prisma.bookmark.updateMany({
    where: {
      id: { in: bookmarkIds },
      ownerId,
    },
    data: { collectionId },
  });

  return result.count;
}

/**
 * Bulk delete bookmarks
 */
export async function deleteBookmarks(
  bookmarkIds: string[],
  ownerId: string
): Promise<number> {
  const result = await prisma.bookmark.deleteMany({
    where: {
      id: { in: bookmarkIds },
      ownerId,
    },
  });

  return result.count;
}

/**
 * Updates sort order for bookmarks
 */
export async function updateBookmarkSortOrder(
  bookmarkId: string,
  sortOrder: number,
  ownerId: string
): Promise<boolean> {
  const result = await prisma.bookmark.updateMany({
    where: { id: bookmarkId, ownerId },
    data: { sortOrder },
  });

  return result.count > 0;
}

/**
 * Bulk updates sort order for multiple bookmarks
 * Requirements: 14.4
 */
export async function bulkUpdateSortOrder(
  bookmarkOrders: { bookmarkId: string; sortOrder: number }[],
  ownerId: string
): Promise<number> {
  let updatedCount = 0;
  
  // Use a transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    for (const { bookmarkId, sortOrder } of bookmarkOrders) {
      const result = await tx.bookmark.updateMany({
        where: { id: bookmarkId, ownerId },
        data: { sortOrder },
      });
      updatedCount += result.count;
    }
  });

  return updatedCount;
}

/**
 * Bulk add tags to multiple bookmarks
 * Requirements: 14.1
 */
export async function bulkAddTagsToBookmarks(
  bookmarkIds: string[],
  tagIds: string[],
  ownerId: string
): Promise<number> {
  // First verify all bookmarks belong to the owner
  const validBookmarks = await prisma.bookmark.findMany({
    where: {
      id: { in: bookmarkIds },
      ownerId,
    },
    select: { id: true },
  });

  const validBookmarkIds = validBookmarks.map(b => b.id);
  
  // Create tag associations for all valid bookmarks
  const data = validBookmarkIds.flatMap(bookmarkId =>
    tagIds.map(tagId => ({
      bookmarkId,
      tagId,
    }))
  );

  if (data.length === 0) {
    return 0;
  }

  await prisma.bookmarkTag.createMany({
    data,
    skipDuplicates: true,
  });

  return validBookmarkIds.length;
}

/**
 * Bulk remove tags from multiple bookmarks
 * Requirements: 14.1
 */
export async function bulkRemoveTagsFromBookmarks(
  bookmarkIds: string[],
  tagIds: string[],
  ownerId: string
): Promise<number> {
  // First verify all bookmarks belong to the owner
  const validBookmarks = await prisma.bookmark.findMany({
    where: {
      id: { in: bookmarkIds },
      ownerId,
    },
    select: { id: true },
  });

  const validBookmarkIds = validBookmarks.map(b => b.id);

  if (validBookmarkIds.length === 0) {
    return 0;
  }

  await prisma.bookmarkTag.deleteMany({
    where: {
      bookmarkId: { in: validBookmarkIds },
      tagId: { in: tagIds },
    },
  });

  return validBookmarkIds.length;
}

/**
 * Gets bookmarks by IDs with ownership check
 */
export async function findBookmarksByIds(
  bookmarkIds: string[],
  ownerId: string
): Promise<Bookmark[]> {
  const bookmarks = await prisma.bookmark.findMany({
    where: {
      id: { in: bookmarkIds },
      ownerId,
    },
  });

  return bookmarks as Bookmark[];
}

/**
 * Gets bookmarks by IDs with their tags
 */
export async function findBookmarksByIdsWithTags(
  bookmarkIds: string[],
  ownerId: string
): Promise<(Bookmark & { tags: { tagId: string }[] })[]> {
  const bookmarks = await prisma.bookmark.findMany({
    where: {
      id: { in: bookmarkIds },
      ownerId,
    },
    include: {
      tags: {
        select: { tagId: true },
      },
    },
  });

  return bookmarks as (Bookmark & { tags: { tagId: string }[] })[];
}
