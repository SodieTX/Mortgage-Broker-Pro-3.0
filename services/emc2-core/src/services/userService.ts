/**
 * User Service
 * 
 * Handles broker authentication and user management
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  role: 'broker' | 'admin' | 'viewer';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
  role?: 'broker' | 'admin' | 'viewer';
}

export interface LoginDTO {
  email: string;
  password: string;
}

export class UserService {
  private db: Pool;
  private saltRounds = 10;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Create a new user
   */
  async createUser(data: CreateUserDTO): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, this.saltRounds);
    
    const result = await this.db.query(
      `INSERT INTO core.users (email, password_hash, first_name, last_name, company, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, company, role, is_active, created_at, updated_at`,
      [
        data.email.toLowerCase(),
        hashedPassword,
        data.firstName,
        data.lastName,
        data.company || null,
        data.role || 'broker'
      ]
    );
    
    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT id, email, first_name, last_name, company, role, is_active, created_at, updated_at
       FROM core.users 
       WHERE email = $1 AND is_active = true`,
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Verify user credentials
   */
  async verifyCredentials(email: string, password: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT id, email, password_hash, first_name, last_name, company, role, is_active, created_at, updated_at
       FROM core.users 
       WHERE email = $1 AND is_active = true`,
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return null;
    }
    
    // Update last login
    await this.db.query(
      `UPDATE core.users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
      [user.id]
    );
    
    return this.mapRowToUser(user);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT id, email, first_name, last_name, company, role, is_active, created_at, updated_at
       FROM core.users 
       WHERE id = $1 AND is_active = true`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Helper to map database row to User type
   */
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      company: row.company,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
