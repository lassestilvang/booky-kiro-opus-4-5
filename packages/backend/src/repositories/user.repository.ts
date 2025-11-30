/**
 * User Repository - Database operations for users
 * Requirements: 1.1
 */
import { prisma } from '../db/client.js';
import type { User, PublicUser, UserPreferences } from '../models/user.model.js';
import { toPublicUser } from '../models/user.model.js';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}

export interface UpdateUserData {
  name?: string;
  preferences?: Partial<UserPreferences>;
}

/**
 * Creates a new user in the database
 */
export async function createUser(data: CreateUserData): Promise<User> {
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      preferences: {},
    },
  });

  return {
    ...user,
    preferences: user.preferences as UserPreferences,
  } as User;
}

/**
 * Finds a user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) return null;

  return {
    ...user,
    preferences: user.preferences as UserPreferences,
  } as User;
}


/**
 * Finds a user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) return null;

  return {
    ...user,
    preferences: user.preferences as UserPreferences,
  } as User;
}

/**
 * Updates a user
 */
export async function updateUser(id: string, data: UpdateUserData): Promise<User> {
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.preferences !== undefined) {
    // Merge with existing preferences
    const existingUser = await prisma.user.findUnique({ where: { id } });
    const existingPrefs = (existingUser?.preferences as UserPreferences) || {};
    updateData.preferences = { ...existingPrefs, ...data.preferences };
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  return {
    ...user,
    preferences: user.preferences as UserPreferences,
  } as User;
}

/**
 * Deletes a user and all associated data (cascade handled by Prisma)
 */
export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({
    where: { id },
  });
}

/**
 * Checks if an email is already registered
 */
export async function emailExists(email: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { email: email.toLowerCase() },
  });
  return count > 0;
}

/**
 * Gets a public user (without sensitive data)
 */
export async function getPublicUser(id: string): Promise<PublicUser | null> {
  const user = await findUserById(id);
  if (!user) return null;
  return toPublicUser(user);
}
