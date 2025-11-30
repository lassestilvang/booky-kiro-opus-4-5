/**
 * Permission Model - TypeScript interfaces, Zod schemas, and serialization
 * Requirements: 13.1, 13.4
 */
import { z } from 'zod';

// Permission role enum
export const PermissionRoleSchema = z.enum(['VIEWER', 'EDITOR']);
export type PermissionRole = z.infer<typeof PermissionRoleSchema>;

// Zod schema for CollectionPermission validation
export const CollectionPermissionSchema = z.object({
  id: z.string().uuid(),
  collectionId: z.string().uuid(),
  userId: z.string().uuid(),
  role: PermissionRoleSchema,
  createdAt: z.coerce.date(),
});

// TypeScript interface derived from Zod schema
export type CollectionPermission = z.infer<typeof CollectionPermissionSchema>;

// Schema for creating a new permission (sharing a collection)
export const CreatePermissionSchema = z.object({
  collectionId: z.string().uuid(),
  userId: z.string().uuid(),
  role: PermissionRoleSchema.default('VIEWER'),
});

export type CreatePermissionDTO = z.infer<typeof CreatePermissionSchema>;

// Schema for updating a permission
export const UpdatePermissionSchema = z.object({
  role: PermissionRoleSchema,
});

export type UpdatePermissionDTO = z.infer<typeof UpdatePermissionSchema>;

// Schema for share request body
export const ShareCollectionSchema = z.object({
  userId: z.string().uuid(),
  role: PermissionRoleSchema.default('VIEWER'),
});

export type ShareCollectionDTO = z.infer<typeof ShareCollectionSchema>;

/**
 * Serializes a CollectionPermission object to JSON string
 */
export function serializePermission(permission: CollectionPermission): string {
  return JSON.stringify({
    ...permission,
    createdAt: permission.createdAt.toISOString(),
  });
}

/**
 * Deserializes a JSON string to a CollectionPermission object with validation
 */
export function deserializePermission(json: string): CollectionPermission {
  const parsed = JSON.parse(json);
  return CollectionPermissionSchema.parse(parsed);
}

/**
 * Validates permission data against the schema
 */
export function validatePermission(data: unknown): z.SafeParseReturnType<unknown, CollectionPermission> {
  return CollectionPermissionSchema.safeParse(data);
}

/**
 * Validates create permission DTO
 */
export function validateCreatePermission(data: unknown): z.SafeParseReturnType<unknown, CreatePermissionDTO> {
  return CreatePermissionSchema.safeParse(data);
}

/**
 * Validates share collection DTO
 */
export function validateShareCollection(data: unknown): z.SafeParseReturnType<unknown, ShareCollectionDTO> {
  return ShareCollectionSchema.safeParse(data);
}

/**
 * Checks if a role has edit permissions
 */
export function canEdit(role: PermissionRole): boolean {
  return role === 'EDITOR';
}

/**
 * Checks if a role has view permissions (all roles can view)
 */
export function canView(role: PermissionRole): boolean {
  return role === 'VIEWER' || role === 'EDITOR';
}
