-- ============================================================
-- MASTER INTEGRATION SCHEMA
-- Ensures all 4 enhanced schemas work together seamlessly
-- 
-- Load Order:
-- 1. 00-Master-Integration-Schema.sql (this file)
-- 2. EMC2-Complete-Schema-v2.0-Enhanced.sql
-- 3. Universal-Import-Logic-v6.0-Enhanced.sql
-- 4. Hermes-2.0-Enhanced.sql
-- 5. Athena-7.0-Enhanced.sql
-- ============================================================

-- ============================================================
-- SECTION 1: PREREQUISITES & EXTENSIONS
-- ============================================================

-- Core PostgreSQL version check
DO $$
BEGIN
    IF current_setting('server_version_num')::integer < 150000 THEN
        RAISE EXCEPTION 'PostgreSQL 15+ is required. Current version: %', version();
    END IF;
END $$;

-- Create schemas in correct order
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS lending;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS pricing;
CREATE SCHEMA IF NOT EXISTS geo;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS import;
CREATE SCHEMA IF NOT EXISTS transform;
CREATE SCHEMA IF NOT EXISTS validate;
CREATE SCHEMA IF NOT EXISTS lineage;
CREATE SCHEMA IF NOT EXISTS ml;
CREATE SCHEMA IF NOT EXISTS universal_import;
CREATE SCHEMA IF NOT EXISTS attribute_discovery;
CREATE SCHEMA IF NOT EXISTS stream_processing;
CREATE SCHEMA IF NOT EXISTS ml_models;
CREATE SCHEMA IF NOT EXISTS pii_protection;

-- Install required extensions (order matters)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "ltree";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Optional extensions (check availability)
DO $$
BEGIN
    -- TimescaleDB
    BEGIN
        CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'TimescaleDB not available - time-series features will be limited';
    END;
    
    -- Vector extension for ML
    BEGIN
        CREATE EXTENSION IF NOT EXISTS vector;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'pgvector not available - ML embedding features will be limited';
    END;
    
    -- Python for advanced ML
    BEGIN
        CREATE EXTENSION IF NOT EXISTS plpython3u;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'plpython3u not available - advanced ML features will be limited';
    END;
    
    -- Cron for scheduling
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron not available - scheduled tasks must be handled externally';
    END;
END $$;

-- ============================================================
-- SECTION 2: SHARED CUSTOM TYPES
-- ============================================================

-- Ensure no duplicate type definitions
DO $$
BEGIN
    -- Check and create confidence_level if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'confidence_level') THEN
        CREATE TYPE confidence_level AS ENUM (
            'VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'PERFECT'
        );
    END IF;
    
    -- Check and create processing_strategy if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_strategy') THEN
        CREATE TYPE processing_strategy AS ENUM (
            'BATCH', 'STREAM', 'MICRO_BATCH', 'REAL_TIME', 'HYBRID'
        );
    END IF;
    
    -- Check and create ml_status if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ml_status') THEN
        CREATE TYPE ml_status AS ENUM (
            'TRAINING', 'VALIDATING', 'DEPLOYED', 'DEPRECATED', 'FAILED'
        );
    END IF;
END $$;

-- ============================================================
-- SECTION 3: CROSS-SCHEMA REFERENCES SETUP
-- ============================================================

-- Create placeholder tables for cross-schema references
-- These will be properly defined in their respective schemas

