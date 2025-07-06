/**
 * Role-Based Access Control Service
 * 
 * Manages roles, permissions, and access control
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { Role, Permission } from '../types/auth';
import { logger } from '../utils/logger';

export class RBACService {
  private db: Pool;
  private permissionCache: Map<string, Permission[]> = new Map();
  private roleCacheTimeout = 300000; // 5 minutes
  
  constructor(db: Pool) {
    this.db = db;
    this.initializeDefaultRolesAndPermissions();
  }

  /**
   * Initialize default roles and permissions
   */
  private async initializeDefaultRolesAndPermissions(): Promise<void> {
    try {
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');
        
        // Default permissions
        const defaultPermissions = [
          // User management
          { resource: 'users', action: 'create', name: 'Create Users' },
          { resource: 'users', action: 'read', name: 'View Users' },
          { resource: 'users', action: 'update', name: 'Update Users' },
          { resource: 'users', action: 'delete', name: 'Delete Users' },
          
          // Scenario management
          { resource: 'scenarios', action: 'create', name: 'Create Scenarios' },
          { resource: 'scenarios', action: 'read', name: 'View Scenarios' },
          { resource: 'scenarios', action: 'update', name: 'Update Scenarios' },
          { resource: 'scenarios', action: 'delete', name: 'Delete Scenarios' },
          
          // Report management
          { resource: 'reports', action: 'create', name: 'Generate Reports' },
          { resource: 'reports', action: 'read', name: 'View Reports' },
          { resource: 'reports', action: 'delete', name: 'Delete Reports' },
          
          // Admin functions
          { resource: 'system', action: 'manage', name: 'System Administration' },
          { resource: 'audit', action: 'read', name: 'View Audit Logs' },
          { resource: 'roles', action: 'manage', name: 'Manage Roles' },
        ];
        
        // Insert permissions
        for (const perm of defaultPermissions) {
          await client.query(`
            INSERT INTO auth.permissions (id, name, resource, action, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (resource, action) DO NOTHING
          `, [
            uuidv4(),
            perm.name,
            perm.resource,
            perm.action,
            `Permission to ${perm.action} ${perm.resource}`
          ]);
        }
        
        // Default roles
        const roles = [
          {
            name: 'admin',
            description: 'System Administrator',
            permissions: defaultPermissions // Admins get all permissions
          },
          {
            name: 'broker',
            description: 'Mortgage Broker',
            permissions: defaultPermissions.filter(p => 
              !['system', 'audit', 'roles', 'users'].includes(p.resource) ||
              (p.resource === 'users' && p.action === 'read')
            )
          },
          {
            name: 'viewer',
            description: 'Read-only Access',
            permissions: defaultPermissions.filter(p => p.action === 'read')
          }
        ];
        
        // Insert roles and map permissions
        for (const role of roles) {
          // Insert role
          const roleResult = await client.query(`
            INSERT INTO auth.roles (id, name, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (name) DO UPDATE 
            SET description = $3
            RETURNING id
          `, [uuidv4(), role.name, role.description]);
          
          const roleId = roleResult.rows[0].id;
          
          // Get permission IDs
          const permissionIds = await client.query(`
            SELECT id FROM auth.permissions 
            WHERE (resource, action) IN (${
              role.permissions.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(', ')
            })
          `, role.permissions.flatMap(p => [p.resource, p.action]));
          
          // Map role to permissions
          for (const permRow of permissionIds.rows) {
            await client.query(`
              INSERT INTO auth.role_permissions (role_id, permission_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [roleId, permRow.id]);
          }
        }
        
        await client.query('COMMIT');
        logger.info('Default roles and permissions initialized');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to initialize default roles and permissions', { error });
    }
  }

  /**
   * Get user's permissions
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    // Check cache first
    const cacheKey = `user_perms_${userId}`;
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }
    
    const result = await this.db.query(`
      SELECT DISTINCT p.* 
      FROM auth.permissions p
      JOIN auth.role_permissions rp ON p.id = rp.permission_id
      JOIN auth.roles r ON rp.role_id = r.id
      JOIN auth.users u ON u.role = r.name
      WHERE u.id = $1
    `, [userId]);
    
    const permissions = result.rows;
    
    // Cache for 5 minutes
    this.permissionCache.set(cacheKey, permissions);
    setTimeout(() => this.permissionCache.delete(cacheKey), this.roleCacheTimeout);
    
    return permissions;
  }

  /**
   * Check if user has permission
   */
  async hasPermission(
    userId: string, 
    resource: string, 
    action: string
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.some(p => p.resource === resource && p.action === action);
  }

  /**
   * Get all roles
   */
  async getRoles(): Promise<Role[]> {
    const result = await this.db.query(`
      SELECT r.*, 
        json_agg(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'resource', p.resource,
            'action', p.action,
            'description', p.description
          )
        ) as permissions
      FROM auth.roles r
      LEFT JOIN auth.role_permissions rp ON r.id = rp.role_id
      LEFT JOIN auth.permissions p ON rp.permission_id = p.id
      GROUP BY r.id
    `);
    
    return result.rows.map(row => ({
      ...row,
      permissions: row.permissions.filter((p: any) => p.id !== null)
    }));
  }

  /**
   * Create a new role
   */
  async createRole(
    name: string, 
    description: string, 
    permissionIds: string[]
  ): Promise<Role> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      // Create role
      const roleResult = await client.query(`
        INSERT INTO auth.roles (id, name, description)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [uuidv4(), name, description]);
      
      const role = roleResult.rows[0];
      
      // Assign permissions
      for (const permId of permissionIds) {
        await client.query(`
          INSERT INTO auth.role_permissions (role_id, permission_id)
          VALUES ($1, $2)
        `, [role.id, permId]);
      }
      
      await client.query('COMMIT');
      
      // Fetch complete role with permissions
      const completeRole = await this.getRole(role.id);
      return completeRole!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a specific role
   */
  async getRole(roleId: string): Promise<Role | null> {
    const result = await this.db.query(`
      SELECT r.*, 
        json_agg(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'resource', p.resource,
            'action', p.action,
            'description', p.description
          )
        ) as permissions
      FROM auth.roles r
      LEFT JOIN auth.role_permissions rp ON r.id = rp.role_id
      LEFT JOIN auth.permissions p ON rp.permission_id = p.id
      WHERE r.id = $1
      GROUP BY r.id
    `, [roleId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      ...row,
      permissions: row.permissions.filter((p: any) => p.id !== null)
    };
  }

  /**
   * Update role permissions
   */
  async updateRolePermissions(
    roleId: string, 
    permissionIds: string[]
  ): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      // Remove existing permissions
      await client.query(
        'DELETE FROM auth.role_permissions WHERE role_id = $1',
        [roleId]
      );
      
      // Add new permissions
      for (const permId of permissionIds) {
        await client.query(`
          INSERT INTO auth.role_permissions (role_id, permission_id)
          VALUES ($1, $2)
        `, [roleId, permId]);
      }
      
      await client.query('COMMIT');
      
      // Clear permission cache for all users with this role
      this.permissionCache.clear();
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all permissions
   */
  async getPermissions(): Promise<Permission[]> {
    const result = await this.db.query('SELECT * FROM auth.permissions ORDER BY resource, action');
    return result.rows;
  }

  /**
   * Create custom permission
   */
  async createPermission(
    name: string,
    resource: string,
    action: string,
    description?: string
  ): Promise<Permission> {
    const result = await this.db.query(`
      INSERT INTO auth.permissions (id, name, resource, action, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [uuidv4(), name, resource, action, description]);
    
    return result.rows[0];
  }
}
