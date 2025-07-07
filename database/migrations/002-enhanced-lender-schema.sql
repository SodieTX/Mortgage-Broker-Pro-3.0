-- Enhanced Lender Schema Migration
-- This sets up the core.Lenders table with enhanced constraints from EMC2-v2.0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schemas if they don't exist
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS lending;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS pricing;
CREATE SCHEMA IF NOT EXISTS geo;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Custom domains for validation
CREATE DOMAIN IF NOT EXISTS email AS TEXT
CHECK (VALUE ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

CREATE DOMAIN IF NOT EXISTS phone AS TEXT
CHECK (VALUE ~ '^\+?[1-9]\d{1,14}$');

CREATE DOMAIN IF NOT EXISTS percentage AS NUMERIC(5,2)
CHECK (VALUE >= 0 AND VALUE <= 100);

-- Status enums
DO $$ BEGIN
    CREATE TYPE entity_status AS ENUM (
        'ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enhanced Lenders table with full constraints
CREATE TABLE IF NOT EXISTS core.Lenders (
    Lender_ID       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    Name            TEXT NOT NULL UNIQUE,
    Legal_Name      TEXT NOT NULL,
    Tax_ID          TEXT UNIQUE,
    Website_URL     TEXT CHECK (Website_URL ~ '^https?://'),
    Logo_URL        TEXT CHECK (Logo_URL ~ '^https?://'),
    Contact_Name    TEXT NOT NULL,
    Contact_Email   email NOT NULL,
    Contact_Phone   phone,
    Status          entity_status DEFAULT 'ACTIVE',
    Profile_Score   percentage,
    Tier            TEXT CHECK (Tier IN ('PLATINUM', 'GOLD', 'SILVER', 'BRONZE')),
    API_Enabled     BOOLEAN DEFAULT FALSE,
    API_Endpoint    TEXT CHECK (API_Endpoint ~ '^https?://'),
    Created_At      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    Updated_At      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    Created_By      UUID NOT NULL,
    Updated_By      UUID,
    Metadata        JSONB DEFAULT '{}',
    CONSTRAINT valid_dates CHECK (Created_At <= Updated_At)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lenders_active ON core.Lenders(Lender_ID) 
WHERE Status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_lenders_name ON core.Lenders(Name);
CREATE INDEX IF NOT EXISTS idx_lenders_tier ON core.Lenders(Tier) WHERE Tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lenders_created ON core.Lenders(Created_At DESC);

-- Trigger to automatically update the Updated_At timestamp
CREATE OR REPLACE FUNCTION core.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.Updated_At = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_lenders_updated_at 
    BEFORE UPDATE ON core.Lenders 
    FOR EACH ROW 
    EXECUTE FUNCTION core.update_updated_at_column();

-- Insert a sample lender for testing
INSERT INTO core.Lenders (
    Name, Legal_Name, Contact_Name, Contact_Email, 
    Profile_Score, Tier, Created_By
) VALUES (
    'Sample Lender', 
    'Sample Lender Corporation', 
    'Jane Smith', 
    'jane@samplelender.com',
    90.0,
    'GOLD',
    '00000000-0000-0000-0000-000000000000'
) ON CONFLICT (Name) DO NOTHING;

-- Verify the table was created
SELECT 'Enhanced Lenders table created successfully' AS status;