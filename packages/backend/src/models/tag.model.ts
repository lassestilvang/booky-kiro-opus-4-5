/**
 * Tag Model - TypeScript interfaces, Zod schemas, and normalization
 * Requirements: 4.1
 */
import { z } from 'zod';

// Zod schema for Tag validation
export const TagSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  color: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});

// TypeScript interface derived from Zod schema
export type Tag = z.infer<typeof TagSchema>;

// Schema for creating a new tag
export const CreateTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().nullable().optional(),
});

export type CreateTagDTO = z.infer<typeof CreateTagSchema>;

// Schema for updating a tag
export const UpdateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
});

export type UpdateTagDTO = z.infer<typeof UpdateTagSchema>;

/**
 * Normalizes a tag name by converting to lowercase and trimming whitespace
 * Requirements: 4.1
 * 
 * This ensures consistent tag matching regardless of case or leading/trailing spaces.
 * The normalization is idempotent: normalizing twice produces the same result.
 */
export function normalizeTagName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Validates tag data against the schema
 */
export function validateTag(data: unknown): z.SafeParseReturnType<unknown, Tag> {
  return TagSchema.safeParse(data);
}

/**
 * Validates create tag DTO
 */
export function validateCreateTag(data: unknown): z.SafeParseReturnType<unknown, CreateTagDTO> {
  return CreateTagSchema.safeParse(data);
}

/**
 * Validates update tag DTO
 */
export function validateUpdateTag(data: unknown): z.SafeParseReturnType<unknown, UpdateTagDTO> {
  return UpdateTagSchema.safeParse(data);
}

/**
 * Creates a normalized tag name from a display name
 * Useful when creating new tags to ensure consistency
 */
export function createTagWithNormalizedName(name: string): { name: string; normalizedName: string } {
  return {
    name: name.trim(), // Preserve original case but trim whitespace
    normalizedName: normalizeTagName(name),
  };
}