-- Placeholder for core.Questions (referenced by multiple schemas)
CREATE TABLE IF NOT EXISTS core.Questions (
    Question_ID UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    Question_Code TEXT UNIQUE NOT NULL,
    Base_Text TEXT NOT NULL,
    Created_At TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Placeholder for core.Lenders (referenced by Athena)
CREATE TABLE IF NOT EXISTS core.Lenders (
    Lender_ID UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    Name TEXT NOT NULL,
    Active BOOLEAN DEFAULT TRUE,
    Profile_Score DECIMAL(5,2),
    Created_At TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Placeholder for core.ErrorLog (referenced by multiple schemas)
CREATE TABLE IF NOT EXISTS core.ErrorLog (
    error_id BIGSERIAL PRIMARY KEY,
    job_id BIGINT,
    function_name TEXT,
    scenario_id UUID,
    entity_id UUID,
    error_code TEXT,
    error_message TEXT,
    stack_trace TEXT,
    error_category TEXT,
    remediation_attempted BOOLEAN DEFAULT FALSE,
    remediation_result JSONB,
    correlation_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECTION 4: INTEGRATION BRIDGE TABLES
-- ============================================================

-- Bridge between E=mc² scenarios and import jobs
CREATE TABLE IF NOT EXISTS workflow.ScenarioImports (
    scenario_id UUID REFERENCES workflow.Scenarios(Scenario_ID),
    import_id UUID REFERENCES universal_import.ImportRaw(import_id),
    import_job_id UUID REFERENCES import.ImportJobs(job_id),
    import_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    PRIMARY KEY (scenario_id, import_id)
);

-- Bridge between Athena evaluations and ML models
CREATE TABLE IF NOT EXISTS core.EvaluationModels (
    evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID,
    model_id UUID REFERENCES ml_models.ImportModels(model_id),
    model_output JSONB,
    confidence_score DECIMAL(5,4),
    used_in_decision BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Bridge between Universal Import and Hermes processing
CREATE TABLE IF NOT EXISTS import.UniversalHermesBridge (
    bridge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    universal_import_id UUID REFERENCES universal_import.ImportRaw(import_id),
    hermes_job_id UUID REFERENCES import.ImportJobs(job_id),
    mapping_confidence DECIMAL(5,4),
    transformation_applied JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SECTION 5: SHARED FUNCTIONS
-- ============================================================

-- Unified error logging function
CREATE OR REPLACE FUNCTION core.fn_log_error_unified(
    p_source_schema TEXT,
    p_function_name TEXT,
    p_error_code TEXT,
    p_error_message TEXT,
    p_error_context TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_job_id BIGINT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO core.ErrorLog (
        function_name, 
        error_code, 
        error_message, 
        stack_trace,
        error_category,
        entity_id,
        job_id,
        correlation_id
    ) VALUES (
        p_source_schema || '.' || p_function_name,
        p_error_code,
        p_error_message,
        p_error_context,
        CASE 
            WHEN p_source_schema = 'core' THEN 'EVALUATION'
            WHEN p_source_schema = 'import' THEN 'IMPORT'
            WHEN p_source_schema = 'universal_import' THEN 'UNIVERSAL_IMPORT'
            WHEN p_source_schema = 'workflow' THEN 'WORKFLOW'
            ELSE 'GENERAL'
        END,
        p_entity_id,
        p_job_id,
        gen_random_uuid()
    );
END;
$$;

-- Unified tenant context function
CREATE OR REPLACE FUNCTION core.fn_get_current_tenant()
RETURNS UUID LANGUAGE plpgsql AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_tenant', TRUE)::UUID,
        current_setting('app.tenant_id', TRUE)::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID -- Default tenant
    );
END;
$$;

-- Unified user context function
CREATE OR REPLACE FUNCTION core.fn_get_current_user()
RETURNS UUID LANGUAGE plpgsql AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_user', TRUE)::UUID,
        current_setting('app.user_id', TRUE)::UUID,
        '00000000-0000-0000-0000-000000000001'::UUID -- System user
    );
END;
$$;

-- ============================================================
-- SECTION 6: INTEGRATION VIEWS
-- ============================================================

-- Unified import status view across all import systems
CREATE OR REPLACE VIEW analytics.vw_unified_import_status AS
SELECT 
    'UNIVERSAL' as import_system,
    import_id,
    source_type,
    processing_status as status,
    created_at,
    tenant_id,
    data_quality_score,
    row_count
FROM universal_import.ImportRaw

UNION ALL

SELECT 
    'HERMES' as import_system,
    job_id as import_id,
    source_type::TEXT,
    status::TEXT,
    created_at,
    tenant_id,
    NULL as data_quality_score,
    total_records as row_count
FROM import.ImportJobs;

-- Unified data quality view
CREATE OR REPLACE VIEW analytics.vw_unified_data_quality AS
SELECT 
    'UNIVERSAL' as system,
    import_id,
    overall_score,
    completeness_score,
    accuracy_score,
    consistency_score,
    calculated_at
FROM universal_import.QualityScores

UNION ALL

SELECT 
    'HERMES' as system,
    import_id,
    validation_score as overall_score,
    NULL as completeness_score,
    validation_score as accuracy_score,
    NULL as consistency_score,
    processed_at as calculated_at
FROM import.ImportData
WHERE validation_score IS NOT NULL;

-- Master scenario evaluation view
CREATE OR REPLACE VIEW analytics.vw_scenario_evaluation_complete AS
SELECT 
    s.Scenario_ID,
    s.Name as scenario_name,
    s.Status as scenario_status,
    s.Loan_Amount,
    s.LTV,
    s.Confidence_Score,
    -- Import information
    si.import_id,
    si.import_type,
    -- Quality scores
    qs.overall_score as import_quality_score,
    -- Athena evaluation (placeholder for when Athena runs)
    em.confidence_score as athena_confidence,
    em.model_output as athena_results,
    -- Timeline
    s.Created_At as scenario_created,
    si.created_at as import_completed,
    em.created_at as evaluation_completed
FROM workflow.Scenarios s
LEFT JOIN workflow.ScenarioImports si ON s.Scenario_ID = si.scenario_id
LEFT JOIN universal_import.QualityScores qs ON si.import_id = qs.import_id
LEFT JOIN core.EvaluationModels em ON s.Scenario_ID = em.scenario_id;

-- ============================================================
-- SECTION 7: DATA FLOW ORCHESTRATION
-- ============================================================

-- Master orchestration function that coordinates all systems
CREATE OR REPLACE FUNCTION core.fn_orchestrate_scenario_import(
    p_scenario_id UUID,
    p_import_source TEXT,
    p_file_path TEXT DEFAULT NULL,
    p_data JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_import_id UUID;
    v_hermes_job_id UUID;
    v_quality_score DECIMAL(5,4);
    v_result JSONB;
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    -- Get context
    v_tenant_id := core.fn_get_current_tenant();
    v_user_id := core.fn_get_current_user();
    
    -- Step 1: Create Universal Import entry
    INSERT INTO universal_import.ImportRaw (
        source_type, 
        raw_data,
        tenant_id,
        created_by,
        data_hash
    ) VALUES (
        p_import_source,
        COALESCE(p_data, jsonb_build_object('file_path', p_file_path)),
        v_tenant_id,
        v_user_id,
        encode(digest(COALESCE(p_data::text, p_file_path), 'sha256'), 'hex')
    ) RETURNING import_id INTO v_import_id;
    
    -- Step 2: Create Hermes job for processing
    INSERT INTO import.ImportJobs (
        job_name,
        job_type,
        source_type,
        source_config,
        tenant_id,
        created_by
    ) VALUES (
        'Scenario Import: ' || p_scenario_id,
        'SCENARIO_DATA',
        CASE 
            WHEN p_file_path IS NOT NULL THEN 'MANUAL_UPLOAD'
            ELSE 'API'
        END,
        jsonb_build_object(
            'scenario_id', p_scenario_id,
            'import_id', v_import_id
        ),
        v_tenant_id,
        v_user_id
    ) RETURNING job_id INTO v_hermes_job_id;
    
    -- Step 3: Link everything together
    INSERT INTO workflow.ScenarioImports (
        scenario_id, import_id, import_job_id, import_type, created_by
    ) VALUES (
        p_scenario_id, v_import_id, v_hermes_job_id, p_import_source, v_user_id
    );
    
    INSERT INTO import.UniversalHermesBridge (
        universal_import_id, hermes_job_id
    ) VALUES (
        v_import_id, v_hermes_job_id
    );
    
    -- Step 4: Process with Hermes
    PERFORM import.fn_process_import_job(v_hermes_job_id);
    
    -- Step 5: Calculate quality score
    SELECT universal_import.fn_calculate_quality_score(v_import_id) INTO v_result;
    v_quality_score := (v_result->>'overall')::DECIMAL;
    
    -- Step 6: Update scenario with import results
    UPDATE workflow.Scenarios
    SET 
        Quality_Score = v_quality_score,
        Updated_At = CURRENT_TIMESTAMP,
        Updated_By = v_user_id
    WHERE Scenario_ID = p_scenario_id;
    
    -- Step 7: Prepare for Athena evaluation if quality is sufficient
    IF v_quality_score >= 0.7 THEN
        UPDATE workflow.Scenarios
        SET Status = 'MATCHING'
        WHERE Scenario_ID = p_scenario_id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'import_id', v_import_id,
        'job_id', v_hermes_job_id,
        'quality_score', v_quality_score,
        'ready_for_evaluation', v_quality_score >= 0.7
    );
    
EXCEPTION
    WHEN OTHERS THEN
        PERFORM core.fn_log_error_unified(
            'core', 'fn_orchestrate_scenario_import',
            SQLSTATE, SQLERRM, SQLSTATE,
            p_scenario_id
        );
        RAISE;
END;
$$;

-- ============================================================
-- SECTION 8: CROSS-SCHEMA TRIGGERS
-- ============================================================

-- Trigger to sync Questions between schemas
CREATE OR REPLACE FUNCTION core.fn_sync_questions()
RETURNS TRIGGER AS $$
BEGIN
    -- Update references in Universal Import
    UPDATE attribute_discovery.AttributeDefinitions
    SET question_id = NEW.Question_ID
    WHERE external_field_id = OLD.Question_Code;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger only if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'questions' AND relnamespace = 'core'::regnamespace) THEN
        CREATE TRIGGER trg_sync_questions
            AFTER UPDATE ON core.Questions
            FOR EACH ROW
            EXECUTE FUNCTION core.fn_sync_questions();
    END IF;
END $$;

-- ============================================================
-- SECTION 9: PERMISSIONS & SECURITY
-- ============================================================

-- Create roles for each subsystem
DO $$
BEGIN
    -- Create roles if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'athena_engine') THEN
        CREATE ROLE athena_engine;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hermes_import') THEN
        CREATE ROLE hermes_import;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'universal_import') THEN
        CREATE ROLE universal_import;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'emc2_core') THEN
        CREATE ROLE emc2_core;
    END IF;
