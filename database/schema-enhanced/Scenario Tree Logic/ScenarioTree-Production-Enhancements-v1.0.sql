-- ============================================================
-- SCENARIO TREE PRODUCTION ENHANCEMENTS v1.0
-- Broker-tested tools for real-world mortgage operations
-- ============================================================

BEGIN;

-- ============================================================
-- PRIORITY AND URGENCY MANAGEMENT
-- ============================================================

-- Add priority support to questions
ALTER TABLE tree_core.questions 
ADD COLUMN priority TEXT DEFAULT 'NORMAL' 
    CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'BLOCKING')),
ADD COLUMN priority_reason TEXT,
ADD COLUMN priority_expires_at TIMESTAMPTZ,
ADD COLUMN last_priority_change TIMESTAMPTZ,
ADD COLUMN priority_changed_by UUID;

-- Priority change tracking
CREATE TABLE tree_core.priority_history (
    history_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id        UUID REFERENCES tree_core.questions(question_id),
    old_priority       TEXT,
    new_priority       TEXT,
    reason             TEXT,
    changed_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    changed_by         UUID NOT NULL,
    expires_at         TIMESTAMPTZ
);

-- Trigger to track priority changes
CREATE OR REPLACE FUNCTION tree_core.track_priority_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO tree_core.priority_history (
            question_id, old_priority, new_priority, 
            reason, changed_by, expires_at
        ) VALUES (
            NEW.question_id, OLD.priority, NEW.priority,
            NEW.priority_reason, NEW.priority_changed_by, NEW.priority_expires_at
        );
        
        NEW.last_priority_change := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_track_priority
BEFORE UPDATE ON tree_core.questions
FOR EACH ROW EXECUTE FUNCTION tree_core.track_priority_changes();

-- ============================================================
-- BULK OPERATIONS TOOLKIT
-- ============================================================

-- Bulk question management
CREATE OR REPLACE FUNCTION tree_core.bulk_update_questions(
    p_updates JSONB -- Array of {question_id, field, value}
) RETURNS TABLE (
    question_id UUID,
    status TEXT,
    error TEXT
) LANGUAGE plpgsql AS $$
DECLARE
    v_update JSONB;
BEGIN
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates) LOOP
        BEGIN
            EXECUTE format('UPDATE tree_core.questions SET %I = %L WHERE question_id = %L',
                v_update->>'field',
                v_update->>'value',
                (v_update->>'question_id')::uuid
            );
            
            RETURN QUERY SELECT 
                (v_update->>'question_id')::uuid,
                'SUCCESS'::text,
                NULL::text;
                
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 
                (v_update->>'question_id')::uuid,
                'ERROR'::text,
                SQLERRM::text;
        END;
    END LOOP;
END;
$$;

-- Immediate cleanup for brokers
CREATE OR REPLACE FUNCTION tree_core.broker_cleanup_lender_questions(
    p_lender_id UUID,
    p_force BOOLEAN DEFAULT FALSE,
    p_inactive_days INT DEFAULT 0  -- 0 means immediate
) RETURNS INT AS $$
DECLARE
    v_cleaned INT;
    v_cutoff_date TIMESTAMPTZ;
BEGIN
    v_cutoff_date := CURRENT_TIMESTAMP - (p_inactive_days || ' days')::interval;
    
    IF p_force OR EXISTS (
        SELECT 1 FROM tree_core.lenders 
        WHERE lender_id = p_lender_id 
        AND status IN ('INACTIVE', 'DELETED')
    ) THEN
        UPDATE tree_core.questions
        SET status = 'ARCHIVED',
            archived_at = CURRENT_TIMESTAMP,
            deletion_reason = format('Broker cleanup: inactive for %s days', p_inactive_days)
        WHERE owner_id = p_lender_id
          AND owner_type = 'LENDER'
          AND active_scenario_count = 0
          AND (last_used_at < v_cutoff_date OR last_used_at IS NULL);
        
        GET DIAGNOSTICS v_cleaned = ROW_COUNT;
        RETURN v_cleaned;
    END IF;
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PERFORMANCE OPTIMIZATION LAYER
-- ============================================================

