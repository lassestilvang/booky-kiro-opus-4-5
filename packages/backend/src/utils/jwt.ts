/**
 * JWT Utility - Token generation and validation
 * Requirements: 1.2, 1.4
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

/**
 * Parses duration string (e.g., '15m', '7d') to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}


/**
 * Generates an access token
 * Requirements: 1.2
 */
export function generateAccessToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    type: 'access',
  };

  const expiresInSeconds = parseDuration(env.JWT_EXPIRES_IN);
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Generates a refresh token
 * Requirements: 1.4
 */
export function generateRefreshToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    type: 'refresh',
  };

  const expiresInSeconds = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Generates both access and refresh tokens
 * Requirements: 1.2, 1.4
 */
export function generateTokenPair(userId: string, email: string): TokenPair {
  const accessToken = generateAccessToken(userId, email);
  const refreshToken = generateRefreshToken(userId, email);
  const expiresIn = parseDuration(env.JWT_EXPIRES_IN);

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * Verifies and decodes a token
 * Returns null if token is invalid or expired
 */
export function verifyToken(token: string): DecodedToken | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as DecodedToken;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verifies an access token specifically
 * Returns null if token is invalid, expired, or not an access token
 */
export function verifyAccessToken(token: string): DecodedToken | null {
  const decoded = verifyToken(token);
  if (!decoded || decoded.type !== 'access') {
    return null;
  }
  return decoded;
}

/**
 * Verifies a refresh token specifically
 * Returns null if token is invalid, expired, or not a refresh token
 */
export function verifyRefreshToken(token: string): DecodedToken | null {
  const decoded = verifyToken(token);
  if (!decoded || decoded.type !== 'refresh') {
    return null;
  }
  return decoded;
}

/**
 * Refreshes tokens using a valid refresh token
 * Implements token rotation - returns new access and refresh tokens
 * Requirements: 1.4
 */
export function refreshTokens(refreshToken: string): TokenPair | null {
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return null;
  }

  // Generate new token pair (rotation)
  return generateTokenPair(decoded.userId, decoded.email);
}
