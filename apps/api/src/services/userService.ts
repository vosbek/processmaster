import { db } from '../../../packages/database/src/connection';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  provider: string;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  provider?: string;
  providerId?: string;
  role?: string;
}

export const userService = {
  async getUserById(id: string): Promise<User | null> {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [id]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      throw new Error('Failed to get user by ID');
    }
  },

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email.toLowerCase()]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      throw new Error('Failed to get user by email');
    }
  },

  async createUser(userData: CreateUserData): Promise<User> {
    try {
      let passwordHash = null;
      
      if (userData.password) {
        passwordHash = await bcrypt.hash(userData.password, 12);
      }

      const result = await db.query(
        `INSERT INTO users (email, first_name, last_name, password_hash, provider, provider_id, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          userData.email.toLowerCase(),
          userData.firstName,
          userData.lastName,
          passwordHash,
          userData.provider || 'local',
          userData.providerId,
          userData.role || 'user'
        ]
      );

      return result.rows[0];
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new Error('User with this email already exists');
      }
      throw new Error('Failed to create user');
    }
  },

  async authenticateLocal(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.getUserByEmail(email);
      
      if (!user || !user.password_hash) {
        return null;
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return null;
      }

      // Update last login
      await this.updateLastLogin(user.id);

      return user;
    } catch (error) {
      throw new Error('Authentication failed');
    }
  },

  async updateLastLogin(userId: string): Promise<void> {
    try {
      await db.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
    } catch (error) {
      // Don't throw error for login update failure
      console.error('Failed to update last login:', error);
    }
  },

  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    try {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      // Clean up old tokens for this user
      await db.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < CURRENT_TIMESTAMP',
        [userId]
      );

      // Save new token
      await db.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [userId, tokenHash, expiresAt]
      );
    } catch (error) {
      throw new Error('Failed to save refresh token');
    }
  },

  async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    try {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      
      const result = await db.query(
        `SELECT id FROM refresh_tokens 
         WHERE user_id = $1 AND token_hash = $2 AND expires_at > CURRENT_TIMESTAMP`,
        [userId, tokenHash]
      );

      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  },

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      
      await db.query(
        'DELETE FROM refresh_tokens WHERE token_hash = $1',
        [tokenHash]
      );
    } catch (error) {
      // Don't throw error for token revocation failure
      console.error('Failed to revoke refresh token:', error);
    }
  },

  async updateUser(userId: string, updates: Partial<CreateUserData>): Promise<User> {
    try {
      const setClauses = [];
      const values = [];
      let valueIndex = 1;

      if (updates.firstName) {
        setClauses.push(`first_name = $${valueIndex++}`);
        values.push(updates.firstName);
      }

      if (updates.lastName) {
        setClauses.push(`last_name = $${valueIndex++}`);
        values.push(updates.lastName);
      }

      if (updates.email) {
        setClauses.push(`email = $${valueIndex++}`);
        values.push(updates.email.toLowerCase());
      }

      if (updates.password) {
        const passwordHash = await bcrypt.hash(updates.password, 12);
        setClauses.push(`password_hash = $${valueIndex++}`);
        values.push(passwordHash);
      }

      if (setClauses.length === 0) {
        throw new Error('No valid updates provided');
      }

      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const result = await db.query(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${valueIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error) {
      throw new Error('Failed to update user');
    }
  },

  async deactivateUser(userId: string): Promise<void> {
    try {
      await db.query(
        'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );

      // Also revoke all refresh tokens
      await db.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1',
        [userId]
      );
    } catch (error) {
      throw new Error('Failed to deactivate user');
    }
  },

  async searchUsers(query: string, limit: number = 50): Promise<User[]> {
    try {
      const result = await db.query(
        `SELECT * FROM users 
         WHERE is_active = true 
         AND (email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)
         ORDER BY first_name, last_name
         LIMIT $2`,
        [`%${query}%`, limit]
      );

      return result.rows;
    } catch (error) {
      throw new Error('Failed to search users');
    }
  }
};