-- Connection pool configuration table
CREATE TABLE tree_core.performance_config (
    config_key         TEXT PRIMARY KEY,
    config_value       TEXT NOT NULL,
    config_type        TEXT CHECK (config_type IN ('NUMBER', 'TEXT', 'BOOLEAN', 'JSON')),
    description        TEXT,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert default performance settings
INSERT INTO tree_core.performance_config (config_key, config_value, config_type, description) VALUES
    ('max_connections_per_tenant', '10', 'NUMBER', 'Maximum DB connections per tenant'),
    ('materialized_view_refresh_interval', '300', 'NUMBER', 'Seconds between MV refreshes'),
    ('event_archive_days', '90', 'NUMBER', 'Days before archiving events'),
    ('cache_ttl_seconds', '3600', 'NUMBER', 'Default cache TTL'),
    ('enable_read_replicas', 'true', 'BOOLEAN', 'Use read replicas for queries');

-- Async materialized view refresh
CREATE OR REPLACE FUNCTION tree_state.async_refresh_views()
RETURNS void AS $$
BEGIN
    -- Use pg_background extension or application-level job queue
    PERFORM pg_notify('refresh_views', json_build_object(
        'timestamp', CURRENT_TIMESTAMP,
        'views', ARRAY[
            'tree_state.mv_node_visibility',
            'tree_core.mv_historical_questions',
            'analytics.mv_question_performance'
        ],
        'priority', 'background',
        'strategy', 'concurrent'
    )::text);
END;
$$ LANGUAGE plpgsql;

-- Historical questions materialized view
CREATE MATERIALIZED VIEW tree_core.mv_historical_questions AS
SELECT 
    q.question_id,
    q.question_code,
    q.question_scope,
    q.owner_type,
    l.lender_name,
    q.status,
    q.deleted_at,
    q.priority,
    array_agg(DISTINCT s.scenario_id) FILTER (WHERE s.scenario_id IS NOT NULL) as used_in_scenarios,
    COUNT(DISTINCT s.scenario_id) as usage_count,
    MAX(a.provided_at) as last_answered
FROM tree_core.questions q
LEFT JOIN tree_core.lenders l ON q.owner_id = l.lender_id
LEFT JOIN tree_state.answers a ON q.question_id = a.question_id
LEFT JOIN tree_state.scenarios s ON a.scenario_id = s.scenario_id
GROUP BY q.question_id, q.question_code, q.question_scope, 
         q.owner_type, l.lender_name, q.status, q.deleted_at, q.priority;

CREATE INDEX idx_mv_historical_questions_lender 
ON tree_core.mv_historical_questions(lender_name);

CREATE INDEX idx_mv_historical_questions_status
ON tree_core.mv_historical_questions(status);

-- ============================================================
-- INTEGRATION MAPPING FRAMEWORK
-- ============================================================

CREATE SCHEMA IF NOT EXISTS integration;

-- External system registry
CREATE TABLE integration.external_systems (
    system_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_code        TEXT UNIQUE NOT NULL,
    system_name        TEXT NOT NULL,
    system_type        TEXT CHECK (system_type IN ('CRM', 'LOS', 'PORTAL', 'API', 'DATABASE')),
    connection_config  JSONB NOT NULL DEFAULT '{}',
    is_active          BOOLEAN DEFAULT TRUE,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Question mapping for integrations
CREATE TABLE integration.question_mappings (
    mapping_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id        UUID REFERENCES tree_core.questions(question_id),
    system_id          UUID REFERENCES integration.external_systems(system_id),
    external_field_id  TEXT NOT NULL,
    field_path         TEXT, -- e.g., 'application.borrower.income'
    field_type         TEXT,
    -- Bidirectional transformation rules
    to_external_transform   JSONB, -- How to convert our value to theirs
    from_external_transform JSONB, -- How to convert their value to ours
    -- Sync configuration
    sync_direction     TEXT DEFAULT 'BOTH' CHECK (sync_direction IN ('TO_EXTERNAL', 'FROM_EXTERNAL', 'BOTH', 'NONE')),
    sync_priority      INT DEFAULT 100,
    last_synced_at     TIMESTAMPTZ,
    -- Metadata
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by         UUID NOT NULL,
    notes              TEXT,
    UNIQUE(question_id, system_id, external_field_id)
);

-- Sync status tracking
CREATE TABLE integration.sync_status (
    sync_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapping_id         UUID REFERENCES integration.question_mappings(mapping_id),
    scenario_id        UUID REFERENCES tree_state.scenarios(scenario_id),
    sync_direction     TEXT NOT NULL,
    sync_status        TEXT NOT NULL CHECK (sync_status IN ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'RETRY')),
    attempt_count      INT DEFAULT 0,
    last_attempt       TIMESTAMPTZ,
    next_retry         TIMESTAMPTZ,
    error_message      TEXT,
    payload            JSONB
);

-- ============================================================
-- SCENARIO MIGRATION TOOLS
-- ============================================================

-- Comprehensive scenario migration
CREATE OR REPLACE FUNCTION tree_core.migrate_lender_scenarios(
    p_from_lender_id UUID,
    p_to_lender_id UUID,
    p_scenario_ids UUID[],
    p_mapping_strategy TEXT DEFAULT 'BEST_MATCH' -- 'EXACT', 'BEST_MATCH', 'CREATE_MISSING'
) RETURNS JSONB AS $$
DECLARE
    v_migration_id UUID := gen_random_uuid();
    v_results JSONB := '{"migrated": 0, "failed": 0, "conflicts": []}'::jsonb;
    v_scenario_id UUID;
    v_mapping JSONB;
BEGIN
    -- Create migration log
    CREATE TEMP TABLE IF NOT EXISTS migration_log (
        migration_id UUID,
        scenario_id UUID,
        from_question_id UUID,
        to_question_id UUID,
        status TEXT,
        notes TEXT
    );
    
    -- Process each scenario
    FOREACH v_scenario_id IN ARRAY p_scenario_ids LOOP
        BEGIN
            -- Build question mapping
            WITH question_map AS (
                SELECT 
                    fq.question_id as from_id,
                    fq.question_code,
                    tq.question_id as to_id,
                    CASE 
                        WHEN tq.question_id IS NOT NULL THEN 'EXACT_MATCH'
                        WHEN p_mapping_strategy = 'CREATE_MISSING' THEN 'CREATE_NEW'
                        ELSE 'NO_MATCH'
                    END as map_type
                FROM tree_state.answers a
                JOIN tree_core.questions fq ON a.question_id = fq.question_id
                LEFT JOIN tree_core.questions tq ON 
                    fq.question_code = tq.question_code 
                    AND tq.owner_id = p_to_lender_id
                WHERE a.scenario_id = v_scenario_id
                  AND fq.owner_id = p_from_lender_id
            )
            INSERT INTO migration_log 
            SELECT v_migration_id, v_scenario_id, from_id, to_id, map_type, NULL
            FROM question_map;
            
            -- Perform migration based on strategy
            IF p_mapping_strategy != 'EXACT' OR NOT EXISTS (
                SELECT 1 FROM migration_log 
                WHERE migration_id = v_migration_id 
                  AND scenario_id = v_scenario_id 
                  AND status = 'NO_MATCH'
            ) THEN
                -- Update scenario to new lender's tree
                UPDATE tree_state.scenarios s
                SET tree_id = (
                    SELECT t.tree_id 
                    FROM tree_core.trees t 
                    WHERE t.tenant_id = s.tenant_id 
                      AND EXISTS (
                          SELECT 1 FROM tree_core.tree_nodes tn
                          JOIN tree_core.questions q ON tn.question_id = q.question_id
                          WHERE tn.tree_id = t.tree_id
                            AND q.owner_id = p_to_lender_id
                      )
                    LIMIT 1
                )
                WHERE scenario_id = v_scenario_id;
                
                v_results := jsonb_set(v_results, '{migrated}', 
                    to_jsonb((v_results->>'migrated')::int + 1));
            ELSE
                v_results := jsonb_set(v_results, '{failed}', 
                    to_jsonb((v_results->>'failed')::int + 1));
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            v_results := jsonb_set(v_results, '{failed}', 
                to_jsonb((v_results->>'failed')::int + 1));
            v_results := jsonb_set(v_results, '{conflicts}', 
                v_results->'conflicts' || jsonb_build_object(
                    'scenario_id', v_scenario_id,
                    'error', SQLERRM
                ));
        END;
    END LOOP;
    
    -- Add migration summary
    v_results := v_results || jsonb_build_object(
        'migration_id', v_migration_id,
        'mapping_summary', (
            SELECT jsonb_agg(DISTINCT jsonb_build_object(
                'status', status,
                'count', count(*)
            ))
            FROM migration_log
            WHERE migration_id = v_migration_id
            GROUP BY status
        )
    );
    
    RETURN v_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- QUESTION PERFORMANCE ANALYTICS
-- ============================================================

-- Enhanced analytics view
CREATE MATERIALIZED VIEW analytics.mv_question_performance AS
WITH question_events AS (
    SELECT 
        e.scenario_id,
        e.event_timestamp,
        e.event_type_id,
        et.event_type_code,
        (e.event_data->>'question_id')::uuid as question_id,
        (e.event_data->>'node_id')::uuid as node_id,
        e.duration_ms
    FROM tree_events.events e
    JOIN tree_events.event_types et ON e.event_type_id = et.event_type_id
    WHERE et.event_type_code IN ('NODE_ENTERED', 'NODE_EXITED', 'ANSWER_PROVIDED', 'VALIDATION_FAILED')
),
question_timings AS (
    SELECT 
        qe.question_id,
        qe.scenario_id,
        SUM(CASE WHEN qe.event_type_code = 'NODE_ENTERED' THEN 1 ELSE 0 END) as entries,
        SUM(CASE WHEN qe.event_type_code = 'VALIDATION_FAILED' THEN 1 ELSE 0 END) as validation_failures,
        AVG(qe.duration_ms) as avg_duration_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY qe.duration_ms) as median_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY qe.duration_ms) as p95_duration_ms
    FROM question_events qe
    GROUP BY qe.question_id, qe.scenario_id
),
abandonment_stats AS (
    SELECT 
        nav.current_node_id,
        tn.question_id,
        COUNT(*) as abandoned_count
    FROM tree_state.navigation nav
    JOIN tree_state.scenarios s ON nav.scenario_id = s.scenario_id
    JOIN tree_core.tree_nodes tn ON nav.current_node_id = tn.node_id
    WHERE s.status = 'CANCELLED'
       OR (s.status = 'DRAFT' AND s.created_at < CURRENT_TIMESTAMP - INTERVAL '30 days')
    GROUP BY nav.current_node_id, tn.question_id
)
SELECT 
    q.question_id,
    q.question_code,
    q.question_scope,
    q.priority,
    l.lender_name,
    COUNT(DISTINCT qt.scenario_id) as times_shown,
    SUM(qt.entries) as total_entries,
    SUM(qt.validation_failures) as total_validation_failures,
    AVG(qt.avg_duration_ms) as avg_duration_ms,
    AVG(qt.median_duration_ms) as median_duration_ms,
    AVG(qt.p95_duration_ms) as p95_duration_ms,
    COALESCE(ab.abandoned_count, 0) as abandonment_count,
    CASE 
        WHEN COUNT(DISTINCT qt.scenario_id) > 0 
        THEN (COALESCE(ab.abandoned_count, 0)::NUMERIC / COUNT(DISTINCT qt.scenario_id) * 100)
        ELSE 0 
    END as abandonment_rate
