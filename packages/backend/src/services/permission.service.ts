/**
 * Permission Service - Business logic for sharing and permission operations
 * Requirements: 13.1, 13.4
 */
import {
  createPermission,
  findPermissionByCollectionAndUser,
  findPermissionsByCollection,
  findPermissionsWithUsers,
  deletePermissionByCollectionAndUser,
  getUserRole,
  updatePermissionRole,
} from '../repositories/permission.repository.js';
import {
  findCollectionById,
  findCollectionByShareSlug,
} from '../repositories/collection.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import type { CollectionPermission, PermissionRole, ShareCollectionDTO } from '../models/permission.model.js';
import { canEdit, canView } from '../models/permission.model.js';

export interface PermissionResult {
  success: boolean;
  permission?: CollectionPermission;
  error?: string;
  errorCode?: string;
}

export interface PermissionListResult {
  success: boolean;
  permissions?: (CollectionPermission & { user: { id: string; email: string; name: string } })[];
  error?: string;
  errorCode?: string;
}

export interface AccessCheckResult {
  hasAccess: boolean;
  role?: PermissionRole | 'owner';
  canEdit: boolean;
  canView: boolean;
}

export const PermissionErrorCodes = {
  COLLECTION_NOT_FOUND: 'PERMISSION_COLLECTION_NOT_FOUND',
  USER_NOT_FOUND: 'PERMISSION_USER_NOT_FOUND',
  ALREADY_SHARED: 'PERMISSION_ALREADY_SHARED',
  NOT_OWNER: 'PERMISSION_NOT_OWNER',
  PERMISSION_NOT_FOUND: 'PERMISSION_NOT_FOUND',
  CANNOT_SHARE_WITH_SELF: 'PERMISSION_CANNOT_SHARE_WITH_SELF',
} as const;

/**
 * Shares a collection with another user
 * Requirements: 13.1
 */
export async function shareCollection(
  collectionId: string,
  ownerId: string,
  data: ShareCollectionDTO
): Promise<PermissionResult> {
  // Verify the collection exists and is owned by the requesting user
  const collection = await findCollectionById(collectionId);
  if (!collection) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: PermissionErrorCodes.COLLECTION_NOT_FOUND,
    };
  }

  if (collection.ownerId !== ownerId) {
    return {
      success: false,
      error: 'Only the collection owner can share it',
      errorCode: PermissionErrorCodes.NOT_OWNER,
    };
  }

  // Cannot share with yourself
  if (data.userId === ownerId) {
    return {
      success: false,
      error: 'Cannot share a collection with yourself',
      errorCode: PermissionErrorCodes.CANNOT_SHARE_WITH_SELF,
    };
  }

  // Verify the target user exists
  const targetUser = await findUserById(data.userId);
  if (!targetUser) {
    return {
      success: false,
      error: 'User not found',
      errorCode: PermissionErrorCodes.USER_NOT_FOUND,
    };
  }

  // Check if already shared with this user
  const existingPermission = await findPermissionByCollectionAndUser(collectionId, data.userId);
  if (existingPermission) {
    // Update the role if different
    if (existingPermission.role !== data.role) {
      const updated = await updatePermissionRole(existingPermission.id, data.role);
      return {
        success: true,
        permission: updated!,
      };
    }
    return {
      success: false,
      error: 'Collection is already shared with this user',
      errorCode: PermissionErrorCodes.ALREADY_SHARED,
    };
  }

  // Create the permission
  const permission = await createPermission({
    collectionId,
    userId: data.userId,
    role: data.role,
  });

  return {
    success: true,
    permission,
  };
}

/**
 * Revokes sharing of a collection with a user
 * Requirements: 13.4
 */
export async function revokeShare(
  collectionId: string,
  ownerId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  // Verify the collection exists and is owned by the requesting user
  const collection = await findCollectionById(collectionId);
  if (!collection) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: PermissionErrorCodes.COLLECTION_NOT_FOUND,
    };
  }

  if (collection.ownerId !== ownerId) {
    return {
      success: false,
      error: 'Only the collection owner can revoke sharing',
      errorCode: PermissionErrorCodes.NOT_OWNER,
    };
  }

  // Delete the permission
  const deleted = await deletePermissionByCollectionAndUser(collectionId, targetUserId);
  if (!deleted) {
    return {
      success: false,
      error: 'Permission not found',
      errorCode: PermissionErrorCodes.PERMISSION_NOT_FOUND,
    };
  }

  return { success: true };
}