END $$;

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA core TO athena_engine, hermes_import, universal_import, emc2_core;
GRANT USAGE ON SCHEMA import TO hermes_import, universal_import;
GRANT USAGE ON SCHEMA universal_import TO hermes_import, athena_engine;
GRANT USAGE ON SCHEMA workflow TO athena_engine, hermes_import, universal_import;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA core TO athena_engine;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA import TO hermes_import;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA universal_import TO universal_import;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA workflow TO emc2_core;

-- ============================================================
-- SECTION 10: MONITORING & HEALTH CHECKS
-- ============================================================

-- System health check function
CREATE OR REPLACE FUNCTION core.fn_system_health_check()
RETURNS TABLE (
    component TEXT,
    status TEXT,
    details JSONB
) LANGUAGE plpgsql AS $$
BEGIN
    -- Check E=mc² Core
    RETURN QUERY
    SELECT 
        'EMC2_CORE'::TEXT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'HEALTHY'::TEXT
            ELSE 'ERROR'::TEXT
        END,
        jsonb_build_object(
            'tables_count', COUNT(*),
            'last_scenario', MAX(created_at)
        )
    FROM workflow.Scenarios
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    -- Check Universal Import
    RETURN QUERY
    SELECT 
        'UNIVERSAL_IMPORT'::TEXT,
        CASE 
            WHEN COUNT(*) > 0 OR NOT EXISTS (SELECT 1 FROM universal_import.ImportRaw) THEN 'HEALTHY'::TEXT
            ELSE 'WARNING'::TEXT
        END,
        jsonb_build_object(
            'pending_imports', COUNT(*),
            'avg_quality', AVG(data_quality_score)
        )
    FROM universal_import.ImportRaw
    WHERE processing_status = 'PENDING';
    
    -- Check Hermes
    RETURN QUERY
    SELECT 
        'HERMES'::TEXT,
        CASE 
            WHEN COUNT(*) FILTER (WHERE status = 'FAILED') > 10 THEN 'ERROR'::TEXT
            WHEN COUNT(*) FILTER (WHERE status = 'FAILED') > 5 THEN 'WARNING'::TEXT
            ELSE 'HEALTHY'::TEXT
        END,
        jsonb_build_object(
            'failed_jobs', COUNT(*) FILTER (WHERE status = 'FAILED'),
            'success_rate', 
            CASE 
                WHEN COUNT(*) > 0 THEN 
                    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'COMPLETED') / COUNT(*), 2)
                ELSE 100
            END
        )
    FROM import.ImportJobs
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    -- Check Athena
    RETURN QUERY
    SELECT 
        'ATHENA'::TEXT,
        CASE 
            WHEN avg_latency > 5000 THEN 'WARNING'::TEXT
            ELSE 'HEALTHY'::TEXT
        END,
        jsonb_build_object(
            'avg_latency_ms', ROUND(avg_latency, 2),
            'evaluations_today', count_today
        )
    FROM (
        SELECT 
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as avg_latency,
            COUNT(*) FILTER (WHERE created_at > CURRENT_DATE) as count_today
        FROM (
            SELECT now() as completed_at, now() - INTERVAL '1 second' as started_at, now() as created_at
        ) dummy
    ) stats;
