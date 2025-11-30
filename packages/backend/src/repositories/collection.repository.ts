/**
 * Collection Repository - Database operations for collections
 * Requirements: 3.1, 3.2
 */
import { prisma } from '../db/client.js';
import type { Collection } from '../models/collection.model.js';

export interface CreateCollectionData {
  ownerId: string;
  title: string;
  description?: string | null;
  icon?: string;
  color?: string | null;
  isPublic?: boolean;
  shareSlug?: string | null;
  parentId?: string | null;
}

export interface UpdateCollectionData {
  title?: string;
  description?: string | null;
  icon?: string;
  color?: string | null;
  isPublic?: boolean;
  shareSlug?: string | null;
  sortOrder?: number;
  parentId?: string | null;
}

/**
 * Creates a new collection in the database
 * Requirements: 3.1
 */
export async function createCollection(data: CreateCollectionData): Promise<Collection> {
  // Get the next sort order for the user's collections
  const maxSortOrder = await prisma.collection.aggregate({
    where: { ownerId: data.ownerId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

  const collection = await prisma.collection.create({
    data: {
      ownerId: data.ownerId,
      title: data.title,
      description: data.description ?? null,
      icon: data.icon ?? 'folder',
      color: data.color ?? null,
      isPublic: data.isPublic ?? false,
      shareSlug: data.shareSlug ?? null,
      parentId: data.parentId ?? null,
      sortOrder,
    },
  });

  return collection as Collection;
}

/**
 * Finds a collection by ID
 */
export async function findCollectionById(id: string): Promise<Collection | null> {
  const collection = await prisma.collection.findUnique({
    where: { id },
  });

  return collection as Collection | null;
}

/**
 * Finds a collection by ID with ownership check
 */
export async function findCollectionByIdAndOwner(
  id: string,
  ownerId: string
): Promise<Collection | null> {
  const collection = await prisma.collection.findFirst({
    where: { id, ownerId },
  });

  return collection as Collection | null;
}

/**
 * Finds a collection by share slug (for public access)
 */
export async function findCollectionByShareSlug(shareSlug: string): Promise<Collection | null> {
  const collection = await prisma.collection.findUnique({
    where: { shareSlug },
  });

  return collection as Collection | null;
}


/**
 * Finds all collections owned by a user
 * Requirements: 3.2
 */
export async function findCollectionsByOwner(ownerId: string): Promise<Collection[]> {
  const collections = await prisma.collection.findMany({
    where: { ownerId },
    orderBy: { sortOrder: 'asc' },
  });

  return collections as Collection[];
}

/**
 * Finds all collections accessible by a user (owned + shared)
 * Requirements: 3.2
 */
export async function findCollectionsByUser(ownerId: string): Promise<Collection[]> {
  // Get owned collections
  const ownedCollections = await prisma.collection.findMany({
    where: { ownerId },
    orderBy: { sortOrder: 'asc' },
  });

  // Get shared collections (where user has permission)
  const sharedCollections = await prisma.collection.findMany({
    where: {
      permissions: {
        some: {
          userId: ownerId,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Combine and return (owned first, then shared)
  return [...ownedCollections, ...sharedCollections] as Collection[];
}

/**
 * Updates a collection
 */
export async function updateCollection(
  id: string,
  ownerId: string,
  data: UpdateCollectionData
): Promise<Collection | null> {
  // First verify ownership
  const existing = await findCollectionByIdAndOwner(id, ownerId);
  if (!existing) {
    return null;
  }

  const collection = await prisma.collection.update({
    where: { id },
    data,
  });

  return collection as Collection;
}

/**
 * Deletes a collection
 * Note: Bookmarks should be moved to "Unsorted" before calling this
 */
export async function deleteCollection(id: string, ownerId: string): Promise<boolean> {
  // First verify ownership
  const existing = await findCollectionByIdAndOwner(id, ownerId);
  if (!existing) {
    return false;
  }

  await prisma.collection.delete({
    where: { id },
  });

  return true;
}

/**
 * Checks if a share slug already exists
 */
export async function shareSlugExists(shareSlug: string): Promise<boolean> {
  const count = await prisma.collection.count({
    where: { shareSlug },
  });
  return count > 0;
}

/**
 * Gets the default "Unsorted" collection for a user, or creates it if it doesn't exist
 */
export async function getOrCreateUnsortedCollection(ownerId: string): Promise<Collection> {
  // Look for existing Unsorted collection
  const existing = await prisma.collection.findFirst({
    where: {
      ownerId,
      title: 'Unsorted',
    },
  });

  if (existing) {
    return existing as Collection;
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

  return collection as Collection;
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
 * Moves all bookmarks from one collection to another
 */
export async function moveBookmarksToCollection(
  fromCollectionId: string,
  toCollectionId: string
): Promise<number> {
  const result = await prisma.bookmark.updateMany({
    where: { collectionId: fromCollectionId },
    data: { collectionId: toCollectionId },
  });

  return result.count;
}

/**
 * Gets collection with bookmark count
 */
export async function findCollectionWithBookmarkCount(
  id: string,
  ownerId: string
): Promise<(Collection & { _count: { bookmarks: number } }) | null> {
  const collection = await prisma.collection.findFirst({
    where: { id, ownerId },
    include: {
      _count: {
        select: { bookmarks: true },
      },
    },
  });

  return collection as (Collection & { _count: { bookmarks: number } }) | null;
}

/**
 * Gets all collections with bookmark counts for a user
 */
export async function findCollectionsWithBookmarkCounts(
  ownerId: string
): Promise<(Collection & { _count: { bookmarks: number } })[]> {
  const collections = await prisma.collection.findMany({
    where: { ownerId },
    include: {
      _count: {
        select: { bookmarks: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return collections as (Collection & { _count: { bookmarks: number } })[];
}