FROM tree_core.questions q
LEFT JOIN tree_core.lenders l ON q.owner_id = l.lender_id
LEFT JOIN question_timings qt ON q.question_id = qt.question_id
LEFT JOIN abandonment_stats ab ON q.question_id = ab.question_id
GROUP BY q.question_id, q.question_code, q.question_scope, q.priority, 
         l.lender_name, ab.abandoned_count;

CREATE INDEX idx_mv_question_performance_lender 
ON analytics.mv_question_performance(lender_name);

CREATE INDEX idx_mv_question_performance_abandonment 
ON analytics.mv_question_performance(abandonment_rate DESC);

-- ============================================================
-- QUESTION TEMPLATES AND GROUPING
-- ============================================================

-- Question template library
CREATE TABLE tree_core.question_templates (
    template_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name      TEXT NOT NULL,
    template_category  TEXT NOT NULL,
    description        TEXT,
    -- Template content
    questions          JSONB NOT NULL, -- Array of question definitions
    default_order      JSONB, -- Suggested ordering
    -- Usage
    usage_count        INT DEFAULT 0,
    last_used_at       TIMESTAMPTZ,
    -- Metadata
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by         UUID NOT NULL,
    is_public          BOOLEAN DEFAULT FALSE,
    tags               TEXT[]
);

