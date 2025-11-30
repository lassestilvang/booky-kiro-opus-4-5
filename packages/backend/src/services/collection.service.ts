/**
 * Collection Service - Business logic for collection operations
 * Requirements: 3.1, 3.2, 3.4, 3.5
 */
import {
  createCollection,
  findCollectionByIdAndOwner,
  findCollectionsByUser,
  findCollectionsWithBookmarkCounts,
  findCollectionWithBookmarkCount,
  findCollectionByShareSlug,
  updateCollection,
  deleteCollection,
  getOrCreateUnsortedCollection,
  moveBookmarksToCollection,
  shareSlugExists,
} from '../repositories/collection.repository.js';
import type { Collection, CreateCollectionDTO, UpdateCollectionDTO } from '../models/collection.model.js';
import { randomBytes } from 'crypto';

export interface CollectionResult {
  success: boolean;
  collection?: Collection;
  error?: string;
  errorCode?: string;
}

export interface CollectionWithCount extends Collection {
  bookmarkCount: number;
}

export const CollectionErrorCodes = {
  NOT_FOUND: 'COLLECTION_NOT_FOUND',
  CANNOT_DELETE_UNSORTED: 'COLLECTION_CANNOT_DELETE_UNSORTED',
  SLUG_GENERATION_FAILED: 'COLLECTION_SLUG_GENERATION_FAILED',
  PERMISSION_DENIED: 'COLLECTION_PERMISSION_DENIED',
} as const;

/**
 * Generates a unique share slug for public collections
 * Requirements: 3.5
 */
async function generateUniqueShareSlug(): Promise<string> {
  const maxAttempts = 10;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate a random 8-character slug
    const slug = randomBytes(6).toString('base64url').slice(0, 8);
    
    // Check if it already exists
    const exists = await shareSlugExists(slug);
    if (!exists) {
      return slug;
    }
  }
  
  throw new Error('Failed to generate unique share slug after maximum attempts');
}

/**
 * Creates a new collection for a user
 * Requirements: 3.1
 */
export async function createCollectionForUser(
  ownerId: string,
  data: CreateCollectionDTO
): Promise<CollectionResult> {
  const collection = await createCollection({
    ownerId,
    title: data.title,
    description: data.description,
    icon: data.icon,
    color: data.color,
    isPublic: data.isPublic ?? false,
    parentId: data.parentId,
  });

  return {
    success: true,
    collection,
  };
}


/**
 * Gets or creates the default "Unsorted" collection for a user
 * Requirements: 3.1
 */
export async function ensureDefaultCollection(ownerId: string): Promise<Collection> {
  return getOrCreateUnsortedCollection(ownerId);
}

/**
 * Gets a collection by ID with ownership check
 * Requirements: 3.2
 */
export async function getCollectionById(
  id: string,
  ownerId: string
): Promise<CollectionResult> {
  const collection = await findCollectionByIdAndOwner(id, ownerId);
  
  if (!collection) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: CollectionErrorCodes.NOT_FOUND,
    };
  }

  return {
    success: true,
    collection,
  };
}

/**
 * Gets a collection with bookmark count
 */
export async function getCollectionWithCount(
  id: string,
  ownerId: string
): Promise<{ success: boolean; collection?: CollectionWithCount; error?: string; errorCode?: string }> {
  const result = await findCollectionWithBookmarkCount(id, ownerId);
  
  if (!result) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: CollectionErrorCodes.NOT_FOUND,
    };
  }

  const collection: CollectionWithCount = {
    ...result,
    bookmarkCount: result._count.bookmarks,
  };

  return {
    success: true,
    collection,
  };
}

/**
 * Lists all collections accessible by a user (owned + shared)
 * Requirements: 3.2
 */
export async function listCollections(ownerId: string): Promise<Collection[]> {
  return findCollectionsByUser(ownerId);
}

/**
 * Lists all collections with bookmark counts for a user
 */
export async function listCollectionsWithCounts(ownerId: string): Promise<CollectionWithCount[]> {
  const collections = await findCollectionsWithBookmarkCounts(ownerId);
  
  return collections.map(c => ({
    ...c,
    bookmarkCount: c._count.bookmarks,
  }));
}

/**
 * Updates a collection
 * Requirements: 3.1
 */
export async function updateCollectionForUser(
  id: string,
  ownerId: string,
  data: UpdateCollectionDTO
): Promise<CollectionResult> {
  const collection = await updateCollection(id, ownerId, data);
  
  if (!collection) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: CollectionErrorCodes.NOT_FOUND,
    };
  }

  return {
    success: true,
    collection,
  };
}

/**
 * Deletes a collection and moves its bookmarks to "Unsorted"
 * Requirements: 3.4
 */
export async function deleteCollectionForUser(
  id: string,
  ownerId: string
): Promise<{ success: boolean; movedBookmarks?: number; error?: string; errorCode?: string }> {
  // Get the collection to verify it exists and check if it's the Unsorted collection
  const collection = await findCollectionByIdAndOwner(id, ownerId);
  
  if (!collection) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: CollectionErrorCodes.NOT_FOUND,
    };
  }

  // Prevent deletion of the "Unsorted" collection
  if (collection.title === 'Unsorted') {
    return {
      success: false,
      error: 'Cannot delete the default Unsorted collection',
      errorCode: CollectionErrorCodes.CANNOT_DELETE_UNSORTED,
    };
  }

  // Get or create the Unsorted collection to move bookmarks to
  const unsortedCollection = await getOrCreateUnsortedCollection(ownerId);

  // Move all bookmarks from this collection to Unsorted
  const movedCount = await moveBookmarksToCollection(id, unsortedCollection.id);

  // Delete the collection
  await deleteCollection(id, ownerId);

  return {
    success: true,
    movedBookmarks: movedCount,
  };
}

/**
 * Sets a collection as public and generates a share slug
 * Requirements: 3.5
 */
export async function makeCollectionPublic(
  id: string,
  ownerId: string
): Promise<CollectionResult> {
  // Verify ownership
  const existing = await findCollectionByIdAndOwner(id, ownerId);
  if (!existing) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: CollectionErrorCodes.NOT_FOUND,
    };
  }

  // If already public with a slug, return as-is
  if (existing.isPublic && existing.shareSlug) {
    return {
      success: true,
      collection: existing,
    };
  }

  try {
    // Generate a unique share slug
    const shareSlug = await generateUniqueShareSlug();

    // Update the collection
    const collection = await updateCollection(id, ownerId, {
      isPublic: true,
      shareSlug,
    });

    return {
      success: true,
      collection: collection!,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to generate share slug',
      errorCode: CollectionErrorCodes.SLUG_GENERATION_FAILED,
    };
  }
}

/**
 * Makes a collection private by removing public access
 */
export async function makeCollectionPrivate(
  id: string,
  ownerId: string
): Promise<CollectionResult> {
  // Verify ownership
  const existing = await findCollectionByIdAndOwner(id, ownerId);
  if (!existing) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: CollectionErrorCodes.NOT_FOUND,
    };
  }

  // Update the collection
  const collection = await updateCollection(id, ownerId, {
    isPublic: false,
    shareSlug: null,
  });

  return {
    success: true,
    collection: collection!,
  };
}

/**
 * Gets a public collection by its share slug
 * Requirements: 3.5
 */
export async function getPublicCollection(
  shareSlug: string
): Promise<CollectionResult> {
  const collection = await findCollectionByShareSlug(shareSlug);
  
  if (!collection || !collection.isPublic) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: CollectionErrorCodes.NOT_FOUND,
    };
  }

  return {
    success: true,
    collection,
  };
}
