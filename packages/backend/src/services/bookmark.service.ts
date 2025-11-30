/**
 * Bookmark Service - Business logic for bookmark operations
 * Requirements: 2.1, 2.2, 2.4, 2.6, 17.1, 17.2
 */
import {
  createBookmark,
  findBookmarkByIdAndOwner,
  findBookmarksByNormalizedUrl,
  findBookmarksByUser,
  findBookmarkWithTags,
  updateBookmark,
  deleteBookmark,
  addTagsToBookmark,
  removeTagsFromBookmark,
  getBookmarkTagIds,
  type BookmarkFilters,
  type PaginationOptions,
  type PaginatedResult,
} from '../repositories/bookmark.repository.js';
import { prisma } from '../db/client.js';
import type { Bookmark, CreateBookmarkDTO, UpdateBookmarkDTO } from '../models/bookmark.model.js';
import { BookmarkType } from '../models/bookmark.model.js';
import { normalizeURL, extractDomain } from '../utils/url-normalizer.js';
import { normalizeTagName } from '../models/tag.model.js';

export interface BookmarkResult {
  success: boolean;
  bookmark?: Bookmark;
  error?: string;
  errorCode?: string;
}

export interface BookmarkWithTags extends Bookmark {
  tags: { id: string; name: string }[];
}

export const BookmarkErrorCodes = {
  NOT_FOUND: 'BOOKMARK_NOT_FOUND',
  INVALID_URL: 'BOOKMARK_INVALID_URL',
  COLLECTION_NOT_FOUND: 'BOOKMARK_COLLECTION_NOT_FOUND',
  DUPLICATE_URL: 'BOOKMARK_DUPLICATE_URL',
} as const;

/**
 * Detects the type of content based on URL and metadata
 */
function detectBookmarkType(url: string): BookmarkType {
  const urlLower = url.toLowerCase();
  
  // Video platforms
  if (
    urlLower.includes('youtube.com') ||
    urlLower.includes('youtu.be') ||
    urlLower.includes('vimeo.com') ||
    urlLower.includes('dailymotion.com') ||
    urlLower.includes('twitch.tv')
  ) {
    return 'VIDEO';
  }

  // Image hosting
  if (
    urlLower.includes('imgur.com') ||
    urlLower.includes('flickr.com') ||
    urlLower.includes('unsplash.com') ||
    urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/)
  ) {
    return 'IMAGE';
  }

  // Audio platforms
  if (
    urlLower.includes('soundcloud.com') ||
    urlLower.includes('spotify.com') ||
    urlLower.includes('podcasts.apple.com') ||
    urlLower.match(/\.(mp3|wav|ogg|flac)(\?|$)/)
  ) {
    return 'AUDIO';
  }

  // Documents
  if (urlLower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|epub)(\?|$)/)) {
    return 'DOCUMENT';
  }

  // Default to article for most web pages
  return 'ARTICLE';
}

/**
 * Extracts metadata from a URL (title, excerpt, cover)
 * In a real implementation, this would fetch the page and parse OpenGraph/meta tags
 */
async function extractMetadata(url: string): Promise<{
  title: string;
  excerpt?: string;
  coverUrl?: string;
}> {
  // For now, return basic metadata derived from URL
  // TODO: Implement actual page fetching and metadata extraction
  const domain = extractDomain(url);
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  
  // Generate a title from the URL path or domain
  const lastPathPart = pathParts[pathParts.length - 1];
  let title = lastPathPart 
    ? lastPathPart.replace(/[-_]/g, ' ')
    : domain;
  
  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title };
}


/**
 * Gets or creates the default "Unsorted" collection for a user
 */
async function getOrCreateDefaultCollection(ownerId: string): Promise<string> {
  // Look for existing Unsorted collection
  const existing = await prisma.collection.findFirst({
    where: {
      ownerId,
      title: 'Unsorted',
    },
  });

  if (existing) {
    return existing.id;
  }

  // Create default collection
  const collection = await prisma.collection.create({
    data: {
      ownerId,
      title: 'Unsorted',
      icon: 'inbox',
      sortOrder: 0,
    },
  });

  return collection.id;
}

/**
 * Gets or creates tags for a user
 */
async function getOrCreateTags(
  ownerId: string,
  tagNames: string[]
): Promise<string[]> {
  const tagIds: string[] = [];

  for (const name of tagNames) {
    const normalizedName = normalizeTagName(name);
    
    // Try to find existing tag
    let tag = await prisma.tag.findFirst({
      where: {
        ownerId,
        normalizedName,
      },
    });

    if (!tag) {
      // Create new tag
      tag = await prisma.tag.create({
        data: {
          ownerId,
          name: name.trim(),
          normalizedName,
        },
      });
    }

    tagIds.push(tag.id);
  }

  return tagIds;
}


