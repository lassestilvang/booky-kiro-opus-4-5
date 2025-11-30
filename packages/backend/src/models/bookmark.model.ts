/**
 * Bookmark Model - TypeScript interfaces, Zod schemas, and serialization
 * Requirements: 2.1, 2.2, 2.7, 2.8
 */
import { z } from 'zod';

// Bookmark type enum matching Prisma schema
export const BookmarkType = {
  LINK: 'LINK',
  ARTICLE: 'ARTICLE',
  VIDEO: 'VIDEO',
  IMAGE: 'IMAGE',
  DOCUMENT: 'DOCUMENT',
  AUDIO: 'AUDIO',
} as const;

export type BookmarkType = (typeof BookmarkType)[keyof typeof BookmarkType];

// Zod schema for BookmarkType
export const BookmarkTypeSchema = z.enum([
  'LINK',
  'ARTICLE',
  'VIDEO',
  'IMAGE',
  'DOCUMENT',
  'AUDIO',
]);

// Zod schema for Bookmark validation
export const BookmarkSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  collectionId: z.string().uuid(),
  url: z.string().url(),
  normalizedUrl: z.string(),
  title: z.string().min(1),
  excerpt: z.string().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  domain: z.string().min(1),
  type: BookmarkTypeSchema,
  contentSnapshotPath: z.string().nullable().optional(),
  contentIndexed: z.boolean(),
  isDuplicate: z.boolean(),
  isBroken: z.boolean(),
  isFavorite: z.boolean(),
  sortOrder: z.number().int(),
  note: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// TypeScript interface derived from Zod schema
export type Bookmark = z.infer<typeof BookmarkSchema>;

// Schema for creating a new bookmark (partial, without auto-generated fields)
export const CreateBookmarkSchema = z.object({
  url: z.string().url(),
  collectionId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  excerpt: z.string().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateBookmarkDTO = z.infer<typeof CreateBookmarkSchema>;


// Schema for updating a bookmark
export const UpdateBookmarkSchema = z.object({
  collectionId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  excerpt: z.string().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateBookmarkDTO = z.infer<typeof UpdateBookmarkSchema>;

/**
 * Serializes a Bookmark object to JSON string
 * Requirements: 2.7
 */
export function serializeBookmark(bookmark: Bookmark): string {
  return JSON.stringify({
    ...bookmark,
    createdAt: bookmark.createdAt.toISOString(),
    updatedAt: bookmark.updatedAt.toISOString(),
  });
}

/**
 * Deserializes a JSON string to a Bookmark object with validation
 * Requirements: 2.8
 */
export function deserializeBookmark(json: string): Bookmark {
  const parsed = JSON.parse(json);
  return BookmarkSchema.parse(parsed);
}

/**
 * Validates bookmark data against the schema
 * Returns validation result with success flag and either data or error
 */
export function validateBookmark(data: unknown): z.SafeParseReturnType<unknown, Bookmark> {
  return BookmarkSchema.safeParse(data);
}

/**
 * Validates create bookmark DTO
 */
export function validateCreateBookmark(data: unknown): z.SafeParseReturnType<unknown, CreateBookmarkDTO> {
  return CreateBookmarkSchema.safeParse(data);
}

/**
 * Validates update bookmark DTO
 */
export function validateUpdateBookmark(data: unknown): z.SafeParseReturnType<unknown, UpdateBookmarkDTO> {
  return UpdateBookmarkSchema.safeParse(data);
}