-- Question groups for organization
CREATE TABLE tree_core.question_groups (
    group_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name         TEXT NOT NULL,
    group_code         TEXT UNIQUE NOT NULL,
    parent_group_id    UUID REFERENCES tree_core.question_groups(group_id),
    description        TEXT,
    display_order      INT DEFAULT 100,
    icon               TEXT,
    is_collapsible     BOOLEAN DEFAULT TRUE,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Link questions to groups
ALTER TABLE tree_core.questions
ADD COLUMN group_id UUID REFERENCES tree_core.question_groups(group_id);

-- Common question groups
INSERT INTO tree_core.question_groups (group_name, group_code, display_order) VALUES
    ('Personal Information', 'PERSONAL_INFO', 100),
    ('Employment Details', 'EMPLOYMENT', 200),
    ('Income & Assets', 'INCOME_ASSETS', 300),
    ('Property Information', 'PROPERTY', 400),
    ('Loan Details', 'LOAN_DETAILS', 500),
    ('Business Information', 'BUSINESS_INFO', 600),
    ('Additional Documentation', 'DOCUMENTATION', 700);

-- ============================================================
-- CONDITIONAL REQUIREMENTS ENGINE
-- ============================================================

-- Enhanced condition types for complex requirements
ALTER TYPE tree_core.conditions
ADD VALUE 'REQUIRES_IF' AFTER 'COMPUTED';

-- Conditional requirement rules
CREATE TABLE tree_core.conditional_requirements (
    requirement_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id        UUID REFERENCES tree_core.questions(question_id),
    condition_id       UUID REFERENCES tree_core.conditions(condition_id),
    -- What to require when condition is true
    required_questions UUID[] NOT NULL DEFAULT '{}',
    required_documents TEXT[] DEFAULT '{}',
    requirement_message TEXT,
    -- Priority override
    override_priority  TEXT CHECK (override_priority IN ('HIGH', 'URGENT', 'BLOCKING')),
    -- Metadata
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by         UUID NOT NULL,
    is_active          BOOLEAN DEFAULT TRUE
);

-- Function to evaluate conditional requirements
CREATE OR REPLACE FUNCTION tree_core.evaluate_conditional_requirements(
    p_scenario_id UUID
) RETURNS TABLE (
    question_id UUID,
    is_required BOOLEAN,
    requirement_reason TEXT,
    priority_override TEXT
) LANGUAGE plpgsql AS $$
DECLARE
    v_context JSONB;
BEGIN
    -- Build evaluation context
    SELECT jsonb_object_agg(q.question_code, 
        COALESCE(
            to_jsonb(a.value_text),
            to_jsonb(a.value_number),
            to_jsonb(a.value_boolean),
            to_jsonb(a.value_date),
            a.value_json
        )
    ) INTO v_context
    FROM tree_state.answers a
    JOIN tree_core.questions q ON a.question_id = q.question_id
    WHERE a.scenario_id = p_scenario_id;
    
    -- Evaluate all conditional requirements
    RETURN QUERY
    WITH evaluated_conditions AS (
        SELECT 
            cr.requirement_id,
            cr.question_id,
            cr.required_questions,
            cr.requirement_message,
            cr.override_priority,
            tree_core.evaluate_condition(cr.condition_id, v_context) as condition_met
        FROM tree_core.conditional_requirements cr
        WHERE cr.is_active = TRUE
    ),
    expanded_requirements AS (
        SELECT 
            unnest(ec.required_questions) as question_id,
            ec.condition_met as is_required,
            ec.requirement_message as requirement_reason,
            ec.override_priority as priority_override
        FROM evaluated_conditions ec
        WHERE ec.condition_met = TRUE
    )
    SELECT DISTINCT
        er.question_id,
        bool_or(er.is_required) as is_required,
        string_agg(DISTINCT er.requirement_reason, '; ') as requirement_reason,
        -- Take highest priority if multiple rules apply
        CASE
            WHEN bool_or(er.priority_override = 'BLOCKING') THEN 'BLOCKING'
            WHEN bool_or(er.priority_override = 'URGENT') THEN 'URGENT'
            WHEN bool_or(er.priority_override = 'HIGH') THEN 'HIGH'
            ELSE NULL
        END as priority_override
    FROM expanded_requirements er
    GROUP BY er.question_id;
END;
$$;

-- ============================================================
-- AUTO-COMPLETE AND SMART DEFAULTS
-- ============================================================

-- Previous answer lookup for auto-complete
CREATE OR REPLACE FUNCTION tree_core.get_previous_answers(
    p_tenant_id UUID,
    p_borrower_id UUID,
    p_question_codes TEXT[]
) RETURNS TABLE (
    question_code TEXT,
    previous_value JSONB,
    answer_date TIMESTAMPTZ,
    confidence_score NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH recent_answers AS (
        SELECT 
            q.question_code,
            COALESCE(
                to_jsonb(a.value_text),
                to_jsonb(a.value_number),
                to_jsonb(a.value_boolean),
                to_jsonb(a.value_date),
                a.value_json
            ) as answer_value,
            a.provided_at,
            -- Calculate confidence based on recency and validation
            CASE 
                WHEN a.is_valid THEN 
                    GREATEST(0, 1 - (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - a.provided_at)) / 86400 / 365))
                ELSE 0.5
            END as confidence
        FROM tree_state.answers a
        JOIN tree_core.questions q ON a.question_id = q.question_id
        JOIN tree_state.scenarios s ON a.scenario_id = s.scenario_id
        WHERE s.tenant_id = p_tenant_id
          AND s.created_by = p_borrower_id  -- Assuming borrower is creator
          AND q.question_code = ANY(p_question_codes)
          AND s.status IN ('COMPLETED', 'SUBMITTED')
    ),
    ranked_answers AS (
        SELECT 
            question_code,
            answer_value,
            provided_at,
            confidence,
            ROW_NUMBER() OVER (PARTITION BY question_code ORDER BY provided_at DESC) as rn
        FROM recent_answers
    )
    SELECT 
        question_code,
        answer_value as previous_value,
        provided_at as answer_date,
        confidence::numeric as confidence_score
    FROM ranked_answers
    WHERE rn = 1;