/**
 * Creates a new bookmark with metadata extraction and duplicate detection
 * Requirements: 2.1, 2.2, 2.6, 17.1, 17.2
 */
export async function createBookmarkForUser(
  ownerId: string,
  data: CreateBookmarkDTO
): Promise<BookmarkResult> {
  try {
    // Normalize the URL
    const normalizedUrl = normalizeURL(data.url);
    const domain = extractDomain(data.url);
    const type = detectBookmarkType(data.url);

    // Check for duplicates using normalized URL
    const existingBookmarks = await findBookmarksByNormalizedUrl(normalizedUrl, ownerId);
    const isDuplicate = existingBookmarks.length > 0;

    // Get or extract metadata
    let title = data.title;
    let excerpt = data.excerpt;
    let coverUrl = data.coverUrl;

    if (!title) {
      const metadata = await extractMetadata(data.url);
      title = metadata.title;
      excerpt = excerpt ?? metadata.excerpt;
      coverUrl = coverUrl ?? metadata.coverUrl;
    }

    // Get collection ID (use provided or default)
    let collectionId = data.collectionId;
    if (!collectionId) {
      collectionId = await getOrCreateDefaultCollection(ownerId);
    } else {
      // Verify collection exists and belongs to user
      const collection = await prisma.collection.findFirst({
        where: { id: collectionId, ownerId },
      });
      if (!collection) {
        return {
          success: false,
          error: 'Collection not found',
          errorCode: BookmarkErrorCodes.COLLECTION_NOT_FOUND,
        };
      }
    }

    // Create the bookmark
    const bookmark = await createBookmark({
      ownerId,
      collectionId,
      url: data.url,
      normalizedUrl,
      title,
      excerpt,
      coverUrl,
      domain,
      type,
      note: data.note,
      isDuplicate,
    });

    // Handle tags if provided
    if (data.tags && data.tags.length > 0) {
      const tagIds = await getOrCreateTags(ownerId, data.tags);
      await addTagsToBookmark(bookmark.id, tagIds);
    }

    return {
      success: true,
      bookmark,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('URL')) {
      return {
        success: false,
        error: error.message,
        errorCode: BookmarkErrorCodes.INVALID_URL,
      };
    }
    throw error;
  }
}


/**
 * Gets a bookmark by ID with ownership check
 * Requirements: 2.3
 */
export async function getBookmarkById(
  id: string,
  ownerId: string
): Promise<BookmarkResult> {
  const bookmark = await findBookmarkByIdAndOwner(id, ownerId);
  
  if (!bookmark) {
    return {
      success: false,
      error: 'Bookmark not found',
      errorCode: BookmarkErrorCodes.NOT_FOUND,
    };
  }

  return {
    success: true,
    bookmark,
  };
}

/**
 * Gets a bookmark with its tags
 */
export async function getBookmarkWithTags(
  id: string,
  ownerId: string
): Promise<{ success: boolean; bookmark?: BookmarkWithTags; error?: string; errorCode?: string }> {
  const result = await findBookmarkWithTags(id, ownerId);
  
  if (!result) {
    return {
      success: false,
      error: 'Bookmark not found',
      errorCode: BookmarkErrorCodes.NOT_FOUND,
    };
  }

  const bookmark: BookmarkWithTags = {
    ...result,
    tags: result.tags.map(t => t.tag),
  };

  return {
    success: true,
    bookmark,
  };
}

/**
 * Lists bookmarks for a user with filters and pagination
 */
