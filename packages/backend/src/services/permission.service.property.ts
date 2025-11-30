/**
 * Property-based tests for Permission Service
 * Tests business logic properties for sharing and permission operations
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { prisma } from '../db/client.js';
import {
  shareCollection,
  revokeShare,
  checkCollectionAccess,
  canViewCollection,
  canEditCollection,
  getPublicCollectionBySlug,
} from './permission.service.js';
import {
  createCollectionForUser,
  makeCollectionPublic,
} from './collection.service.js';
import type { PermissionRole } from '../models/permission.model.js';

// Test users for property tests
let ownerUserId: string;
let viewerUserId: string;
let editorUserId: string;
let otherUserId: string;

// Arbitrary for generating collection titles
const collectionTitleArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 -]{2,30}$/);

// Arbitrary for permission roles
const roleArb = fc.constantFrom<PermissionRole>('VIEWER', 'EDITOR');

beforeAll(async () => {
  // Create test users
  const timestamp = Date.now();
  const [owner, viewer, editor, other] = await Promise.all([
    prisma.user.create({
      data: {
        email: `test-perm-owner-${timestamp}@test.com`,
        passwordHash: 'test-hash',
        name: 'Owner User',
      },
    }),
    prisma.user.create({
      data: {
        email: `test-perm-viewer-${timestamp}@test.com`,
        passwordHash: 'test-hash',
        name: 'Viewer User',
      },
    }),
    prisma.user.create({
      data: {
        email: `test-perm-editor-${timestamp}@test.com`,
        passwordHash: 'test-hash',
        name: 'Editor User',
      },
    }),
    prisma.user.create({
      data: {
        email: `test-perm-other-${timestamp}@test.com`,
        passwordHash: 'test-hash',
        name: 'Other User',
      },
    }),
  ]);
  ownerUserId = owner.id;
  viewerUserId = viewer.id;
  editorUserId = editor.id;
  otherUserId = other.id;
});

afterAll(async () => {
  // Clean up test data
  await prisma.collectionPermission.deleteMany({
    where: {
      OR: [
        { userId: viewerUserId },
        { userId: editorUserId },
        { userId: otherUserId },
      ],
    },
  });
  await prisma.bookmark.deleteMany({
    where: {
      ownerId: { in: [ownerUserId, viewerUserId, editorUserId, otherUserId] },
    },
  });
  await prisma.collection.deleteMany({
    where: {
      ownerId: { in: [ownerUserId, viewerUserId, editorUserId, otherUserId] },
    },
  });
  await prisma.user.deleteMany({
    where: {
      id: { in: [ownerUserId, viewerUserId, editorUserId, otherUserId] },
    },
  });
});

beforeEach(async () => {
  // Clean up permissions and collections before each test
  await prisma.collectionPermission.deleteMany({
    where: {
      OR: [
        { userId: viewerUserId },
        { userId: editorUserId },
        { userId: otherUserId },
      ],
    },
  });
  await prisma.collection.deleteMany({
    where: {
      ownerId: ownerUserId,
      title: { not: 'Unsorted' },
    },
  });
});

describe('Permission-Based Access Control', () => {
  /**
   * **Feature: bookmark-manager, Property 18: Permission-Based Access Control**
   * **Validates: Requirements 13.1, 13.4**
   *
   * For any shared collection with viewer role, the viewer should be able to read
   * but not modify the collection or its bookmarks.
   */
  it('should allow viewers to read but not edit shared collections', async () => {
    await fc.assert(
      fc.asyncProperty(collectionTitleArb, async (title) => {
        // Create a collection owned by the owner
        const collectionResult = await createCollectionForUser(ownerUserId, {
          title: `${title}-${Date.now()}`,
          icon: 'folder',
        });
        expect(collectionResult.success).toBe(true);
        const collectionId = collectionResult.collection!.id;

        try {
          // Share with viewer role
          const shareResult = await shareCollection(collectionId, ownerUserId, {
            userId: viewerUserId,
            role: 'VIEWER',
          });
          expect(shareResult.success).toBe(true);

          // Check access for viewer
          const accessResult = await checkCollectionAccess(collectionId, viewerUserId);
          expect(accessResult.hasAccess).toBe(true);
          expect(accessResult.role).toBe('VIEWER');
          expect(accessResult.canView).toBe(true);
          expect(accessResult.canEdit).toBe(false);

          // Verify canViewCollection returns true
          const canView = await canViewCollection(collectionId, viewerUserId);
          expect(canView).toBe(true);

          // Verify canEditCollection returns false
          const canEdit = await canEditCollection(collectionId, viewerUserId);
          expect(canEdit).toBe(false);
        } finally {
          await prisma.collection.delete({ where: { id: collectionId } }).catch(() => {});
        }
      }),
      { numRuns: 20 }
    );
  });

  it('should allow editors to read and edit shared collections', async () => {
    await fc.assert(
      fc.asyncProperty(collectionTitleArb, async (title) => {
        // Create a collection owned by the owner
        const collectionResult = await createCollectionForUser(ownerUserId, {
          title: `${title}-${Date.now()}`,
          icon: 'folder',
        });
        expect(collectionResult.success).toBe(true);
        const collectionId = collectionResult.collection!.id;

        try {
          // Share with editor role
          const shareResult = await shareCollection(collectionId, ownerUserId, {
            userId: editorUserId,
            role: 'EDITOR',
          });
          expect(shareResult.success).toBe(true);

          // Check access for editor
          const accessResult = await checkCollectionAccess(collectionId, editorUserId);
          expect(accessResult.hasAccess).toBe(true);
          expect(accessResult.role).toBe('EDITOR');
          expect(accessResult.canView).toBe(true);
          expect(accessResult.canEdit).toBe(true);

          // Verify canViewCollection returns true
          const canView = await canViewCollection(collectionId, editorUserId);
          expect(canView).toBe(true);

          // Verify canEditCollection returns true
          const canEdit = await canEditCollection(collectionId, editorUserId);
          expect(canEdit).toBe(true);
        } finally {
          await prisma.collection.delete({ where: { id: collectionId } }).catch(() => {});
        }
      }),
      { numRuns: 20 }
    );
  });

  it('should deny access to users without permissions', async () => {
    await fc.assert(
      fc.asyncProperty(collectionTitleArb, async (title) => {
        // Create a collection owned by the owner
        const collectionResult = await createCollectionForUser(ownerUserId, {
          title: `${title}-${Date.now()}`,
          icon: 'folder',
        });
        expect(collectionResult.success).toBe(true);
        const collectionId = collectionResult.collection!.id;

        try {
          // Check access for user without permission
          const accessResult = await checkCollectionAccess(collectionId, otherUserId);
          expect(accessResult.hasAccess).toBe(false);
          expect(accessResult.canView).toBe(false);
          expect(accessResult.canEdit).toBe(false);

          // Verify canViewCollection returns false
          const canView = await canViewCollection(collectionId, otherUserId);
          expect(canView).toBe(false);

          // Verify canEditCollection returns false
          const canEdit = await canEditCollection(collectionId, otherUserId);
          expect(canEdit).toBe(false);
        } finally {
          await prisma.collection.delete({ where: { id: collectionId } }).catch(() => {});
        }
      }),
      { numRuns: 20 }
    );
  });

  it('should revoke access when share is removed', async () => {
    await fc.assert(
      fc.asyncProperty(collectionTitleArb, roleArb, async (title, role) => {
        // Create a collection owned by the owner
        const collectionResult = await createCollectionForUser(ownerUserId, {
          title: `${title}-${Date.now()}`,
          icon: 'folder',
        });
        expect(collectionResult.success).toBe(true);
        const collectionId = collectionResult.collection!.id;

        try {
          // Share with the viewer user
          const shareResult = await shareCollection(collectionId, ownerUserId, {
            userId: viewerUserId,
            role,
          });
          expect(shareResult.success).toBe(true);

          // Verify access exists
          const accessBefore = await checkCollectionAccess(collectionId, viewerUserId);
          expect(accessBefore.hasAccess).toBe(true);

          // Revoke the share
          const revokeResult = await revokeShare(collectionId, ownerUserId, viewerUserId);
          expect(revokeResult.success).toBe(true);

          // Verify access is revoked
          const accessAfter = await checkCollectionAccess(collectionId, viewerUserId);
          expect(accessAfter.hasAccess).toBe(false);
          expect(accessAfter.canView).toBe(false);
          expect(accessAfter.canEdit).toBe(false);
        } finally {
          await prisma.collection.delete({ where: { id: collectionId } }).catch(() => {});
        }
      }),
      { numRuns: 20 }
    );
  });

  it('should give owner full access regardless of permissions', async () => {
    await fc.assert(
      fc.asyncProperty(collectionTitleArb, async (title) => {
        // Create a collection owned by the owner
        const collectionResult = await createCollectionForUser(ownerUserId, {
          title: `${title}-${Date.now()}`,
          icon: 'folder',
        });
        expect(collectionResult.success).toBe(true);
        const collectionId = collectionResult.collection!.id;

        try {
          // Check access for owner
          const accessResult = await checkCollectionAccess(collectionId, ownerUserId);
          expect(accessResult.hasAccess).toBe(true);
          expect(accessResult.role).toBe('owner');
          expect(accessResult.canView).toBe(true);
          expect(accessResult.canEdit).toBe(true);

          // Verify canViewCollection returns true
          const canView = await canViewCollection(collectionId, ownerUserId);
          expect(canView).toBe(true);

          // Verify canEditCollection returns true
          const canEdit = await canEditCollection(collectionId, ownerUserId);
          expect(canEdit).toBe(true);
        } finally {
          await prisma.collection.delete({ where: { id: collectionId } }).catch(() => {});
        }
      }),
      { numRuns: 20 }
    );
  });
});