END;
$$;

-- Smart defaults based on patterns
CREATE TABLE tree_core.smart_defaults (
    default_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id        UUID REFERENCES tree_core.questions(question_id),
    condition_id       UUID REFERENCES tree_core.conditions(condition_id),
    default_value      JSONB NOT NULL,
    confidence_level   NUMERIC(3,2) CHECK (confidence_level BETWEEN 0 AND 1),
    source             TEXT CHECK (source IN ('RULE', 'ML', 'STATISTICAL', 'MANUAL')),
    is_active          BOOLEAN DEFAULT TRUE,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- VALIDATION RULE ENHANCEMENTS
-- ============================================================

-- Per-lender validation overrides
CREATE TABLE tree_core.lender_validation_rules (
    rule_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lender_id          UUID REFERENCES tree_core.lenders(lender_id),
    question_id        UUID REFERENCES tree_core.questions(question_id),
    validation_type    TEXT NOT NULL CHECK (validation_type IN (
        'REPLACE',    -- Replace standard validation
        'EXTEND',     -- Add to standard validation
        'RELAX'       -- Remove specific validations
    )),
    validation_rules   JSONB NOT NULL,
    error_message      TEXT,
    is_active          BOOLEAN DEFAULT TRUE,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lender_id, question_id)
);

-- Function to get effective validation for a question
CREATE OR REPLACE FUNCTION tree_core.get_effective_validation(
    p_question_id UUID,
    p_lender_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_base_validation JSONB;
    v_lender_validation JSONB;
    v_validation_type TEXT;
BEGIN
    -- Get base validation
    SELECT validation_schema INTO v_base_validation
    FROM tree_core.questions
    WHERE question_id = p_question_id;
    
    -- Check for lender overrides
    IF p_lender_id IS NOT NULL THEN
        SELECT validation_rules, validation_type 
        INTO v_lender_validation, v_validation_type
        FROM tree_core.lender_validation_rules
        WHERE lender_id = p_lender_id
          AND question_id = p_question_id
          AND is_active = TRUE;
        
        IF v_lender_validation IS NOT NULL THEN
            CASE v_validation_type
                WHEN 'REPLACE' THEN
                    RETURN v_lender_validation;
                WHEN 'EXTEND' THEN
                    RETURN v_base_validation || v_lender_validation;
                WHEN 'RELAX' THEN
                    -- Remove specified rules
                    RETURN v_base_validation - (
                        SELECT array_agg(value) 
                        FROM jsonb_array_elements_text(v_lender_validation)
                    );
            END CASE;
        END IF;
    END IF;
    
    RETURN v_base_validation;
END;
$$;

-- ============================================================
-- PERFORMANCE MONITORING
-- ============================================================

-- Real-time performance metrics
CREATE TABLE monitoring.performance_metrics (
    metric_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_timestamp   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    metric_type        TEXT NOT NULL,
    metric_name        TEXT NOT NULL,
    metric_value       NUMERIC NOT NULL,
    tags               JSONB DEFAULT '{}',
    tenant_id          UUID
);

-- Index for time-series queries
CREATE INDEX idx_performance_metrics_time 
ON monitoring.performance_metrics 
USING BRIN(metric_timestamp);

-- Performance tracking function
CREATE OR REPLACE FUNCTION monitoring.track_performance(
    p_metric_type TEXT,
    p_metric_name TEXT,
    p_metric_value NUMERIC,
    p_tags JSONB DEFAULT '{}'
) RETURNS void AS $$
BEGIN
    INSERT INTO monitoring.performance_metrics (
        metric_type, metric_name, metric_value, tags, tenant_id
    ) VALUES (
        p_metric_type, p_metric_name, p_metric_value, p_tags,
        current_setting('app.tenant_id', TRUE)::uuid
    );
END;
$$ LANGUAGE plpgsql;

-- Dashboard view for brokers
CREATE OR REPLACE VIEW monitoring.v_broker_dashboard AS
WITH current_metrics AS (
    SELECT * FROM monitoring.performance_metrics
    WHERE metric_timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
)
SELECT 
    -- Active scenarios
    (SELECT COUNT(*) FROM tree_state.scenarios 
     WHERE status IN ('DRAFT', 'IN_PROGRESS')) as active_scenarios,
    
    -- Questions pending answers
    (SELECT COUNT(*) FROM tree_state.navigation n
     JOIN tree_core.tree_nodes tn ON n.current_node_id = tn.node_id
     WHERE tn.question_id IS NOT NULL) as pending_questions,
    
    -- Average response time
    (SELECT AVG(metric_value) FROM current_metrics 
     WHERE metric_type = 'RESPONSE_TIME') as avg_response_time_ms,
    
    -- Completion rate today
    (SELECT COUNT(*) FILTER (WHERE status = 'COMPLETED') * 100.0 / 
            NULLIF(COUNT(*), 0)
     FROM tree_state.scenarios
     WHERE created_at > CURRENT_DATE) as completion_rate_today,
    
    -- Top abandonment question
    (SELECT question_code 
     FROM analytics.mv_question_performance
     ORDER BY abandonment_rate DESC
     LIMIT 1) as top_abandonment_question;

-- ============================================================
-- FINAL OPTIMIZATIONS AND INDEXES
-- ============================================================

-- Composite indexes for common queries
CREATE INDEX idx_questions_owner_status 
ON tree_core.questions(owner_id, owner_type, status) 
WHERE status = 'ACTIVE';

CREATE INDEX idx_scenarios_tenant_created 
ON tree_state.scenarios(tenant_id, created_at DESC);

CREATE INDEX idx_answers_scenario_question 
ON tree_state.answers(scenario_id, question_id);

-- Partial indexes for performance
CREATE INDEX idx_questions_high_priority 
ON tree_core.questions(priority, question_id) 
WHERE priority IN ('HIGH', 'URGENT', 'BLOCKING');

CREATE INDEX idx_events_recent_by_scenario 
ON tree_events.events(scenario_id, event_timestamp DESC) 
WHERE event_timestamp > CURRENT_TIMESTAMP - INTERVAL '7 days';

-- Function-based index for quick lookups
CREATE INDEX idx_questions_code_lower 
ON tree_core.questions(lower(question_code));

COMMIT;

-- ============================================================
-- MAINTENANCE SCHEDULE
-- ============================================================

-- Schedule these operations:
-- 1. VACUUM ANALYZE tree_events.events; -- Daily
-- 2. REFRESH MATERIALIZED VIEW CONCURRENTLY tree_core.mv_historical_questions; -- Every 6 hours
-- 3. REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_question_performance; -- Every hour
-- 4. CALL tree_core.cleanup_orphaned_questions(false); -- Weekly
-- 5. CALL tree_events.archive_old_events(90); -- Monthly
