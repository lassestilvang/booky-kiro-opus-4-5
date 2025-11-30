/**
 * User Model - TypeScript interfaces, Zod schemas, and serialization
 * Requirements: 1.1
 */
import { z } from 'zod';

// Plan enum matching Prisma schema
export const Plan = {
  FREE: 'FREE',
  PRO: 'PRO',
} as const;

export type Plan = (typeof Plan)[keyof typeof Plan];

export const PlanSchema = z.enum(['FREE', 'PRO']);

// View mode for user preferences
export const ViewMode = {
  GRID: 'GRID',
  HEADLINES: 'HEADLINES',
  MASONRY: 'MASONRY',
  LIST: 'LIST',
} as const;

export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

export const ViewModeSchema = z.enum(['GRID', 'HEADLINES', 'MASONRY', 'LIST']);

// User preferences schema
export const UserPreferencesSchema = z.object({
  defaultView: ViewModeSchema.default('GRID'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  defaultCollectionId: z.string().uuid().optional(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// Full User schema (for internal use, includes passwordHash)
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string().min(1),
  plan: PlanSchema,
  preferences: UserPreferencesSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;


// Public User schema (excludes passwordHash for API responses)
export const PublicUserSchema = UserSchema.omit({ passwordHash: true });

export type PublicUser = z.infer<typeof PublicUserSchema>;

// Schema for user registration
export const RegisterUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255),
});

export type RegisterUserDTO = z.infer<typeof RegisterUserSchema>;

// Schema for user login
export const LoginUserSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginUserDTO = z.infer<typeof LoginUserSchema>;

// Schema for updating user
export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  preferences: UserPreferencesSchema.partial().optional(),
});

export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;

/**
 * Converts a User to PublicUser (removes sensitive data)
 */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _, ...publicUser } = user;
  return publicUser as PublicUser;
}

/**
 * Validates registration data
 */
export function validateRegisterUser(data: unknown): z.SafeParseReturnType<unknown, RegisterUserDTO> {
  return RegisterUserSchema.safeParse(data);
}

/**
 * Validates login data
 */
export function validateLoginUser(data: unknown): z.SafeParseReturnType<unknown, LoginUserDTO> {
  return LoginUserSchema.safeParse(data);
}

/**
 * Validates update user data
 */
export function validateUpdateUser(data: unknown): z.SafeParseReturnType<unknown, UpdateUserDTO> {
  return UpdateUserSchema.safeParse(data);
}
