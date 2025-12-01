---
inclusion: always
---

# Project Structure

```
bookmark-manager/
├── packages/
│   ├── backend/           # Fastify API server
│   │   ├── prisma/        # Database schema and migrations
│   │   └── src/
│   │       ├── config/    # Environment and logger setup
│   │       ├── db/        # Prisma client singleton
│   │       ├── middleware/# Auth and rate limiting
│   │       ├── models/    # Zod schemas and TypeScript types
│   │       ├── repositories/ # Database access layer
│   │       ├── routes/    # API route handlers
│   │       ├── services/  # Business logic layer
│   │       ├── utils/     # Shared utilities
│   │       ├── app.ts     # Fastify app configuration
│   │       └── index.ts   # Entry point
│   ├── frontend/          # Web application (Vite)
│   └── extension/         # Browser extension
├── infra/docker/          # Docker initialization scripts
├── docker-compose.yml     # Local development services
├── tsconfig.base.json     # Shared TypeScript config
└── pnpm-workspace.yaml    # Workspace definition
```

## Architecture Layers

Backend follows a layered architecture with clear separation:

1. **Routes** → Request handling, validation, OpenAPI schemas
2. **Services** → Business logic, orchestration, error handling
3. **Repositories** → Database operations via Prisma
4. **Models** → Zod schemas, type definitions, validation functions

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Models | `{name}.model.ts` | `bookmark.model.ts` |
| Services | `{name}.service.ts` | `bookmark.service.ts` |
| Repositories | `{name}.repository.ts` | `bookmark.repository.ts` |
| Routes | `{name}.routes.ts` | `bookmark.routes.ts` |
| Middleware | `{name}.middleware.ts` | `auth.middleware.ts` |
| Property tests | `{name}.property.ts` | `bookmark.service.property.ts` |
| Unit tests | `{name}.test.ts` | `jwt.test.ts` |

Use kebab-case for all file names.

## Code Patterns

### Models (Zod-first approach)
```typescript
// 1. Define Zod schema first
export const BookmarkSchema = z.object({ ... });

// 2. Derive TypeScript type
export type Bookmark = z.infer<typeof BookmarkSchema>;

// 3. Export validation functions
export function validateBookmark(data: unknown): z.SafeParseReturnType<unknown, Bookmark>
export function validateCreateBookmark(data: unknown): z.SafeParseReturnType<unknown, CreateBookmarkDTO>
export function validateUpdateBookmark(data: unknown): z.SafeParseReturnType<unknown, UpdateBookmarkDTO>

// 4. Export serialization functions
export function serializeBookmark(bookmark: Bookmark): string
export function deserializeBookmark(json: string): Bookmark
```

### Services (Result pattern)
```typescript
// Return structured results with error codes
export interface BookmarkResult {
  success: boolean;
  bookmark?: Bookmark;
  error?: string;
  errorCode?: string;
}

// Define error codes as const objects
export const BookmarkErrorCodes = {
  NOT_FOUND: 'BOOKMARK_NOT_FOUND',
  INVALID_URL: 'BOOKMARK_INVALID_URL',
} as const;
```

### Routes (OpenAPI schemas inline)
```typescript
fastify.post<{ Body: CreateBookmarkBody }>('/bookmarks', {
  schema: {
    description: 'Create a new bookmark',
    tags: ['Bookmarks'],
    security: [{ bearerAuth: [] }],
    body: { type: 'object', ... },
    response: { 201: bookmarkResponseSchema, 400: errorResponseSchema },
  },
}, async (request, reply) => { ... });
```

### Imports
- Use `.js` extension in imports (ES Modules requirement)
- Import from relative paths: `import { prisma } from '../db/client.js';`

## Database Conventions

- Prisma schema uses `@map()` for snake_case column names
- TypeScript models use camelCase
- Always define indexes for foreign keys and frequently queried fields
- Use transactions for multi-step operations: `prisma.$transaction()`

## Testing

- Property-based tests use fast-check with `fc.assert()` and `fc.asyncProperty()`
- Limit database test runs: `{ numRuns: 10 }` for DB operations
- Clean up test data in `beforeEach`/`afterAll` hooks
- Run tests with `vitest run` (not watch mode)

## Error Response Format

```typescript
{
  error: {
    code: 'ERROR_CODE',
    message: 'Human readable message',
    requestId: request.id,
    details?: { ... }  // Optional validation details
  }
}
```

## Ownership Pattern

All user-owned resources require ownership verification:
```typescript
// Repository: findByIdAndOwner pattern
export async function findBookmarkByIdAndOwner(id: string, ownerId: string)

// Service: Always pass ownerId from authenticated request
const result = await getBookmarkById(id, request.user!.userId);
```
