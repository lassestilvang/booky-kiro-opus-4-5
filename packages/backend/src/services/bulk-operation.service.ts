/**
 * Bulk Operation Service - Business logic for bulk bookmark operations
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */
import { z } from 'zod';
import {
  findBookmarksByIds,
  moveBookmarksToCollection,
  deleteBookmarks,
  bulkAddTagsToBookmarks,
  bulkRemoveTagsFromBookmarks,
  bulkUpdateSortOrder,
} from '../repositories/bookmark.repository.js';
import { findCollectionByIdAndOwner } from '../repositories/collection.repository.js';
import { getOrCreateTag, findTagByIdAndOwner } from '../repositories/tag.repository.js';
import { normalizeTagName } from '../models/tag.model.js';

// Bulk operation action types
export const BulkActionType = {
  ADD_TAGS: 'addTags',
  REMOVE_TAGS: 'removeTags',
  MOVE: 'move',
  DELETE: 'delete',
  FAVORITE: 'favorite',
  UNFAVORITE: 'unfavorite',
  REORDER: 'reorder',
} as const;

export type BulkActionType = (typeof BulkActionType)[keyof typeof BulkActionType];

// Zod schema for bulk operation validation
export const BulkOperationSchema = z.object({
  bookmarkIds: z.array(z.string().uuid()).min(1),
  action: z.enum(['addTags', 'removeTags', 'move', 'delete', 'favorite', 'unfavorite', 'reorder']),
  payload: z.object({
    tags: z.array(z.string()).optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    collectionId: z.string().uuid().optional(),
    orders: z.array(z.object({
      bookmarkId: z.string().uuid(),
      sortOrder: z.number().int(),
    })).optional(),
  }).optional(),
});

export type BulkOperation = z.infer<typeof BulkOperationSchema>;

export interface BulkOperationResult {
  success: boolean;
  affectedCount: number;
  error?: string;
  errorCode?: string;
}

export const BulkOperationErrorCodes = {
  INVALID_ACTION: 'BULK_INVALID_ACTION',
  NO_BOOKMARKS: 'BULK_NO_BOOKMARKS',
  COLLECTION_NOT_FOUND: 'BULK_COLLECTION_NOT_FOUND',
  TAGS_REQUIRED: 'BULK_TAGS_REQUIRED',
  ORDERS_REQUIRED: 'BULK_ORDERS_REQUIRED',
} as const;


/**
 * Validates bulk operation input
 */
export function validateBulkOperation(data: unknown): z.SafeParseReturnType<unknown, BulkOperation> {
  return BulkOperationSchema.safeParse(data);
}

/**
 * Executes a bulk operation on bookmarks
 * Requirements: 14.1, 14.2, 14.3
 */
export async function executeBulkOperation(
  ownerId: string,
  operation: BulkOperation
): Promise<BulkOperationResult> {
  const { bookmarkIds, action, payload } = operation;

  // Verify bookmarks exist and belong to user
  const validBookmarks = await findBookmarksByIds(bookmarkIds, ownerId);
  if (validBookmarks.length === 0) {
    return {
      success: false,
      affectedCount: 0,
      error: 'No valid bookmarks found',
      errorCode: BulkOperationErrorCodes.NO_BOOKMARKS,
    };
  }

  const validBookmarkIds = validBookmarks.map(b => b.id);

  switch (action) {
    case BulkActionType.ADD_TAGS:
      return bulkAddTags(ownerId, validBookmarkIds, payload?.tags, payload?.tagIds);

    case BulkActionType.REMOVE_TAGS:
      return bulkRemoveTags(ownerId, validBookmarkIds, payload?.tags, payload?.tagIds);

    case BulkActionType.MOVE:
      return bulkMove(ownerId, validBookmarkIds, payload?.collectionId);

    case BulkActionType.DELETE:
      return bulkDelete(ownerId, validBookmarkIds);

    case BulkActionType.FAVORITE:
      return bulkSetFavorite(ownerId, validBookmarkIds, true);

    case BulkActionType.UNFAVORITE:
      return bulkSetFavorite(ownerId, validBookmarkIds, false);

    case BulkActionType.REORDER:
      return bulkReorder(ownerId, payload?.orders);

    default:
      return {
        success: false,
        affectedCount: 0,
        error: 'Invalid action',
        errorCode: BulkOperationErrorCodes.INVALID_ACTION,
      };
  }
}

/**
 * Bulk add tags to bookmarks
 * Requirements: 14.1
 */
