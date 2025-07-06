-- Migration 001: Create Core Scenario Tables
-- Simple, clear, maintainable schema for loan scenarios

BEGIN;

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS core;

-- Scenario status enum
CREATE TYPE core.scenario_status AS ENUM (
    'draft',
    'submitted',
    'processing',
    'evaluated',
    'error',
    'archived'
);

-- Main scenarios table
CREATE TABLE core.scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic info
    external_id VARCHAR(100) UNIQUE, -- For integration with external systems
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Status tracking
    status core.scenario_status NOT NULL DEFAULT 'draft',
    
    -- Core loan data (stored as JSONB for flexibility)
    loan_data JSONB NOT NULL DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    
    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexing for common queries
    CONSTRAINT valid_loan_data CHECK (jsonb_typeof(loan_data) = 'object')
);

-- Indexes for performance
CREATE INDEX idx_scenarios_status ON core.scenarios(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_scenarios_external_id ON core.scenarios(external_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_scenarios_created_at ON core.scenarios(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_scenarios_loan_data ON core.scenarios USING gin(loan_data);

-- Scenario events table (for audit trail)
CREATE TABLE core.scenario_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID NOT NULL REFERENCES core.scenarios(id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Index for querying events by scenario
CREATE INDEX idx_scenario_events_scenario_id ON core.scenario_events(scenario_id, created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION core.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scenarios_updated_at
    BEFORE UPDATE ON core.scenarios
    FOR EACH ROW
    EXECUTE FUNCTION core.update_updated_at_column();

-- Function to log scenario events
CREATE OR REPLACE FUNCTION core.log_scenario_event(
    p_scenario_id UUID,
    p_event_type VARCHAR(50),
    p_event_data JSONB DEFAULT '{}',
    p_created_by VARCHAR(100) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO core.scenario_events (scenario_id, event_type, event_data, created_by)
    VALUES (p_scenario_id, p_event_type, p_event_data, p_created_by)
    RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Update schema version
INSERT INTO schema_version (version, description) 
VALUES ('0.1.0', 'Create core scenario tables');

COMMIT;