/**
 * Lists all users a collection is shared with
 */
export async function listCollectionShares(
  collectionId: string,
  ownerId: string
): Promise<PermissionListResult> {
  // Verify the collection exists and is owned by the requesting user
  const collection = await findCollectionById(collectionId);
  if (!collection) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: PermissionErrorCodes.COLLECTION_NOT_FOUND,
    };
  }

  if (collection.ownerId !== ownerId) {
    return {
      success: false,
      error: 'Only the collection owner can view shares',
      errorCode: PermissionErrorCodes.NOT_OWNER,
    };
  }

  const permissions = await findPermissionsWithUsers(collectionId);

  return {
    success: true,
    permissions,
  };
}

/**
 * Checks if a user has access to a collection and what level
 * Requirements: 13.1, 13.4
 */
export async function checkCollectionAccess(
  collectionId: string,
  userId: string
): Promise<AccessCheckResult> {
  // First check if user is the owner
  const collection = await findCollectionById(collectionId);
  if (!collection) {
    return {
      hasAccess: false,
      canEdit: false,
      canView: false,
    };
  }

  // Owner has full access
  if (collection.ownerId === userId) {
    return {
      hasAccess: true,
      role: 'owner',
      canEdit: true,
      canView: true,
    };
  }

  // Check for shared permission
  const role = await getUserRole(collectionId, userId);
  if (role) {
    return {
      hasAccess: true,
      role,
      canEdit: canEdit(role),
      canView: canView(role),
    };
  }

  // No access
  return {
    hasAccess: false,
    canEdit: false,
    canView: false,
  };
}

/**
 * Checks if a user can view a collection (owner, shared, or public)
 * Requirements: 13.1, 13.2
 */
export async function canViewCollection(
  collectionId: string,
  userId: string | null
): Promise<boolean> {
  const collection = await findCollectionById(collectionId);
  if (!collection) {
    return false;
  }

  // Public collections can be viewed by anyone
  if (collection.isPublic) {
    return true;
  }

  // Anonymous users can only view public collections
  if (!userId) {
    return false;
  }

  // Owner can always view
  if (collection.ownerId === userId) {
    return true;
  }

  // Check for shared permission
  const role = await getUserRole(collectionId, userId);
  return role !== null;
}

/**
 * Checks if a user can edit a collection (owner or editor)
 * Requirements: 13.1, 13.4
 */
export async function canEditCollection(
  collectionId: string,
  userId: string
): Promise<boolean> {
  const collection = await findCollectionById(collectionId);
  if (!collection) {
    return false;
  }

  // Owner can always edit
  if (collection.ownerId === userId) {
    return true;
  }

  // Check for editor permission
  const role = await getUserRole(collectionId, userId);
  return role === 'EDITOR';
}

/**
 * Gets public collection data by share slug (for anonymous access)
 * Requirements: 13.2
 */
export async function getPublicCollectionBySlug(shareSlug: string): Promise<{
  success: boolean;
  collection?: {
    id: string;
    title: string;
    description: string | null;
    icon: string;
    shareSlug: string;
  };
  error?: string;
  errorCode?: string;
}> {
  const collection = await findCollectionByShareSlug(shareSlug);
  
  if (!collection || !collection.isPublic) {
    return {
      success: false,
      error: 'Collection not found',
      errorCode: PermissionErrorCodes.COLLECTION_NOT_FOUND,
    };
  }

  // Return only public-safe fields
  return {
    success: true,
    collection: {
      id: collection.id,
      title: collection.title,
      description: collection.description ?? null,
      icon: collection.icon,
      shareSlug: collection.shareSlug!,
    },
  };
}

/**
 * Gets all permissions for a collection (internal use)
 */
export async function getCollectionPermissions(
  collectionId: string
): Promise<CollectionPermission[]> {
  return findPermissionsByCollection(collectionId);
}
