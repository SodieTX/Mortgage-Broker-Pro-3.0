-- Users table for broker authentication
CREATE TABLE IF NOT EXISTS core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'broker' CHECK (role IN ('broker', 'admin', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookups
CREATE INDEX idx_users_email ON core.users(email);

-- Index for active users
CREATE INDEX idx_users_active ON core.users(is_active) WHERE is_active = true;

-- Update trigger for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON core.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add user_id to scenarios for ownership
ALTER TABLE core.scenarios 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES core.users(id);

-- Index for user scenarios
CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON core.scenarios(user_id);

-- Grant permissions
GRANT ALL ON core.users TO emc2_user;
