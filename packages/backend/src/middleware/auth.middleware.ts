/**
 * Auth Middleware - JWT token validation for protected routes
 * Requirements: 1.2
 */
import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { verifyAccessToken, type DecodedToken } from '../utils/jwt.js';

// Extend FastifyRequest to include user info
declare module 'fastify' {
  interface FastifyRequest {
    user?: DecodedToken;
  }
}

/**
 * Extracts Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }
  
  return parts[1] ?? null;
}

/**
 * Authentication middleware - verifies JWT access token
 * Adds decoded user info to request.user
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);
  
  if (!token) {
    return reply.status(401).send({
      error: {
        code: 'AUTH_002',
        message: 'Missing authentication token',
        requestId: request.id,
      },
    });
  }

  const decoded = verifyAccessToken(token);
  
  if (!decoded) {
    return reply.status(401).send({
      error: {
        code: 'AUTH_002',
        message: 'Invalid or expired token',
        requestId: request.id,
      },
    });
  }

  request.user = decoded;
}


/**
 * Optional auth middleware - extracts user if token present, but doesn't require it
 * Useful for endpoints that behave differently for authenticated users
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);
  
  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      request.user = decoded;
    }
  }
}

/**
 * Registers auth middleware as a Fastify plugin
 */
export async function authPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorate('authenticate', authMiddleware);
  fastify.decorate('optionalAuth', optionalAuthMiddleware);
}

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authMiddleware;
    optionalAuth: typeof optionalAuthMiddleware;
  }
}
