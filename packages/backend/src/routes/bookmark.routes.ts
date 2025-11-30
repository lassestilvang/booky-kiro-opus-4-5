/**
 * Bookmark API Routes
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  createBookmarkForUser,
  getBookmarkWithTags,
  listBookmarks,
  updateBookmarkForUser,
  deleteBookmarkForUser,
  updateBookmarkTags,
} from '../services/bookmark.service.js';
import {
  validateCreateBookmark,
  validateUpdateBookmark,
} from '../models/bookmark.model.js';
import type { BookmarkFilters, PaginationOptions } from '../repositories/bookmark.repository.js';

// Request body types
interface CreateBookmarkBody {
  url: string;
  collectionId?: string;
  title?: string;
  excerpt?: string;
  coverUrl?: string;
  note?: string;
  tags?: string[];
}

interface UpdateBookmarkBody {
  collectionId?: string;
  title?: string;
  excerpt?: string;
  coverUrl?: string;
  note?: string;
  isFavorite?: boolean;
  sortOrder?: number;
  tags?: string[];
}

interface ListBookmarksQuery {
  collectionId?: string;
  tags?: string;
  type?: string;
  domain?: string;
  dateFrom?: string;
  dateTo?: string;
  isFavorite?: string;
  isBroken?: string;
  search?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}


// Response schemas for OpenAPI documentation
const bookmarkResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    ownerId: { type: 'string', format: 'uuid' },
    collectionId: { type: 'string', format: 'uuid' },
    url: { type: 'string', format: 'uri' },
    normalizedUrl: { type: 'string' },
    title: { type: 'string' },
    excerpt: { type: 'string', nullable: true },
    coverUrl: { type: 'string', format: 'uri', nullable: true },
    domain: { type: 'string' },
    type: { type: 'string', enum: ['LINK', 'ARTICLE', 'VIDEO', 'IMAGE', 'DOCUMENT', 'AUDIO'] },
    contentSnapshotPath: { type: 'string', nullable: true },
    contentIndexed: { type: 'boolean' },
    isDuplicate: { type: 'boolean' },
    isBroken: { type: 'boolean' },
    isFavorite: { type: 'boolean' },
    sortOrder: { type: 'integer' },
    note: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
      },
    },
  },
};

const paginatedBookmarksSchema = {
  type: 'object',
  properties: {
    data: { type: 'array', items: bookmarkResponseSchema },
    total: { type: 'integer' },
    page: { type: 'integer' },
    limit: { type: 'integer' },
    totalPages: { type: 'integer' },
  },
};


export async function bookmarkRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  /**
   * POST /v1/bookmarks - Create a new bookmark
   * Requirements: 2.1, 2.2
   */
  fastify.post<{ Body: CreateBookmarkBody }>('/bookmarks', {
    schema: {
      description: 'Create a new bookmark',
      tags: ['Bookmarks'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' },
          collectionId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          excerpt: { type: 'string' },
          coverUrl: { type: 'string', format: 'uri' },
          note: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      response: {
        201: bookmarkResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    
    // Validate input
    const validation = validateCreateBookmark(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: {
          code: 'VAL_002',
          message: 'Invalid bookmark data',
          requestId: request.id,
          details: validation.error.flatten(),
        },
      });
    }

    const result = await createBookmarkForUser(userId, validation.data);
    
    if (!result.success) {
      return reply.status(400).send({
        error: {
          code: result.errorCode,
          message: result.error,
          requestId: request.id,
        },
      });
    }

    return reply.status(201).send(result.bookmark);
  });


  /**
   * GET /v1/bookmarks - List bookmarks with filters
   * Requirements: 2.3
   */
  fastify.get<{ Querystring: ListBookmarksQuery }>('/bookmarks', {
    schema: {
      description: 'List bookmarks with optional filters and pagination',
      tags: ['Bookmarks'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          collectionId: { type: 'string', format: 'uuid' },
          tags: { type: 'string', description: 'Comma-separated tag names' },
          type: { type: 'string', enum: ['LINK', 'ARTICLE', 'VIDEO', 'IMAGE', 'DOCUMENT', 'AUDIO'] },
          domain: { type: 'string' },
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          isFavorite: { type: 'string', enum: ['true', 'false'] },
          isBroken: { type: 'string', enum: ['true', 'false'] },
          search: { type: 'string' },
          page: { type: 'string', default: '1' },
          limit: { type: 'string', default: '20' },
          sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'sortOrder'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
      response: {
        200: paginatedBookmarksSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const query = request.query;

    // Build filters
    const filters: BookmarkFilters = {};
    if (query.collectionId) filters.collectionId = query.collectionId;
    if (query.tags) filters.tags = query.tags.split(',').map(t => t.trim());
    if (query.type) filters.type = query.type as BookmarkFilters['type'];
    if (query.domain) filters.domain = query.domain;
    if (query.dateFrom) filters.dateFrom = new Date(query.dateFrom);
    if (query.dateTo) filters.dateTo = new Date(query.dateTo);
    if (query.isFavorite) filters.isFavorite = query.isFavorite === 'true';
    if (query.isBroken) filters.isBroken = query.isBroken === 'true';
    if (query.search) filters.search = query.search;

    // Build pagination
    const pagination: PaginationOptions = {
      page: parseInt(query.page || '1', 10),
      limit: Math.min(parseInt(query.limit || '20', 10), 100),
      sortBy: (query.sortBy as PaginationOptions['sortBy']) || 'createdAt',
      sortOrder: (query.sortOrder as PaginationOptions['sortOrder']) || 'desc',
    };

    const result = await listBookmarks(userId, filters, pagination);
    return reply.send(result);
  });


  /**
   * GET /v1/bookmarks/:id - Get a single bookmark
   * Requirements: 2.3
   */
  fastify.get<{ Params: { id: string } }>('/bookmarks/:id', {
    schema: {
      description: 'Get a single bookmark by ID',
      tags: ['Bookmarks'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          ...bookmarkResponseSchema,
          properties: {
            ...bookmarkResponseSchema.properties,
            tags: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        404: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const result = await getBookmarkWithTags(id, userId);
    
    if (!result.success) {
      return reply.status(404).send({
        error: {
          code: result.errorCode,
          message: result.error,
          requestId: request.id,
        },
      });
    }

    return reply.send(result.bookmark);
  });


  /**
   * PUT /v1/bookmarks/:id - Update a bookmark
   * Requirements: 2.4
   */
  fastify.put<{ Params: { id: string }; Body: UpdateBookmarkBody }>('/bookmarks/:id', {
    schema: {
      description: 'Update a bookmark',
      tags: ['Bookmarks'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          collectionId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          excerpt: { type: 'string' },
          coverUrl: { type: 'string', format: 'uri' },
          note: { type: 'string' },
          isFavorite: { type: 'boolean' },
          sortOrder: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      response: {
        200: bookmarkResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;
    const { tags, ...updateData } = request.body;

    // Validate update data
    const validation = validateUpdateBookmark(updateData);
    if (!validation.success) {
      return reply.status(400).send({
        error: {
          code: 'VAL_002',
          message: 'Invalid bookmark data',
          requestId: request.id,
          details: validation.error.flatten(),
        },
      });
    }

    // Update bookmark
    const result = await updateBookmarkForUser(id, userId, validation.data);
    
    if (!result.success) {
      const status = result.errorCode === 'BOOKMARK_NOT_FOUND' ? 404 : 400;
      return reply.status(status).send({
        error: {
          code: result.errorCode,
          message: result.error,
          requestId: request.id,
        },
      });
    }

    // Update tags if provided
    if (tags !== undefined) {
      await updateBookmarkTags(id, userId, tags);
    }

    // Return updated bookmark with tags
    const updatedResult = await getBookmarkWithTags(id, userId);
    return reply.send(updatedResult.bookmark);
  });


  /**
   * DELETE /v1/bookmarks/:id - Delete a bookmark
   * Requirements: 2.5
   */
  fastify.delete<{ Params: { id: string } }>('/bookmarks/:id', {
    schema: {
      description: 'Delete a bookmark and all associated data',
      tags: ['Bookmarks'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        204: {
          type: 'null',
          description: 'Bookmark deleted successfully',
        },
        404: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const result = await deleteBookmarkForUser(id, userId);
    
    if (!result.success) {
      return reply.status(404).send({
        error: {
          code: result.errorCode,
          message: result.error,
          requestId: request.id,
        },
      });
    }

    return reply.status(204).send();
  });
}
