/**
 * Password utility for secure hashing and verification
 * Requirements: 1.1, 18.5
 */
import bcrypt from 'bcrypt';

// Cost factor for bcrypt (10-12 is recommended for production)
const SALT_ROUNDS = 12;

/**
 * Hashes a plain text password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a plain text password against a hash
 * @param password - Plain text password to verify
 * @param hash - Stored password hash
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