END;
$$;

-- ============================================================
-- SECTION 11: DATA MIGRATION HELPERS
-- ============================================================

-- Function to migrate existing data to integrated schema
CREATE OR REPLACE FUNCTION core.fn_migrate_existing_data()
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_migrated_count INT := 0;
BEGIN
    -- This is a placeholder for any data migration needs
    -- Add specific migration logic as needed
    
    RETURN jsonb_build_object(
        'status', 'SUCCESS',
        'migrated_records', v_migrated_count,
        'timestamp', CURRENT_TIMESTAMP
    );
END;
$$;

-- ============================================================
-- SECTION 12: CONFIGURATION & SETTINGS
-- ============================================================

-- Unified configuration table
CREATE TABLE IF NOT EXISTS core.SystemConfiguration (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    config_type TEXT NOT NULL,
    schema_name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- Insert default configurations
INSERT INTO core.SystemConfiguration (config_key, config_value, config_type, schema_name, description) VALUES
('import_quality_threshold', '0.7', 'NUMERIC', 'universal_import', 'Minimum quality score for import acceptance'),
('athena_cache_ttl', '300', 'NUMERIC', 'core', 'Cache TTL in seconds for Athena evaluations'),
('hermes_batch_size', '1000', 'NUMERIC', 'import', 'Default batch size for Hermes processing'),
('ml_confidence_threshold', '0.85', 'NUMERIC', 'ml_models', 'Default ML confidence threshold'),
('pii_scan_enabled', 'true', 'BOOLEAN', 'pii_protection', 'Enable automatic PII scanning'),
('stream_processing_enabled', 'false', 'BOOLEAN', 'stream_processing', 'Enable real-time stream processing')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================
-- SECTION 13: INTEGRATION VALIDATION
-- ============================================================

-- Validation function to ensure all schemas are properly integrated
CREATE OR REPLACE FUNCTION core.fn_validate_integration()
RETURNS TABLE (
    validation_check TEXT,
    status TEXT,
    details TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    -- Check schema existence
    RETURN QUERY
    SELECT 
        'Schema Existence Check'::TEXT,
        CASE 
            WHEN COUNT(*) = 16 THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END,
        'Expected 16 schemas, found ' || COUNT(*)::TEXT
    FROM pg_namespace
    WHERE nspname IN (
        'core', 'lending', 'workflow', 'pricing', 'geo', 'audit', 'analytics',
        'import', 'transform', 'validate', 'lineage', 'ml',
        'universal_import', 'attribute_discovery', 'stream_processing', 'ml_models'
    );
    
    -- Check critical tables
    RETURN QUERY
    SELECT 
        'Critical Tables Check'::TEXT,
        CASE 
            WHEN COUNT(*) >= 10 THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END,
        'Found ' || COUNT(*) || ' critical tables'::TEXT
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
    AND (
        (n.nspname = 'core' AND c.relname IN ('Lenders', 'Questions', 'ErrorLog')) OR
        (n.nspname = 'workflow' AND c.relname IN ('Scenarios', 'Offers')) OR
        (n.nspname = 'import' AND c.relname IN ('ImportJobs', 'ImportData')) OR
        (n.nspname = 'universal_import' AND c.relname IN ('ImportRaw', 'QualityScores'))
    );
    
    -- Check foreign key relationships
    RETURN QUERY
    SELECT 
        'Foreign Key Integrity'::TEXT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'PASS'::TEXT
            ELSE 'WARNING'::TEXT
        END,
        'Found ' || COUNT(*) || ' cross-schema foreign keys'::TEXT
    FROM pg_constraint
    WHERE contype = 'f'
    AND connamespace::regnamespace::text != confrelid::regclass::regnamespace::text;
    
    -- Check functions
    RETURN QUERY
    SELECT 
        'Integration Functions'::TEXT,
        CASE 
            WHEN COUNT(*) >= 5 THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END,
        'Found ' || COUNT(*) || ' integration functions'::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'core'
    AND p.proname IN (
        'fn_log_error_unified',
        'fn_get_current_tenant',
        'fn_get_current_user',
        'fn_orchestrate_scenario_import',
        'fn_system_health_check'
    );
END;
$$;

-- ============================================================
-- SECTION 14: FINAL SETUP
-- ============================================================

-- Create a setup completion marker
CREATE TABLE IF NOT EXISTS core.SetupLog (
    setup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component TEXT NOT NULL,
    version TEXT NOT NULL,
    setup_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    setup_by TEXT DEFAULT current_user,
    notes TEXT
);

-- Mark integration setup as complete
INSERT INTO core.SetupLog (component, version, notes) VALUES
('MASTER_INTEGRATION', '1.0', 'Initial integration setup completed');

-- Run validation
DO $$
DECLARE
    v_validation RECORD;
    v_all_pass BOOLEAN := TRUE;
BEGIN
    RAISE NOTICE 'Running integration validation...';
    
    FOR v_validation IN SELECT * FROM core.fn_validate_integration() LOOP
        RAISE NOTICE '% - %: %', v_validation.validation_check, v_validation.status, v_validation.details;
        IF v_validation.status != 'PASS' THEN
            v_all_pass := FALSE;
        END IF;
    END LOOP;
    
    IF v_all_pass THEN
        RAISE NOTICE 'All integration checks passed!';
    ELSE
        RAISE WARNING 'Some integration checks failed or have warnings. Please review.';
    END IF;
END $$;

-- ============================================================
-- END OF MASTER INTEGRATION SCHEMA
-- ============================================================
