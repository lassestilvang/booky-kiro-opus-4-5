/**
 * Permission Repository - Database operations for collection permissions
 * Requirements: 13.1, 13.4
 */
import { prisma } from '../db/client.js';
import type { CollectionPermission, PermissionRole } from '../models/permission.model.js';

export interface CreatePermissionData {
  collectionId: string;
  userId: string;
  role: PermissionRole;
}

/**
 * Creates a new permission (shares a collection with a user)
 * Requirements: 13.1
 */
export async function createPermission(data: CreatePermissionData): Promise<CollectionPermission> {
  const permission = await prisma.collectionPermission.create({
    data: {
      collectionId: data.collectionId,
      userId: data.userId,
      role: data.role,
    },
  });

  return permission as CollectionPermission;
}

/**
 * Finds a permission by ID
 */
export async function findPermissionById(id: string): Promise<CollectionPermission | null> {
  const permission = await prisma.collectionPermission.findUnique({
    where: { id },
  });

  return permission as CollectionPermission | null;
}

/**
 * Finds a permission by collection and user
 */
export async function findPermissionByCollectionAndUser(
  collectionId: string,
  userId: string
): Promise<CollectionPermission | null> {
  const permission = await prisma.collectionPermission.findUnique({
    where: {
      collectionId_userId: {
        collectionId,
        userId,
      },
    },
  });

  return permission as CollectionPermission | null;
}

/**
 * Finds all permissions for a collection
 */
export async function findPermissionsByCollection(
  collectionId: string
): Promise<CollectionPermission[]> {
  const permissions = await prisma.collectionPermission.findMany({
    where: { collectionId },
    orderBy: { createdAt: 'asc' },
  });

  return permissions as CollectionPermission[];
}

/**
 * Finds all permissions for a user (collections shared with them)
 */
export async function findPermissionsByUser(userId: string): Promise<CollectionPermission[]> {
  const permissions = await prisma.collectionPermission.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  return permissions as CollectionPermission[];
}

/**
 * Updates a permission's role
 */
export async function updatePermissionRole(
  id: string,
  role: PermissionRole
): Promise<CollectionPermission | null> {
  try {
    const permission = await prisma.collectionPermission.update({
      where: { id },
      data: { role },
    });

    return permission as CollectionPermission;
  } catch {
    return null;
  }
}

/**
 * Deletes a permission (revokes sharing)
 * Requirements: 13.4
 */
export async function deletePermission(id: string): Promise<boolean> {
  try {
    await prisma.collectionPermission.delete({
      where: { id },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes a permission by collection and user
 * Requirements: 13.4
 */
export async function deletePermissionByCollectionAndUser(
  collectionId: string,
  userId: string
): Promise<boolean> {
  try {
    await prisma.collectionPermission.delete({
      where: {
        collectionId_userId: {
          collectionId,
          userId,
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes all permissions for a collection
 */
export async function deleteAllPermissionsForCollection(collectionId: string): Promise<number> {
  const result = await prisma.collectionPermission.deleteMany({
    where: { collectionId },
  });

  return result.count;
}

/**
 * Checks if a user has any permission on a collection
 */
export async function hasPermission(collectionId: string, userId: string): Promise<boolean> {
  const count = await prisma.collectionPermission.count({
    where: { collectionId, userId },
  });
  return count > 0;
}

/**
 * Gets the role a user has on a collection (if any)
 */
export async function getUserRole(
  collectionId: string,
  userId: string
): Promise<PermissionRole | null> {
  const permission = await findPermissionByCollectionAndUser(collectionId, userId);
  return permission?.role ?? null;
}

/**
 * Finds permissions with user details for a collection
 */
export async function findPermissionsWithUsers(
  collectionId: string
): Promise<(CollectionPermission & { user: { id: string; email: string; name: string } })[]> {
  const permissions = await prisma.collectionPermission.findMany({
    where: { collectionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return permissions as (CollectionPermission & { user: { id: string; email: string; name: string } })[];
}