async function bulkAddTags(
  ownerId: string,
  bookmarkIds: string[],
  tagNames?: string[],
  tagIds?: string[]
): Promise<BulkOperationResult> {
  // Get tag IDs from names or use provided IDs
  const resolvedTagIds: string[] = [];

  if (tagNames && tagNames.length > 0) {
    // Get or create tags by name
    for (const name of tagNames) {
      const normalizedName = normalizeTagName(name);
      const tag = await getOrCreateTag(ownerId, name.trim(), normalizedName);
      resolvedTagIds.push(tag.id);
    }
  } else if (tagIds && tagIds.length > 0) {
    // Verify tag IDs belong to user
    for (const tagId of tagIds) {
      const tag = await findTagByIdAndOwner(tagId, ownerId);
      if (tag) {
        resolvedTagIds.push(tag.id);
      }
    }
  }

  if (resolvedTagIds.length === 0) {
    return {
      success: false,
      affectedCount: 0,
      error: 'Tags are required for addTags action',
      errorCode: BulkOperationErrorCodes.TAGS_REQUIRED,
    };
  }

  const affectedCount = await bulkAddTagsToBookmarks(bookmarkIds, resolvedTagIds, ownerId);

  return {
    success: true,
    affectedCount,
  };
}

/**
 * Bulk remove tags from bookmarks
 * Requirements: 14.1
 */
async function bulkRemoveTags(
  ownerId: string,
  bookmarkIds: string[],
  tagNames?: string[],
  tagIds?: string[]
): Promise<BulkOperationResult> {
  const resolvedTagIds: string[] = [];

  if (tagNames && tagNames.length > 0) {
    // Find tags by name
    const { findTagByNormalizedName } = await import('../repositories/tag.repository.js');
    for (const name of tagNames) {
      const normalizedName = normalizeTagName(name);
      const tag = await findTagByNormalizedName(normalizedName, ownerId);
      if (tag) {
        resolvedTagIds.push(tag.id);
      }
    }
  } else if (tagIds && tagIds.length > 0) {
    // Verify tag IDs belong to user
    for (const tagId of tagIds) {
      const tag = await findTagByIdAndOwner(tagId, ownerId);
      if (tag) {
        resolvedTagIds.push(tag.id);
      }
    }
  }

  if (resolvedTagIds.length === 0) {
    return {
      success: false,
      affectedCount: 0,
      error: 'Tags are required for removeTags action',
      errorCode: BulkOperationErrorCodes.TAGS_REQUIRED,
    };
  }

  const affectedCount = await bulkRemoveTagsFromBookmarks(bookmarkIds, resolvedTagIds, ownerId);

  return {
    success: true,
    affectedCount,
  };
}

/**
 * Bulk move bookmarks to a collection
 * Requirements: 14.2
 */
async function bulkMove(
  ownerId: string,
  bookmarkIds: string[],
  collectionId?: string
): Promise<BulkOperationResult> {
  if (!collectionId) {
    return {
      success: false,
      affectedCount: 0,
      error: 'Collection ID is required for move action',
      errorCode: BulkOperationErrorCodes.COLLECTION_NOT_FOUND,
    };
  }

  // Verify collection exists and belongs to user
  const collection = await findCollectionByIdAndOwner(collectionId, ownerId);
  if (!collection) {
    return {
      success: false,
      affectedCount: 0,
      error: 'Collection not found',
      errorCode: BulkOperationErrorCodes.COLLECTION_NOT_FOUND,
    };
  }

  const affectedCount = await moveBookmarksToCollection(bookmarkIds, collectionId, ownerId);

  return {
    success: true,
    affectedCount,
  };
}

/**
 * Bulk delete bookmarks
 * Requirements: 14.3
 */
async function bulkDelete(
  ownerId: string,
  bookmarkIds: string[]
): Promise<BulkOperationResult> {
  const affectedCount = await deleteBookmarks(bookmarkIds, ownerId);

  return {
    success: true,
    affectedCount,
  };
}

/**
 * Bulk set favorite status for bookmarks
 */
async function bulkSetFavorite(
  ownerId: string,
  bookmarkIds: string[],
  isFavorite: boolean
): Promise<BulkOperationResult> {
  const { prisma } = await import('../db/client.js');
  
  const result = await prisma.bookmark.updateMany({
    where: {
      id: { in: bookmarkIds },
      ownerId,
    },
    data: { isFavorite },
  });

  return {
    success: true,
    affectedCount: result.count,
  };
}

/**
 * Bulk reorder bookmarks
 * Requirements: 14.4
 */
async function bulkReorder(
  ownerId: string,
  orders?: { bookmarkId: string; sortOrder: number }[]
): Promise<BulkOperationResult> {
  if (!orders || orders.length === 0) {
    return {
      success: false,
      affectedCount: 0,
      error: 'Orders are required for reorder action',
      errorCode: BulkOperationErrorCodes.ORDERS_REQUIRED,
    };
  }

  const affectedCount = await bulkUpdateSortOrder(orders, ownerId);

  return {
    success: true,
    affectedCount,
  };
}
