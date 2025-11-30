/**
 * Highlight Model - TypeScript interfaces, Zod schemas, and serialization
 * Requirements: 11.1, 11.2, 11.6, 11.7
 */
import { z } from 'zod';

// Highlight color enum matching Prisma schema
export const HighlightColor = {
  YELLOW: 'YELLOW',
  GREEN: 'GREEN',
  BLUE: 'BLUE',
  PINK: 'PINK',
  PURPLE: 'PURPLE',
} as const;

export type HighlightColor = (typeof HighlightColor)[keyof typeof HighlightColor];

// Zod schema for HighlightColor
export const HighlightColorSchema = z.enum([
  'YELLOW',
  'GREEN',
  'BLUE',
  'PINK',
  'PURPLE',
]);

// Zod schema for PositionContext - DOM context for re-rendering highlights
export const PositionContextSchema = z.object({
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  containerSelector: z.string().min(1),
  surroundingText: z.string(),
});

export type PositionContext = z.infer<typeof PositionContextSchema>;

// Zod schema for Highlight validation
export const HighlightSchema = z.object({
  id: z.string().uuid(),
  bookmarkId: z.string().uuid(),
  ownerId: z.string().uuid(),
  textSelected: z.string().min(1),
  color: HighlightColorSchema,
  annotationMd: z.string().nullable().optional(),
  positionContext: PositionContextSchema,
  snapshotId: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// TypeScript interface derived from Zod schema
export type Highlight = z.infer<typeof HighlightSchema>;


// Schema for creating a new highlight
export const CreateHighlightSchema = z.object({
  bookmarkId: z.string().uuid(),
  textSelected: z.string().min(1),
  color: HighlightColorSchema.optional(),
  annotationMd: z.string().nullable().optional(),
  positionContext: PositionContextSchema,
  snapshotId: z.string().nullable().optional(),
});

export type CreateHighlightDTO = z.infer<typeof CreateHighlightSchema>;

// Schema for updating a highlight
export const UpdateHighlightSchema = z.object({
  color: HighlightColorSchema.optional(),
  annotationMd: z.string().nullable().optional(),
});

export type UpdateHighlightDTO = z.infer<typeof UpdateHighlightSchema>;

/**
 * Serializes a Highlight object to JSON string with position context
 * Requirements: 11.6
 */
export function serializeHighlight(highlight: Highlight): string {
  return JSON.stringify({
    ...highlight,
    createdAt: highlight.createdAt.toISOString(),
    updatedAt: highlight.updatedAt.toISOString(),
  });
}

/**
 * Deserializes a JSON string to a Highlight object with validation
 * Requirements: 11.7
 */
export function deserializeHighlight(json: string): Highlight {
  const parsed = JSON.parse(json);
  return HighlightSchema.parse(parsed);
}

/**
 * Validates highlight data against the schema
 */
export function validateHighlight(data: unknown): z.SafeParseReturnType<unknown, Highlight> {
  return HighlightSchema.safeParse(data);
}

/**
 * Validates create highlight DTO
 */
export function validateCreateHighlight(data: unknown): z.SafeParseReturnType<unknown, CreateHighlightDTO> {
  return CreateHighlightSchema.safeParse(data);
}

/**
 * Validates update highlight DTO
 */
export function validateUpdateHighlight(data: unknown): z.SafeParseReturnType<unknown, UpdateHighlightDTO> {
  return UpdateHighlightSchema.safeParse(data);
}
