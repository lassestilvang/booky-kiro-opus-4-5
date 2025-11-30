/**
 * Collection API Routes
 * Requirements: 3.1, 3.2, 3.3, 3.4, 13.1, 13.2, 13.3, 13.4
 */
import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  createCollectionForUser,
  getCollectionWithCount,
  listCollectionsWithCounts,
  updateCollectionForUser,
  deleteCollectionForUser,
  makeCollectionPublic,
  makeCollectionPrivate,
} from '../services/collection.service.js';
import {
  shareCollection,
  revokeShare,
  listCollectionShares,
  getPublicCollectionWithBookmarks,
} from '../services/permission.service.js';
import {
  validateCreateCollection,
  validateUpdateCollection,
} from '../models/collection.model.js';
import { validateShareCollection } from '../models/permission.model.js';

// Request body types
interface CreateCollectionBody {
  title: string;
  description?: string | null;
  icon?: string;
  color?: string | null;
  isPublic?: boolean;
  parentId?: string | null;
}

interface UpdateCollectionBody {
  title?: string;
  description?: string | null;
  icon?: string;
  color?: string | null;
  isPublic?: boolean;
  sortOrder?: number;
  parentId?: string | null;
}

// Response schemas for OpenAPI documentation
const collectionResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    ownerId: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    icon: { type: 'string' },
    color: { type: 'string', nullable: true },
    isPublic: { type: 'boolean' },
    shareSlug: { type: 'string', nullable: true },
    sortOrder: { type: 'integer' },
    parentId: { type: 'string', format: 'uuid', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    bookmarkCount: { type: 'integer' },
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


export async function collectionRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  /**
   * POST /v1/collections - Create a new collection
   * Requirements: 3.1
   */
  fastify.post<{ Body: CreateCollectionBody }>('/collections', {
    schema: {
      description: 'Create a new collection',
      tags: ['Collections'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string', nullable: true },
          icon: { type: 'string' },
          color: { type: 'string', nullable: true },
          isPublic: { type: 'boolean' },
          parentId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      response: {
        201: collectionResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    
    // Validate input
    const validation = validateCreateCollection(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: {
          code: 'VAL_002',
          message: 'Invalid collection data',
          requestId: request.id,
          details: validation.error.flatten(),
        },
      });
    }

    const result = await createCollectionForUser(userId, validation.data);
    
    if (!result.success) {
      return reply.status(400).send({
        error: {
          code: result.errorCode,
          message: result.error,
          requestId: request.id,
        },
      });
    }

    return reply.status(201).send({
      ...result.collection,
      bookmarkCount: 0,
    });
  });

  /**
   * GET /v1/collections - List user's collections
   * Requirements: 3.2
   */
  fastify.get('/collections', {
    schema: {
      description: 'List all collections for the authenticated user',
      tags: ['Collections'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: collectionResponseSchema,
        },
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const collections = await listCollectionsWithCounts(userId);
    return reply.send(collections);
  });

  /**
   * GET /v1/collections/:id - Get collection details
   * Requirements: 3.2
   */
  fastify.get<{ Params: { id: string } }>('/collections/:id', {
    schema: {
      description: 'Get a single collection by ID',
      tags: ['Collections'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: collectionResponseSchema,
        404: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const result = await getCollectionWithCount(id, userId);
    
    if (!result.success) {
      return reply.status(404).send({
        error: {
          code: result.errorCode,
          message: result.error,
          requestId: request.id,
        },
      });
    }

    return reply.send(result.collection);
  });


  /**
   * PUT /v1/collections/:id - Update a collection
   * Requirements: 3.1
   */
  fastify.put<{ Params: { id: string }; Body: UpdateCollectionBody }>('/collections/:id', {
    schema: {
      description: 'Update a collection',
      tags: ['Collections'],
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
          title: { type: 'string', minLength: 1 },
          description: { type: 'string', nullable: true },
          icon: { type: 'string' },
          color: { type: 'string', nullable: true },
          isPublic: { type: 'boolean' },
          sortOrder: { type: 'integer' },
          parentId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      response: {
        200: collectionResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    // Validate update data
    const validation = validateUpdateCollection(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: {
          code: 'VAL_002',
          message: 'Invalid collection data',
          requestId: request.id,
          details: validation.error.flatten(),
        },
      });
    }

    // Handle public/private toggle
    if (validation.data.isPublic === true) {
      const publicResult = await makeCollectionPublic(id, userId);
      if (!publicResult.success) {
        const status = publicResult.errorCode === 'COLLECTION_NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({
          error: {
            code: publicResult.errorCode,
            message: publicResult.error,
            requestId: request.id,
          },
        });
      }
    } else if (validation.data.isPublic === false) {
      const privateResult = await makeCollectionPrivate(id, userId);
      if (!privateResult.success) {
        const status = privateResult.errorCode === 'COLLECTION_NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({
          error: {
            code: privateResult.errorCode,
            message: privateResult.error,
            requestId: request.id,
          },
        });
      }
    }

    // Update other fields (isPublic already handled above)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isPublic: _, ...otherData } = validation.data;
    if (Object.keys(otherData).length > 0) {
      const result = await updateCollectionForUser(id, userId, otherData);
      if (!result.success) {
        const status = result.errorCode === 'COLLECTION_NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({
          error: {
            code: result.errorCode,
            message: result.error,
            requestId: request.id,
          },
        });
      }
    }

    // Return updated collection with count
    const updatedResult = await getCollectionWithCount(id, userId);
    return reply.send(updatedResult.collection);
  });

  /**
   * DELETE /v1/collections/:id - Delete a collection
   * Requirements: 3.4
   */
  fastify.delete<{ Params: { id: string } }>('/collections/:id', {
    schema: {
      description: 'Delete a collection (bookmarks are moved to Unsorted)',
      tags: ['Collections'],
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
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            movedBookmarks: { type: 'integer' },
          },
        },
        400: errorResponseSchema,
        404: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const result = await deleteCollectionForUser(id, userId);
    
    if (!result.success) {
      const status = result.errorCode === 'COLLECTION_NOT_FOUND' ? 404 : 400;
      return reply.status(status).send({
        error: {
          code: result.errorCode,
          message: result.error,
          requestId: request.id,
        },
      });
    }

    return reply.send({
      success: true,
      movedBookmarks: result.movedBookmarks,
    });
  });

  /**
   * POST /v1/collections/:id/share - Share a collection with another user
   * Requirements: 13.1
   */
  fastify.post<{ Params: { id: string }; Body: { userId: string; role?: 'VIEWER' | 'EDITOR' } }>(
    '/collections/:id/share',
    {
      schema: {
        description: 'Share a collection with another user',
        tags: ['Collections', 'Sharing'],
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
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
            role: { type: 'string', enum: ['VIEWER', 'EDITOR'], default: 'VIEWER' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              collectionId: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid' },
              role: { type: 'string', enum: ['VIEWER', 'EDITOR'] },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const ownerId = request.user!.userId;
      const { id: collectionId } = request.params;

      // Validate input
      const validation = validateShareCollection(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: {
            code: 'VAL_002',
            message: 'Invalid share data',
            requestId: request.id,
            details: validation.error.flatten(),
          },
        });
      }

      const result = await shareCollection(collectionId, ownerId, validation.data);

      if (!result.success) {
        const statusMap: Record<string, number> = {
          PERMISSION_COLLECTION_NOT_FOUND: 404,
          PERMISSION_USER_NOT_FOUND: 404,
          PERMISSION_NOT_OWNER: 403,
          PERMISSION_CANNOT_SHARE_WITH_SELF: 400,
          PERMISSION_ALREADY_SHARED: 400,
        };
        const status = statusMap[result.errorCode!] ?? 400;
        return reply.status(status).send({
          error: {
            code: result.errorCode,
            message: result.error,
            requestId: request.id,
          },
        });
      }

      return reply.status(201).send(result.permission);
    }
  );

  /**
   * GET /v1/collections/:id/share - List users a collection is shared with
   * Requirements: 13.1
   */
  fastify.get<{ Params: { id: string } }>('/collections/:id/share', {
    schema: {
      description: 'List all users a collection is shared with',
      tags: ['Collections', 'Sharing'],
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
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              collectionId: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid' },
              role: { type: 'string', enum: ['VIEWER', 'EDITOR'] },
              createdAt: { type: 'string', format: 'date-time' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        404: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const ownerId = request.user!.userId;
    const { id: collectionId } = request.params;

    const result = await listCollectionShares(collectionId, ownerId);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        PERMISSION_COLLECTION_NOT_FOUND: 404,
        PERMISSION_NOT_OWNER: 403,
      };
      const status = statusMap[result.errorCode!] ?? 400;
      return reply.status(status).send({
        error: {
          code: result.errorCode,
          message: result.error,
          requestId: request.id,
        },
      });
    }

    return reply.send(result.permissions);
  });

  /**
   * DELETE /v1/collections/:id/share/:userId - Revoke sharing with a user
   * Requirements: 13.4
   */
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/collections/:id/share/:userId',
    {
      schema: {
        description: 'Revoke sharing of a collection with a user',
        tags: ['Collections', 'Sharing'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          404: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const ownerId = request.user!.userId;
      const { id: collectionId, userId: targetUserId } = request.params;

      const result = await revokeShare(collectionId, ownerId, targetUserId);

      if (!result.success) {
        const statusMap: Record<string, number> = {
          PERMISSION_COLLECTION_NOT_FOUND: 404,
          PERMISSION_NOT_OWNER: 403,
          PERMISSION_NOT_FOUND: 404,
        };
        const status = statusMap[result.errorCode!] ?? 400;
        return reply.status(status).send({
          error: {
            code: result.errorCode,
            message: result.error,
            requestId: request.id,
          },
        });
      }

      return reply.send({ success: true });
    }
  );
}

/**
 * Public collection routes (no auth required)
 * Requirements: 13.2
 */
export async function publicCollectionRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/public/:slug - Get public collection by share slug with bookmarks
   * Requirements: 13.2
   */
  fastify.get<{ Params: { slug: string }; Querystring: { page?: number; limit?: number } }>(
    '/public/:slug',
    {
      schema: {
        description: 'Get a public collection by its share slug with bookmarks',
        tags: ['Collections', 'Public'],
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              collection: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  icon: { type: 'string' },
                  shareSlug: { type: 'string' },
                },
              },
              bookmarks: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        url: { type: 'string' },
                        title: { type: 'string' },
                        excerpt: { type: 'string', nullable: true },
                        coverUrl: { type: 'string', nullable: true },
                        domain: { type: 'string' },
                        type: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          },
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const { page, limit } = request.query;

      const result = await getPublicCollectionWithBookmarks(slug, { page, limit });

      if (!result.success) {
        return reply.status(404).send({
          error: {
            code: result.errorCode,
            message: result.error,
            requestId: request.id,
          },
        });
      }

      return reply.send({
        collection: result.collection,
        bookmarks: result.bookmarks,
      });
    }
  );
}
