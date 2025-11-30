/**
 * Collection Model - TypeScript interfaces, Zod schemas, and serialization
 * Requirements: 3.1, 3.6, 3.7
 */
import { z } from 'zod';

// Zod schema for Collection validation
export const CollectionSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  icon: z.string().min(1),
  color: z.string().nullable().optional(),
  isPublic: z.boolean(),
  shareSlug: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  parentId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// TypeScript interface derived from Zod schema
export type Collection = z.infer<typeof CollectionSchema>;

// Schema for creating a new collection
export const CreateCollectionSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  icon: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export type CreateCollectionDTO = z.infer<typeof CreateCollectionSchema>;

// Schema for updating a collection
export const UpdateCollectionSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export type UpdateCollectionDTO = z.infer<typeof UpdateCollectionSchema>;


/**
 * Serializes a Collection object to JSON string
 * Requirements: 3.6
 */
export function serializeCollection(collection: Collection): string {
  return JSON.stringify({
    ...collection,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  });
}

/**
 * Deserializes a JSON string to a Collection object with validation
 * Requirements: 3.7
 */
export function deserializeCollection(json: string): Collection {
  const parsed = JSON.parse(json);
  return CollectionSchema.parse(parsed);
}

/**
 * Validates collection data against the schema
 */
export function validateCollection(data: unknown): z.SafeParseReturnType<unknown, Collection> {
  return CollectionSchema.safeParse(data);
}

/**
 * Validates create collection DTO
 */
export function validateCreateCollection(data: unknown): z.SafeParseReturnType<unknown, CreateCollectionDTO> {
  return CreateCollectionSchema.safeParse(data);
}

/**
 * Validates update collection DTO
 */
export function validateUpdateCollection(data: unknown): z.SafeParseReturnType<unknown, UpdateCollectionDTO> {
  return UpdateCollectionSchema.safeParse(data);
}
