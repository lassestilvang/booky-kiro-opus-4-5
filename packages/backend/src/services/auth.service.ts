/**
 * Auth Service - Authentication business logic
 * Requirements: 1.1, 1.2
 */
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  createUser,
  findUserByEmail,
  emailExists,
  findUserById,
} from '../repositories/user.repository.js';
import type { RegisterUserDTO, LoginUserDTO, PublicUser, User } from '../models/user.model.js';
import { toPublicUser } from '../models/user.model.js';

export interface AuthResult {
  success: boolean;
  user?: PublicUser;
  error?: string;
  errorCode?: string;
}

export const AuthErrorCodes = {
  EMAIL_EXISTS: 'AUTH_EMAIL_EXISTS',
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
} as const;

/**
 * Registers a new user
 * Requirements: 1.1
 */
export async function registerUser(data: RegisterUserDTO): Promise<AuthResult> {
  // Check if email already exists
  const exists = await emailExists(data.email);
  if (exists) {
    return {
      success: false,
      error: 'Email already registered',
      errorCode: AuthErrorCodes.EMAIL_EXISTS,
    };
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const user = await createUser({
    email: data.email.toLowerCase(),
    passwordHash,
    name: data.name,
  });

  return {
    success: true,
    user: toPublicUser(user),
  };
}


/**
 * Authenticates a user with email and password
 * Requirements: 1.2
 */
export async function authenticateUser(data: LoginUserDTO): Promise<AuthResult> {
  // Find user by email
  const user = await findUserByEmail(data.email);
  if (!user) {
    return {
      success: false,
      error: 'Invalid email or password',
      errorCode: AuthErrorCodes.INVALID_CREDENTIALS,
    };
  }

  // Verify password
  const isValid = await verifyPassword(data.password, user.passwordHash);
  if (!isValid) {
    return {
      success: false,
      error: 'Invalid email or password',
      errorCode: AuthErrorCodes.INVALID_CREDENTIALS,
    };
  }

  return {
    success: true,
    user: toPublicUser(user),
  };
}

/**
 * Gets a user by ID (for token validation)
 */
export async function getUserById(id: string): Promise<User | null> {
  return findUserById(id);
}

/**
 * Gets a public user by ID
 */
export async function getPublicUserById(id: string): Promise<PublicUser | null> {
  const user = await findUserById(id);
  if (!user) return null;
  return toPublicUser(user);
}
