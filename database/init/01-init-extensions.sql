-- Initialize PostgreSQL Extensions
-- This runs automatically when the database container starts

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable advanced text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enable JSON validation
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Enable cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a simple version tracking table
CREATE TABLE IF NOT EXISTS schema_version (
    id SERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Record this initialization
INSERT INTO schema_version (version, description) 
VALUES ('0.0.1', 'Initial database setup with extensions');