describe('Public Collection Anonymous Access', () => {
  /**
   * **Feature: bookmark-manager, Property 19: Public Collection Anonymous Access**
   * **Validates: Requirements 13.2**
   *
   * For any collection marked as public with a share slug, unauthenticated requests
   * to that slug should return the collection contents in read-only mode.
   */
  it('should allow anonymous access to public collections via share slug', async () => {
    await fc.assert(
      fc.asyncProperty(collectionTitleArb, async (title) => {
        // Create a collection owned by the owner
        const collectionResult = await createCollectionForUser(ownerUserId, {
          title: `${title}-${Date.now()}`,
          icon: 'folder',
        });
        expect(collectionResult.success).toBe(true);
        const collectionId = collectionResult.collection!.id;

        try {
          // Make the collection public
          const publicResult = await makeCollectionPublic(collectionId, ownerUserId);
          expect(publicResult.success).toBe(true);
          expect(publicResult.collection!.isPublic).toBe(true);
          const shareSlug = publicResult.collection!.shareSlug!;

          // Verify anonymous access via share slug
          const publicAccess = await getPublicCollectionBySlug(shareSlug);
          expect(publicAccess.success).toBe(true);
          expect(publicAccess.collection).toBeDefined();
          expect(publicAccess.collection!.id).toBe(collectionId);
          expect(publicAccess.collection!.shareSlug).toBe(shareSlug);

          // Verify canViewCollection returns true for null user (anonymous)
          const canView = await canViewCollection(collectionId, null);
          expect(canView).toBe(true);
        } finally {
          await prisma.collection.delete({ where: { id: collectionId } }).catch(() => {});
        }
      }),
      { numRuns: 20 }
    );
  });

  it('should deny anonymous access to private collections', async () => {
    await fc.assert(
      fc.asyncProperty(collectionTitleArb, async (title) => {
        // Create a private collection
        const collectionResult = await createCollectionForUser(ownerUserId, {
          title: `${title}-${Date.now()}`,
          icon: 'folder',
          isPublic: false,
        });
        expect(collectionResult.success).toBe(true);
        const collectionId = collectionResult.collection!.id;

        try {
          // Verify canViewCollection returns false for null user (anonymous)
          const canView = await canViewCollection(collectionId, null);
          expect(canView).toBe(false);
        } finally {
          await prisma.collection.delete({ where: { id: collectionId } }).catch(() => {});
        }
      }),
      { numRuns: 20 }
    );
  });

  it('should return not found for invalid share slugs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z0-9]{8,16}$/),
        async (invalidSlug) => {
          // Try to access with an invalid slug
          const result = await getPublicCollectionBySlug(invalidSlug);
          expect(result.success).toBe(false);
          expect(result.errorCode).toBe('PERMISSION_COLLECTION_NOT_FOUND');
        }
      ),
      { numRuns: 20 }
    );
  });
});
