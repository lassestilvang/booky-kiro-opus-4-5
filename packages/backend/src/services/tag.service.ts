/**
 * Tag Service - Business logic for tag operations
 * Requirements: 4.1, 4.6, 4.7
 */
import {
  createTag,
  findTagByIdAndOwner,
  findTagByNormalizedName,
  findTagsByOwner,
  findTagsWithBookmarkCounts,
  getTagSuggestions,
  updateTag,
  deleteTag,
  mergeTags,
  countBookmarksByTag,
} from '../repositories/tag.repository.js';
import type { Tag, CreateTagDTO, UpdateTagDTO } from '../models/tag.model.js';
import { normalizeTagName } from '../models/tag.model.js';

export interface TagResult {
  success: boolean;
  tag?: Tag;
  error?: string;
  errorCode?: string;
}

export interface TagWithCount extends Tag {
  bookmarkCount: number;
}

export interface MergeTagsResult {
  success: boolean;
  affectedBookmarks?: number;
  error?: string;
  errorCode?: string;
}

export const TagErrorCodes = {
  NOT_FOUND: 'TAG_NOT_FOUND',
  ALREADY_EXISTS: 'TAG_ALREADY_EXISTS',
  SAME_TAG: 'TAG_MERGE_SAME_TAG',
  SOURCE_NOT_FOUND: 'TAG_SOURCE_NOT_FOUND',
  TARGET_NOT_FOUND: 'TAG_TARGET_NOT_FOUND',
} as const;

/**
 * Creates a new tag for a user
 * Requirements: 4.1
 */
export async function createTagForUser(
  ownerId: string,
  data: CreateTagDTO
): Promise<TagResult> {
  const normalizedName = normalizeTagName(data.name);

  // Check if tag already exists
  const existing = await findTagByNormalizedName(normalizedName, ownerId);
  if (existing) {
    return {
      success: false,
      error: 'Tag already exists',
      errorCode: TagErrorCodes.ALREADY_EXISTS,
      tag: existing,
    };
  }


  const tag = await createTag({
    ownerId,
    name: data.name.trim(),
    normalizedName,
    color: data.color,
  });

  return {
    success: true,
    tag,
  };
}

/**
 * Gets a tag by ID with ownership check
 */
export async function getTagById(
  id: string,
  ownerId: string
): Promise<TagResult> {
  const tag = await findTagByIdAndOwner(id, ownerId);

  if (!tag) {
    return {
      success: false,
      error: 'Tag not found',
      errorCode: TagErrorCodes.NOT_FOUND,
    };
  }

  return {
    success: true,
    tag,
  };
}

/**
 * Lists all tags for a user
 * Requirements: 4.1
 */
export async function listTags(ownerId: string): Promise<Tag[]> {
  return findTagsByOwner(ownerId);
}

/**
 * Lists all tags with bookmark counts for a user
 */
export async function listTagsWithCounts(ownerId: string): Promise<TagWithCount[]> {
  const tags = await findTagsWithBookmarkCounts(ownerId);

  return tags.map(t => ({
    ...t,
    bookmarkCount: t._count.bookmarks,
  }));
}

/**
 * Gets tag suggestions based on prefix matching
 * Requirements: 4.6
 * 
 * Returns tags that start with the given prefix (case-insensitive),
 * ordered by usage frequency (most used first).
 */
export async function getTagSuggestionsForUser(
  ownerId: string,
  prefix: string,
  limit: number = 10
): Promise<Tag[]> {
  // Return empty array for empty prefix
  if (!prefix || prefix.trim().length === 0) {
    return [];
  }

  return getTagSuggestions(ownerId, prefix, limit);
}

/**
 * Updates a tag
 */
export async function updateTagForUser(
  id: string,
  ownerId: string,
  data: UpdateTagDTO
): Promise<TagResult> {
  const updateData: { name?: string; normalizedName?: string; color?: string | null } = {};

  if (data.name !== undefined) {
    updateData.name = data.name.trim();
    updateData.normalizedName = normalizeTagName(data.name);

    // Check if new name conflicts with existing tag
    const existing = await findTagByNormalizedName(updateData.normalizedName, ownerId);
    if (existing && existing.id !== id) {
      return {
        success: false,
        error: 'Tag with this name already exists',
        errorCode: TagErrorCodes.ALREADY_EXISTS,
      };
    }
  }

  if (data.color !== undefined) {
    updateData.color = data.color;
  }

  const tag = await updateTag(id, ownerId, updateData);

  if (!tag) {
    return {
      success: false,
      error: 'Tag not found',
      errorCode: TagErrorCodes.NOT_FOUND,
    };
  }

  return {
    success: true,
    tag,
  };
}


/**
 * Deletes a tag
 */
export async function deleteTagForUser(
  id: string,
  ownerId: string
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const deleted = await deleteTag(id, ownerId);

  if (!deleted) {
    return {
      success: false,
      error: 'Tag not found',
      errorCode: TagErrorCodes.NOT_FOUND,
    };
  }

  return { success: true };
}

/**
 * Merges source tag into target tag
 * Requirements: 4.7
 * 
 * This operation:
 * 1. Moves all bookmark associations from source to target (avoiding duplicates)
 * 2. Deletes the source tag
 * 3. Returns the count of affected bookmarks
 * 
 * The total number of bookmarks associated with the target tag after merge
 * equals the sum of bookmarks from both tags minus any duplicates
 * (bookmarks that were already tagged with both).
 */
export async function mergeTagsForUser(
  sourceTagId: string,
  targetTagId: string,
  ownerId: string
): Promise<MergeTagsResult> {
  // Prevent merging a tag into itself
  if (sourceTagId === targetTagId) {
    return {
      success: false,
      error: 'Cannot merge a tag into itself',
      errorCode: TagErrorCodes.SAME_TAG,
    };
  }

  // Verify source tag exists
  const sourceTag = await findTagByIdAndOwner(sourceTagId, ownerId);
  if (!sourceTag) {
    return {
      success: false,
      error: 'Source tag not found',
      errorCode: TagErrorCodes.SOURCE_NOT_FOUND,
    };
  }

  // Verify target tag exists
  const targetTag = await findTagByIdAndOwner(targetTagId, ownerId);
  if (!targetTag) {
    return {
      success: false,
      error: 'Target tag not found',
      errorCode: TagErrorCodes.TARGET_NOT_FOUND,
    };
  }

  const result = await mergeTags(sourceTagId, targetTagId, ownerId);

  if (!result.success) {
    return {
      success: false,
      error: 'Failed to merge tags',
    };
  }

  return {
    success: true,
    affectedBookmarks: result.affectedBookmarks,
  };
}

/**
 * Gets the bookmark count for a tag
 */
export async function getTagBookmarkCount(
  tagId: string,
  ownerId: string
): Promise<{ success: boolean; count?: number; error?: string; errorCode?: string }> {
  const tag = await findTagByIdAndOwner(tagId, ownerId);

  if (!tag) {
    return {
      success: false,
      error: 'Tag not found',
      errorCode: TagErrorCodes.NOT_FOUND,
    };
  }

  const count = await countBookmarksByTag(tagId);

  return {
    success: true,
    count,
  };
}
