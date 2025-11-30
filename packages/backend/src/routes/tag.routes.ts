/**
 * Tag API Routes
 * Requirements: 4.1, 4.6, 4.7
 */
import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  createTagForUser,
  listTagsWithCounts,
  getTagSuggestionsForUser,
  mergeTagsForUser,
  updateTagForUser,
  deleteTagForUser,
} from '../services/tag.service.js';
import { validateCreateTag, validateUpdateTag } from '../models/tag.model.js';

// Request body types
interface CreateTagBody {
  name: string;
  color?: string | null;
}

interface UpdateTagBody {
  name?: string;
  color?: string | null;
}

interface MergeTagsBody {
  sourceTagId: string;
  targetTagId: string;
}

interface TagSuggestionsQuery {
  prefix: string;
  limit?: string;
}

// Response schemas for OpenAPI documentation
const tagResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    ownerId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    normalizedName: { type: 'string' },
    color: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const tagWithCountSchema = {
  type: 'object',
  properties: {
    ...tagResponseSchema.properties,
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


export async function tagRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  /**
   * GET /v1/tags - List user's tags with bookmark counts
   * Requirements: 4.1
   */
  fastify.get('/tags', {
    schema: {
      description: 'List all tags for the authenticated user with bookmark counts',
      tags: ['Tags'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: tagWithCountSchema,
        },
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const tags = await listTagsWithCounts(userId);
    return reply.send(tags);
  });

  /**
   * POST /v1/tags - Create a new tag
   * Requirements: 4.1
   */
  fastify.post<{ Body: CreateTagBody }>('/tags', {
    schema: {
      description: 'Create a new tag',
      tags: ['Tags'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          color: { type: 'string', nullable: true },
        },
      },
      response: {
        201: tagResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;

    // Validate input
    const validation = validateCreateTag(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: {
          code: 'VAL_002',
          message: 'Invalid tag data',
          requestId: request.id,
          details: validation.error.flatten(),
        },
      });
    }

    const result = await createTagForUser(userId, validation.data);

    if (!result.success) {
      // If tag already exists, return it with 200 instead of error
      if (result.errorCode === 'TAG_ALREADY_EXISTS' && result.tag) {
        return reply.status(200).send(result.tag);
      }
      return reply.status(400).send({
        error: {
          code: result.errorCode,
          message: result.error,
          requestId: request.id,
        },
      });
    }

    return reply.status(201).send(result.tag);
  });


  /**
   * GET /v1/tags/suggestions - Get tag suggestions based on prefix
   * Requirements: 4.6
   */
  fastify.get<{ Querystring: TagSuggestionsQuery }>('/tags/suggestions', {
    schema: {
      description: 'Get tag suggestions based on prefix matching',
      tags: ['Tags'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['prefix'],
        properties: {
          prefix: { type: 'string', minLength: 1 },
          limit: { type: 'string', default: '10' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: tagResponseSchema,
        },
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { prefix, limit } = request.query;

    const suggestions = await getTagSuggestionsForUser(
      userId,
      prefix,
      parseInt(limit || '10', 10)
    );

    return reply.send(suggestions);
  });

  /**
   * POST /v1/tags/merge - Merge two tags
   * Requirements: 4.7
   */
  fastify.post<{ Body: MergeTagsBody }>('/tags/merge', {
    schema: {
      description: 'Merge source tag into target tag. All bookmarks with source tag will be associated with target tag.',
      tags: ['Tags'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['sourceTagId', 'targetTagId'],
        properties: {
          sourceTagId: { type: 'string', format: 'uuid' },
          targetTagId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            affectedBookmarks: { type: 'integer' },
          },
        },
        400: errorResponseSchema,
        404: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { sourceTagId, targetTagId } = request.body;

    const result = await mergeTagsForUser(sourceTagId, targetTagId, userId);

    if (!result.success) {
      const status = result.errorCode?.includes('NOT_FOUND') ? 404 : 400;
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
      affectedBookmarks: result.affectedBookmarks,
    });
  });


  /**
   * PUT /v1/tags/:id - Update a tag
   * Requirements: 4.1
   */
  fastify.put<{ Params: { id: string }; Body: UpdateTagBody }>('/tags/:id', {
    schema: {
      description: 'Update a tag',
      tags: ['Tags'],
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
          name: { type: 'string', minLength: 1 },
          color: { type: 'string', nullable: true },
        },
      },
      response: {
        200: tagResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    // Validate input
    const validation = validateUpdateTag(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: {
          code: 'VAL_002',
          message: 'Invalid tag data',
          requestId: request.id,
          details: validation.error.flatten(),
        },
      });
    }

    const result = await updateTagForUser(id, userId, validation.data);

    if (!result.success) {
      const status = result.errorCode === 'TAG_NOT_FOUND' ? 404 : 400;
      return reply.status(status).send({
        error: {
          code: result.errorCode,
          message: result.error,
          requestId: request.id,
        },
      });
    }

    return reply.send(result.tag);
  });

  /**
   * DELETE /v1/tags/:id - Delete a tag
   * Requirements: 4.1
   */
  fastify.delete<{ Params: { id: string } }>('/tags/:id', {
    schema: {
      description: 'Delete a tag',
      tags: ['Tags'],
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
          description: 'Tag deleted successfully',
        },
        404: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const result = await deleteTagForUser(id, userId);

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