export async function listBookmarks(
  ownerId: string,
  filters: BookmarkFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<Bookmark>> {
  return findBookmarksByUser(ownerId, filters, pagination);
}


/**
 * Updates a bookmark
 * Requirements: 2.4
 */
export async function updateBookmarkForUser(
  id: string,
  ownerId: string,
  data: UpdateBookmarkDTO
): Promise<BookmarkResult> {
  // Verify collection if being changed
  if (data.collectionId) {
    const collection = await prisma.collection.findFirst({
      where: { id: data.collectionId, ownerId },
    });
    if (!collection) {
      return {
        success: false,
        error: 'Collection not found',
        errorCode: BookmarkErrorCodes.COLLECTION_NOT_FOUND,
      };
    }
  }

  const bookmark = await updateBookmark(id, ownerId, data);
  
  if (!bookmark) {
    return {
      success: false,
      error: 'Bookmark not found',
      errorCode: BookmarkErrorCodes.NOT_FOUND,
    };
  }

  return {
    success: true,
    bookmark,
  };
}

/**
 * Deletes a bookmark and all associated data
 * Requirements: 2.5
 * 
 * Cascade behavior (handled by Prisma schema):
 * - Highlights are deleted (onDelete: Cascade)
 * - Tag associations are deleted (onDelete: Cascade on BookmarkTag)
 * - Files are unlinked (onDelete: SetNull)
 * - Reminders are deleted (onDelete: Cascade)
 * 
 * Storage cleanup:
 * - Snapshots are deleted from S3 if present
 */
export async function deleteBookmarkForUser(
  id: string,
  ownerId: string
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  // Get bookmark to check for snapshot path before deletion
  const bookmark = await findBookmarkByIdAndOwner(id, ownerId);
  
  if (!bookmark) {
    return {
      success: false,
      error: 'Bookmark not found',
      errorCode: BookmarkErrorCodes.NOT_FOUND,
    };
  }

  // Store snapshot path for cleanup after deletion
  const snapshotPath = bookmark.contentSnapshotPath;

  // Delete the bookmark (cascades to highlights, tags, reminders)
  const deleted = await deleteBookmark(id, ownerId);
  
  if (!deleted) {
    return {
      success: false,
      error: 'Failed to delete bookmark',
      errorCode: BookmarkErrorCodes.NOT_FOUND,
    };
  }

  // Clean up snapshot from storage if present
  // TODO: Implement storage service and call deleteSnapshot(snapshotPath)
  if (snapshotPath) {
    // Storage cleanup will be implemented in task 16 (background workers)
    // For now, we log the path that would be deleted
    console.log(`Snapshot to delete: ${snapshotPath}`);
  }

  return { success: true };
}

/**
 * Updates tags for a bookmark
 */
export async function updateBookmarkTags(
  bookmarkId: string,
  ownerId: string,
  tagNames: string[]
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  // Verify bookmark ownership
  const bookmark = await findBookmarkByIdAndOwner(bookmarkId, ownerId);
  if (!bookmark) {
    return {
      success: false,
      error: 'Bookmark not found',
      errorCode: BookmarkErrorCodes.NOT_FOUND,
    };
  }

  // Get current tag IDs
  const currentTagIds = await getBookmarkTagIds(bookmarkId);

  // Get or create new tags
  const newTagIds = await getOrCreateTags(ownerId, tagNames);

  // Remove tags that are no longer needed
  const tagsToRemove = currentTagIds.filter(id => !newTagIds.includes(id));
  if (tagsToRemove.length > 0) {
    await removeTagsFromBookmark(bookmarkId, tagsToRemove);
  }

  // Add new tags
  const tagsToAdd = newTagIds.filter(id => !currentTagIds.includes(id));
  if (tagsToAdd.length > 0) {
    await addTagsToBookmark(bookmarkId, tagsToAdd);
  }

  return { success: true };
}

/**
 * Checks if a URL already exists for a user (duplicate detection)
 * Requirements: 17.1, 17.2
 */
export async function checkDuplicateUrl(
  url: string,
  ownerId: string
): Promise<{ isDuplicate: boolean; existingBookmarks: Bookmark[] }> {
  const normalizedUrl = normalizeURL(url);
  const existingBookmarks = await findBookmarksByNormalizedUrl(normalizedUrl, ownerId);
  
  return {
    isDuplicate: existingBookmarks.length > 0,
    existingBookmarks,
  };
}

/**
 * Reorders bookmarks within a collection
 * Requirements: 14.4
 * 
 * @param ownerId - The owner's user ID
 * @param orders - Array of bookmark IDs with their new sort orders
 * @returns Result with count of affected bookmarks
 */
export async function reorderBookmarks(
  ownerId: string,
  orders: { bookmarkId: string; sortOrder: number }[]
): Promise<{ success: boolean; affectedCount: number; error?: string }> {
  if (!orders || orders.length === 0) {
    return {
      success: false,
      affectedCount: 0,
      error: 'Orders array is required',
    };
  }

  // Verify all bookmarks belong to the user
  const bookmarkIds = orders.map(o => o.bookmarkId);
  const validBookmarks = await prisma.bookmark.findMany({
    where: {
      id: { in: bookmarkIds },
      ownerId,
    },
    select: { id: true },
  });

  const validBookmarkIds = new Set(validBookmarks.map(b => b.id));
  const validOrders = orders.filter(o => validBookmarkIds.has(o.bookmarkId));

  if (validOrders.length === 0) {
    return {
      success: false,
      affectedCount: 0,
      error: 'No valid bookmarks found',
    };
  }

  // Update sort orders in a transaction
  await prisma.$transaction(async (tx) => {
    for (const { bookmarkId, sortOrder } of validOrders) {
      await tx.bookmark.update({
        where: { id: bookmarkId },
        data: { sortOrder },
      });
    }
  });

  return {
    success: true,
    affectedCount: validOrders.length,
  };
}

/**
 * Gets bookmarks in a collection sorted by sortOrder
 * Requirements: 14.4
 */
export async function getBookmarksBySortOrder(
  ownerId: string,
  collectionId: string
): Promise<Bookmark[]> {
  const bookmarks = await prisma.bookmark.findMany({
    where: {
      ownerId,
      collectionId,
    },
    orderBy: { sortOrder: 'asc' },
  });

  return bookmarks as Bookmark[];
}
