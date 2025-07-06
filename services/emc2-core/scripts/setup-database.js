#!/usr/bin/env node
/**
 * Database Setup Script
 * 
 * Sets up the database schema and initial data for development
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = process.env.NODE_ENV === 'production' 
  ? '.env' 
  : '.env.development';

dotenv.config({ path: envPath });

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: 'postgres' // Connect to default database first
};

const targetDbName = process.env.DB_NAME || 'mortgage_broker_dev';

async function createDatabase() {
  const pool = new Pool(dbConfig);
  
  try {
    // Check if database exists
    const result = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDbName]
    );
    
    if (result.rows.length === 0) {
      // Create database
      console.log(`Creating database: ${targetDbName}`);
      await pool.query(`CREATE DATABASE ${targetDbName}`);
      console.log('✅ Database created successfully');
    } else {
      console.log(`✅ Database ${targetDbName} already exists`);
    }
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

async function runMigrations() {
  // Connect to the target database
  const pool = new Pool({
    ...dbConfig,
    database: targetDbName
  });
  
  try {
    // Run auth schema
    console.log('Running auth schema migration...');
    const authSchemaSql = await fs.readFile(
      path.join(__dirname, '..', 'sql', 'auth-schema.sql'),
      'utf8'
    );
    await pool.query(authSchemaSql);
    console.log('✅ Auth schema created successfully');
    
    // Check for additional migrations
    const migrationsDir = path.join(__dirname, '..', 'sql', 'migrations');
    try {
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
      
      for (const file of sqlFiles) {
        console.log(`Running migration: ${file}`);
        const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
        await pool.query(sql);
        console.log(`✅ ${file} completed`);
      }
    } catch (error) {
      // No migrations directory is okay
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    
    // Create default data
    await createDefaultData(pool);
    
  } catch (error) {
    console.error('❌ Error running migrations:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

async function createDefaultData(pool) {
  try {
    // Create default roles
    const roles = [
      { name: 'admin', description: 'Full system access' },
      { name: 'broker', description: 'Can manage scenarios and reports' },
      { name: 'viewer', description: 'Read-only access' }
    ];
    
    for (const role of roles) {
      await pool.query(
        `INSERT INTO auth.roles (name, description) 
         VALUES ($1, $2) 
         ON CONFLICT (name) DO NOTHING`,
        [role.name, role.description]
      );
    }
    console.log('✅ Default roles created');
    
    // Create default permissions
    const permissions = [
      // Scenarios
      { resource: 'scenarios', action: 'create', name: 'Create scenarios' },
      { resource: 'scenarios', action: 'read', name: 'View scenarios' },
      { resource: 'scenarios', action: 'update', name: 'Update scenarios' },
      { resource: 'scenarios', action: 'delete', name: 'Delete scenarios' },
      // Reports
      { resource: 'reports', action: 'create', name: 'Create reports' },
      { resource: 'reports', action: 'read', name: 'View reports' },
      { resource: 'reports', action: 'download', name: 'Download reports' },
      // Users
      { resource: 'users', action: 'create', name: 'Create users' },
      { resource: 'users', action: 'read', name: 'View users' },
      { resource: 'users', action: 'update', name: 'Update users' },
      { resource: 'users', action: 'delete', name: 'Delete users' }
    ];
    
    for (const perm of permissions) {
      await pool.query(
        `INSERT INTO auth.permissions (resource, action, name, description)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (resource, action) DO NOTHING`,
        [perm.resource, perm.action, perm.name]
      );
    }
    console.log('✅ Default permissions created');
    
    // Create additional tables if needed
    await createApplicationTables(pool);
    
  } catch (error) {
    console.error('❌ Error creating default data:', error.message);
    throw error;
  }
}

async function createApplicationTables(pool) {
  // Create scenarios table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create indexes
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON scenarios (user_id);
    CREATE INDEX IF NOT EXISTS idx_scenarios_created_at ON scenarios (created_at);
  `);
  
  console.log('✅ Application tables created');
}

async function main() {
  console.log('🚀 Starting database setup...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Target database: ${targetDbName}`);
  
  try {
    await createDatabase();
    await runMigrations();
    
    console.log('\n✅ Database setup completed successfully!');
    console.log('\nYou can now start the application with: npm run dev');
  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createDatabase, runMigrations };
