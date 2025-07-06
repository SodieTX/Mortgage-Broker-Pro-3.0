-- ============================================================
-- SCENARIO TREE CORE LOGIC v3.0 - PRODUCTION FOUNDATION
-- Immutable architectural decisions for mortgage decision engine
-- ============================================================

-- CRITICAL: These design decisions are foundational and should NOT change:
-- 1. Immutable Question/Attribute IDs (never deleted, only deprecated)
-- 2. Event-sourced state management (append-only, never update)
-- 3. Bitemporal versioning (system time + valid time)
-- 4. Multi-tenant from day one (can't retrofit later)
-- 5. Tree nodes are positional, not path-dependent (allows moves)

BEGIN;

-- ============================================================
-- FOUNDATION LAYER 1: IMMUTABLE DOMAIN MODEL
-- ============================================================

-- Core domain entities that NEVER change once created
CREATE SCHEMA IF NOT EXISTS tree_core;
CREATE SCHEMA IF NOT EXISTS tree_state;
CREATE SCHEMA IF NOT EXISTS tree_events;

-- Question registry with lifecycle management
CREATE TABLE tree_core.questions (
    question_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_code       TEXT NOT NULL, -- e.g., 'LOAN_AMOUNT', 'PROPERTY_TYPE'
    question_version    INT NOT NULL DEFAULT 1,
    
    -- Question ownership and scope
    question_scope      TEXT NOT NULL CHECK (question_scope IN (
        'CORE',          -- System-wide, never deleted
        'STANDARD',      -- Industry standard, rarely deleted
        'LENDER',        -- Lender-specific, can be deleted
        'CUSTOM',        -- Tenant custom, can be deleted
        'TEMPORARY'      -- For testing, auto-cleanup
    )),
    owner_id           UUID, -- NULL for CORE/STANDARD, lender_id or tenant_id for others
    owner_type         TEXT CHECK (owner_type IN ('SYSTEM', 'LENDER', 'TENANT', 'USER')),
    
    -- Data definition
    data_type          TEXT NOT NULL CHECK (data_type IN (
        'text', 'number', 'boolean', 'date', 'money', 
        'percentage', 'enum', 'multi_enum', 'json'
    )),
    validation_schema   JSONB NOT NULL DEFAULT '{}',
    
    -- Lifecycle management
    status             TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
        'DRAFT',         -- Being created
        'ACTIVE',        -- In use
        'DEPRECATED',    -- Phasing out
        'ARCHIVED',      -- Historical only
        'DELETED'        -- Soft deleted
    )),
    
    -- Temporal validity
    valid_from         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to           TIMESTAMPTZ DEFAULT 'infinity',
    system_period      tstzrange GENERATED ALWAYS AS (tstzrange(valid_from, valid_to)) STORED,
    
    -- Metadata
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by         UUID NOT NULL,
    archived_at        TIMESTAMPTZ,
    archived_by        UUID,
    deleted_at         TIMESTAMPTZ,
    deleted_by         UUID,
    deletion_reason    TEXT,
    replacement_id     UUID REFERENCES tree_core.questions(question_id),
    
    -- Usage tracking
    last_used_at       TIMESTAMPTZ,
    usage_count        BIGINT DEFAULT 0,
    active_scenario_count INT DEFAULT 0,
    
    -- Constraints
    CONSTRAINT valid_temporal CHECK (valid_from < valid_to),
    CONSTRAINT owner_required_for_custom CHECK (
        (question_scope IN ('CORE', 'STANDARD')) OR 
        (owner_id IS NOT NULL AND owner_type IS NOT NULL)
    ),
    CONSTRAINT deletion_requires_reason CHECK (
        (deleted_at IS NULL) OR (deletion_reason IS NOT NULL)
    ),
    -- Allow same question_code for different owners
    UNIQUE(question_code, owner_id, question_version)
);

-- Stage definitions (mortgage workflow stages)
CREATE TABLE tree_core.stages (
    stage_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_code         TEXT UNIQUE NOT NULL,
    stage_category     TEXT NOT NULL CHECK (stage_category IN (
        'IDENTITY', 'CREDIT', 'COLLATERAL', 'PURPOSE', 'PRODUCT', 'CAPACITY', 'COMPLIANCE'
    )),
    
    -- Ordering and rules
    base_order         INT NOT NULL,
    is_required        BOOLEAN NOT NULL DEFAULT TRUE,
    can_parallelize    BOOLEAN NOT NULL DEFAULT FALSE, -- Can run alongside other stages
    depends_on_stages  UUID[] DEFAULT '{}',
    
    -- Temporal
    valid_from         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to           TIMESTAMPTZ DEFAULT 'infinity',
    
    -- Unique ordering within valid time
    EXCLUDE USING gist (base_order WITH =, tstzrange(valid_from, valid_to) WITH &&)
);

-- ============================================================
-- FOUNDATION LAYER 2: TREE STRUCTURE (CONTENT-ADDRESSED)
-- ============================================================

-- Tree definitions with content-based addressing (like Git)
CREATE TABLE tree_core.trees (
    tree_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL, -- Multi-tenant from day one
    tree_hash          TEXT UNIQUE NOT NULL, -- SHA-256 of tree content
    
    -- Tree metadata
    tree_name          TEXT NOT NULL,
    tree_type          TEXT NOT NULL CHECK (tree_type IN ('MASTER', 'TENANT', 'USER')),
    parent_tree_id     UUID REFERENCES tree_core.trees(tree_id),
    
    -- Immutability
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by         UUID NOT NULL,
    is_published       BOOLEAN NOT NULL DEFAULT FALSE,
    published_at       TIMESTAMPTZ,
    
    -- Validation state
    validation_status  TEXT NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN (
        'PENDING', 'VALID', 'INVALID', 'WARNING'
    )),
    validation_report  JSONB DEFAULT '{}',
    
    UNIQUE(tenant_id, tree_name),
    CONSTRAINT published_trees_are_valid CHECK (
        NOT is_published OR validation_status IN ('VALID', 'WARNING')
    )
);

-- Tree nodes (immutable once created)
CREATE TABLE tree_core.tree_nodes (
    node_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id            UUID NOT NULL REFERENCES tree_core.trees(tree_id),
    node_hash          TEXT NOT NULL, -- SHA-256 of node content
    
    -- Structure (adjacency list with order)
    parent_node_id     UUID REFERENCES tree_core.tree_nodes(node_id),
    sibling_order      DECIMAL(20,10) NOT NULL, -- Allows infinite insertions between
    
    -- Core references
    question_id        UUID REFERENCES tree_core.questions(question_id),
    stage_id           UUID NOT NULL REFERENCES tree_core.stages(stage_id),
    
    -- Node metadata
    node_type          TEXT NOT NULL CHECK (node_type IN (
        'QUESTION', 'GROUP', 'SECTION', 'COMPUTED', 'EXTERNAL'
    )),
    display_config     JSONB NOT NULL DEFAULT '{}',
    behavior_config    JSONB NOT NULL DEFAULT '{}',
    
    -- Constraints
    UNIQUE(tree_id, node_hash), -- Same content = same hash
    CONSTRAINT groups_have_no_questions CHECK (
        (node_type != 'GROUP') OR (question_id IS NULL)
    ),
    CONSTRAINT questions_require_id CHECK (
        (node_type != 'QUESTION') OR (question_id IS NOT NULL)
    )
);

-- Create composite index for tree traversal
CREATE INDEX idx_tree_nodes_traversal ON tree_core.tree_nodes(tree_id, parent_node_id, sibling_order);

-- ============================================================
-- FOUNDATION LAYER 3: CONDITIONAL LOGIC (DECLARATIVE)
-- ============================================================

-- Condition definitions (reusable across trees)
CREATE TABLE tree_core.conditions (
    condition_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condition_hash     TEXT UNIQUE NOT NULL, -- Content-addressed
    
    -- Condition structure
    condition_type     TEXT NOT NULL CHECK (condition_type IN (
        'SIMPLE', 'COMPOUND', 'COMPUTED', 'EXTERNAL'
    )),
    operator           TEXT NOT NULL CHECK (operator IN (
        -- Comparison
        'EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE',
        -- Set operations
        'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS',
        -- Pattern matching
        'MATCHES', 'NOT_MATCHES',
        -- Existence
        'EXISTS', 'NOT_EXISTS',
        -- Logical
        'AND', 'OR', 'NOT', 'XOR',
        -- Special
        'BETWEEN', 'OUTSIDE', 'WITHIN_DAYS', 'CUSTOM'
    )),
    
    -- Operands
    left_operand       JSONB NOT NULL, -- Can be question_id, literal, or expression
    right_operand      JSONB, -- Optional for unary operators
    
    -- For compound conditions
    child_conditions   UUID[] DEFAULT '{}',
    
    -- Metadata
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description        TEXT,
    
    CONSTRAINT compound_requires_children CHECK (
        (condition_type != 'COMPOUND') OR (array_length(child_conditions, 1) > 0)
    ),
    CONSTRAINT simple_no_children CHECK (
        (condition_type != 'SIMPLE') OR (child_conditions = '{}')
    )
);

-- Node visibility/behavior rules
CREATE TABLE tree_core.node_rules (
    rule_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id            UUID NOT NULL REFERENCES tree_core.tree_nodes(node_id),
    rule_type          TEXT NOT NULL CHECK (rule_type IN (
        'VISIBILITY', 'REQUIREMENT', 'VALIDATION', 'COMPUTATION', 'SIDE_EFFECT'
    )),
    
    -- Rule definition
    condition_id       UUID NOT NULL REFERENCES tree_core.conditions(condition_id),
    action             JSONB NOT NULL, -- What happens when condition is true
    priority           INT NOT NULL DEFAULT 100,
    
    -- Rule behavior
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    stop_on_match      BOOLEAN NOT NULL DEFAULT FALSE, -- Stop evaluating other rules
    
    UNIQUE(node_id, rule_type, priority)
);

-- ============================================================
-- FOUNDATION LAYER 4: STATE MANAGEMENT (EVENT-SOURCED)
-- ============================================================

-- Scenario instances (what users fill out)
CREATE TABLE tree_state.scenarios (
    scenario_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    tree_id            UUID NOT NULL REFERENCES tree_core.trees(tree_id),
    
    -- Scenario metadata
    external_id        TEXT, -- External system reference
    scenario_type      TEXT NOT NULL CHECK (scenario_type IN (
        'APPLICATION', 'PREVIEW', 'SIMULATION', 'TEMPLATE'
    )),
    
    -- State tracking
    current_version    BIGINT NOT NULL DEFAULT 0,
    status             TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED'
    )),
    
    -- Temporal
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by         UUID NOT NULL,
    expires_at         TIMESTAMPTZ,
    
    UNIQUE(tenant_id, external_id),
    INDEX idx_scenarios_tenant_status (tenant_id, status)
);

-- Event types for scenario state changes
CREATE TABLE tree_events.event_types (
    event_type_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type_code    TEXT UNIQUE NOT NULL,
    event_category     TEXT NOT NULL CHECK (event_category IN (
        'NAVIGATION', 'DATA', 'VALIDATION', 'SYSTEM', 'INTEGRATION'
    )),
    schema_version     INT NOT NULL DEFAULT 1,
    event_schema       JSONB NOT NULL,
    
    -- Event behavior
    is_terminal        BOOLEAN NOT NULL DEFAULT FALSE, -- Ends the scenario
    is_reversible      BOOLEAN NOT NULL DEFAULT TRUE,  -- Can be undone
    requires_reason    BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert core event types
INSERT INTO tree_events.event_types (event_type_code, event_category, event_schema) VALUES
    ('SCENARIO_STARTED', 'SYSTEM', '{"required": ["tree_id", "user_id"]}'),
    ('NODE_ENTERED', 'NAVIGATION', '{"required": ["node_id"]}'),
    ('NODE_EXITED', 'NAVIGATION', '{"required": ["node_id", "direction"]}'),
    ('ANSWER_PROVIDED', 'DATA', '{"required": ["node_id", "question_id", "value"]}'),
    ('ANSWER_CLEARED', 'DATA', '{"required": ["node_id", "question_id"]}'),
    ('VALIDATION_FAILED', 'VALIDATION', '{"required": ["node_id", "errors"]}'),
    ('VALIDATION_PASSED', 'VALIDATION', '{"required": ["node_id"]}'),
    ('STAGE_COMPLETED', 'NAVIGATION', '{"required": ["stage_id"]}'),
    ('SCENARIO_SUBMITTED', 'SYSTEM', '{"required": ["final_answers"]}'),
    ('EXTERNAL_DATA_RECEIVED', 'INTEGRATION', '{"required": ["source", "data"]}');

-- Immutable event log (append-only)
CREATE TABLE tree_events.events (
    event_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id        UUID NOT NULL REFERENCES tree_state.scenarios(scenario_id),
    event_type_id      UUID NOT NULL REFERENCES tree_events.event_types(event_type_id),
    
    -- Event data
    event_version      BIGINT NOT NULL, -- Incrementing version per scenario
    event_timestamp    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_data         JSONB NOT NULL,
    
    -- Causation and correlation
    caused_by_event_id UUID REFERENCES tree_events.events(event_id),
    correlation_id     UUID NOT NULL DEFAULT gen_random_uuid(),
    
    -- Actor information
    actor_id           UUID NOT NULL,
    actor_type         TEXT NOT NULL CHECK (actor_type IN ('USER', 'SYSTEM', 'INTEGRATION')),
    
    -- Request context
    request_id         UUID,
    ip_address         INET,
    user_agent         TEXT,
    
    -- Idempotency and ordering
    idempotency_key    TEXT,
    UNIQUE(scenario_id, event_version),
    UNIQUE(scenario_id, idempotency_key)
);

-- Create index for event sourcing queries
CREATE INDEX idx_events_scenario_version ON tree_events.events(scenario_id, event_version);
CREATE INDEX idx_events_correlation ON tree_events.events(correlation_id);
CREATE INDEX idx_events_timestamp ON tree_events.events(event_timestamp);

-- ============================================================
-- FOUNDATION LAYER 5: ANSWER STORAGE (NORMALIZED + JSONB)
-- ============================================================

-- Current state of answers (projected from events)
CREATE TABLE tree_state.answers (
    scenario_id        UUID NOT NULL REFERENCES tree_state.scenarios(scenario_id),
    question_id        UUID NOT NULL REFERENCES tree_core.questions(question_id),
    
    -- Answer data (polymorphic based on question data_type)
    value_text         TEXT,
    value_number       NUMERIC,
    value_boolean      BOOLEAN,
    value_date         DATE,
    value_timestamp    TIMESTAMPTZ,
    value_json         JSONB,
    
    -- Answer metadata
    provided_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    provided_by        UUID NOT NULL,
    source             TEXT NOT NULL CHECK (source IN ('USER', 'SYSTEM', 'IMPORT', 'COMPUTED')),
    
    -- Validation state
    is_valid           BOOLEAN NOT NULL DEFAULT TRUE,
    validation_errors  JSONB DEFAULT '[]',
    
    -- Version tracking (for optimistic locking)
    version            BIGINT NOT NULL DEFAULT 1,
    last_event_id      UUID NOT NULL REFERENCES tree_events.events(event_id),
    
    PRIMARY KEY (scenario_id, question_id)
);

-- Answer history (temporal table)
CREATE TABLE tree_state.answer_history (
    history_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id        UUID NOT NULL,
    question_id        UUID NOT NULL,
    
    -- Historical values
    value_text         TEXT,
    value_number       NUMERIC,
    value_boolean      BOOLEAN,
    value_date         DATE,
    value_timestamp    TIMESTAMPTZ,
    value_json         JSONB,
    
    -- Temporal validity
    valid_from         TIMESTAMPTZ NOT NULL,
    valid_to           TIMESTAMPTZ NOT NULL,
    
    -- Change tracking
    changed_by         UUID NOT NULL,
    change_reason      TEXT,
    event_id           UUID NOT NULL REFERENCES tree_events.events(event_id),
    
    CONSTRAINT valid_period CHECK (valid_from < valid_to)
);

CREATE INDEX idx_answer_history_lookup ON tree_state.answer_history(scenario_id, question_id, valid_to DESC);

-- ============================================================
-- FOUNDATION LAYER 6: NAVIGATION STATE (MATERIALIZED)
-- ============================================================

-- Current navigation position and progress
CREATE TABLE tree_state.navigation (
    scenario_id        UUID PRIMARY KEY REFERENCES tree_state.scenarios(scenario_id),
    
    -- Current position
    current_node_id    UUID REFERENCES tree_core.tree_nodes(node_id),
    current_stage_id   UUID REFERENCES tree_core.stages(stage_id),
    
    -- Progress tracking (arrays for performance)
    visited_nodes      UUID[] NOT NULL DEFAULT '{}',
    completed_nodes    UUID[] NOT NULL DEFAULT '{}',
    available_nodes    UUID[] NOT NULL DEFAULT '{}', -- Pre-computed based on conditions
    blocked_nodes      UUID[] NOT NULL DEFAULT '{}',
    
    -- Stage progress
    completed_stages   UUID[] NOT NULL DEFAULT '{}',
    
    -- Metrics
    total_questions    INT NOT NULL DEFAULT 0,
    answered_questions INT NOT NULL DEFAULT 0,
    progress_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN total_questions > 0 
            THEN (answered_questions::NUMERIC / total_questions * 100)
            ELSE 0 
        END
    ) STORED,
    
    -- Performance tracking
    total_duration_ms  BIGINT NOT NULL DEFAULT 0,
    last_activity      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Version for optimistic locking
    version            BIGINT NOT NULL DEFAULT 1
);

-- ============================================================
-- FOUNDATION LAYER 7: COMPUTED VISIBILITY & RULES ENGINE
-- ============================================================

-- Materialized view for fast node visibility computation
CREATE MATERIALIZED VIEW tree_state.mv_node_visibility AS
WITH rule_aggregation AS (
    SELECT 
        n.node_id,
        n.tree_id,
        n.question_id,
        n.stage_id,
        n.parent_node_id,
        n.sibling_order,
        
        -- Aggregate all rules by type
        jsonb_object_agg(
            r.rule_type,
            jsonb_build_object(
                'conditions', array_agg(r.condition_id ORDER BY r.priority),
                'actions', array_agg(r.action ORDER BY r.priority)
            )
        ) FILTER (WHERE r.rule_id IS NOT NULL) as rules
        
    FROM tree_core.tree_nodes n
    LEFT JOIN tree_core.node_rules r ON n.node_id = r.node_id AND r.is_active = TRUE
    GROUP BY n.node_id, n.tree_id, n.question_id, n.stage_id, n.parent_node_id, n.sibling_order
)
SELECT 
    ra.*,
    -- Pre-compute static visibility flags
    COALESCE((n.behavior_config->>'always_visible')::boolean, FALSE) as always_visible,
    COALESCE((n.behavior_config->>'always_required')::boolean, FALSE) as always_required,
    
    -- Extract question metadata for quick access
    q.question_code,
    q.data_type,
    q.validation_schema
    
FROM rule_aggregation ra
JOIN tree_core.tree_nodes n ON ra.node_id = n.node_id
LEFT JOIN tree_core.questions q ON ra.question_id = q.question_id;

CREATE UNIQUE INDEX idx_mv_node_visibility_pk ON tree_state.mv_node_visibility(node_id);
CREATE INDEX idx_mv_node_visibility_tree ON tree_state.mv_node_visibility(tree_id, sibling_order);

-- ============================================================
-- CORE FUNCTIONS: IMMUTABLE BUSINESS LOGIC
-- ============================================================

-- Function to evaluate conditions (pure, deterministic)
CREATE OR REPLACE FUNCTION tree_core.evaluate_condition(
    p_condition_id UUID,
    p_context JSONB
) RETURNS BOOLEAN 
LANGUAGE plpgsql 
IMMUTABLE 
PARALLEL SAFE
AS $$
DECLARE
    v_condition RECORD;
    v_left_value JSONB;
    v_right_value JSONB;
    v_result BOOLEAN;
BEGIN
    -- Get condition definition
    SELECT * INTO v_condition
    FROM tree_core.conditions
    WHERE condition_id = p_condition_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Handle compound conditions recursively
    IF v_condition.condition_type = 'COMPOUND' THEN
        CASE v_condition.operator
            WHEN 'AND' THEN
                SELECT bool_and(tree_core.evaluate_condition(cond_id, p_context))
                INTO v_result
                FROM unnest(v_condition.child_conditions) AS cond_id;
                
            WHEN 'OR' THEN
                SELECT bool_or(tree_core.evaluate_condition(cond_id, p_context))
                INTO v_result
                FROM unnest(v_condition.child_conditions) AS cond_id;
                
            WHEN 'NOT' THEN
                v_result := NOT tree_core.evaluate_condition(
                    v_condition.child_conditions[1], 
                    p_context
                );
                
            ELSE
                v_result := FALSE;
        END CASE;
        
        RETURN v_result;
    END IF;
    
    -- Resolve operand values
    v_left_value := tree_core.resolve_operand(v_condition.left_operand, p_context);
    v_right_value := tree_core.resolve_operand(v_condition.right_operand, p_context);
    
    -- Evaluate based on operator
    CASE v_condition.operator
        WHEN 'EQ' THEN
            v_result := v_left_value = v_right_value;
        WHEN 'NEQ' THEN
            v_result := v_left_value != v_right_value;
        WHEN 'GT' THEN
            v_result := (v_left_value #>> '{}')::numeric > (v_right_value #>> '{}')::numeric;
        WHEN 'GTE' THEN
            v_result := (v_left_value #>> '{}')::numeric >= (v_right_value #>> '{}')::numeric;
        WHEN 'LT' THEN
            v_result := (v_left_value #>> '{}')::numeric < (v_right_value #>> '{}')::numeric;
        WHEN 'LTE' THEN
            v_result := (v_left_value #>> '{}')::numeric <= (v_right_value #>> '{}')::numeric;
        WHEN 'IN' THEN
            v_result := v_left_value <@ v_right_value;
        WHEN 'NOT_IN' THEN
            v_result := NOT (v_left_value <@ v_right_value);
        WHEN 'EXISTS' THEN
            v_result := v_left_value IS NOT NULL;
        WHEN 'NOT_EXISTS' THEN
            v_result := v_left_value IS NULL;
        WHEN 'CONTAINS' THEN
            v_result := v_left_value @> v_right_value;
        WHEN 'MATCHES' THEN
            v_result := (v_left_value #>> '{}') ~ (v_right_value #>> '{}');
        ELSE
            v_result := FALSE;
    END CASE;
    
    RETURN COALESCE(v_result, FALSE);
END;
$$;

-- Function to resolve operand values from context
CREATE OR REPLACE FUNCTION tree_core.resolve_operand(
    p_operand JSONB,
    p_context JSONB
) RETURNS JSONB 
LANGUAGE plpgsql 
IMMUTABLE 
PARALLEL SAFE
AS $$
BEGIN
    IF p_operand IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Check operand type
    CASE p_operand->>'type'
        WHEN 'question' THEN
            -- Look up answer value by question_code
            RETURN p_context->(p_operand->>'question_code');
            
        WHEN 'literal' THEN
            -- Return literal value
            RETURN p_operand->'value';
            
        WHEN 'expression' THEN
            -- Evaluate expression (simplified for now)
            RETURN tree_core.evaluate_expression(p_operand->'expression', p_context);
            
        ELSE
            -- Default to returning operand as-is
            RETURN p_operand;
    END CASE;
END;
$$;

-- Function to get available nodes based on current state
CREATE OR REPLACE FUNCTION tree_state.get_available_nodes(
    p_scenario_id UUID
) RETURNS TABLE (
    node_id UUID,
    question_id UUID,
    stage_id UUID,
    is_available BOOLEAN,
    is_required BOOLEAN,
    blocking_conditions UUID[]
) 
LANGUAGE plpgsql 
STABLE
AS $$
DECLARE
    v_tree_id UUID;
    v_context JSONB;
BEGIN
    -- Get tree and build context
    SELECT s.tree_id INTO v_tree_id
    FROM tree_state.scenarios s
    WHERE s.scenario_id = p_scenario_id;
    
    -- Build answer context
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
    
    -- Return node availability
    RETURN QUERY
    WITH node_evaluation AS (
        SELECT 
            nv.node_id,
            nv.question_id,
            nv.stage_id,
            
            -- Check visibility rules
            CASE 
                WHEN nv.always_visible THEN TRUE
                WHEN nv.rules->'VISIBILITY' IS NULL THEN TRUE
                ELSE tree_core.evaluate_all_rules(
                    (nv.rules->'VISIBILITY'->'conditions')::uuid[],
                    v_context
                )
            END as is_visible,
            
            -- Check requirement rules
            CASE
                WHEN nv.always_required THEN TRUE
                WHEN nv.rules->'REQUIREMENT' IS NULL THEN FALSE
                ELSE tree_core.evaluate_all_rules(
                    (nv.rules->'REQUIREMENT'->'conditions')::uuid[],
                    v_context
                )
            END as is_required,
            
            -- Get blocking conditions
            CASE
                WHEN nv.rules->'VISIBILITY' IS NOT NULL THEN
                    (nv.rules->'VISIBILITY'->'conditions')::uuid[]
                ELSE
                    '{}'::uuid[]
            END as blocking_conditions
            
        FROM tree_state.mv_node_visibility nv
        WHERE nv.tree_id = v_tree_id
    )
    SELECT 
        ne.node_id,
        ne.question_id,
        ne.stage_id,
        ne.is_visible as is_available,
        ne.is_required,
        CASE 
            WHEN ne.is_visible THEN '{}'::uuid[]
            ELSE ne.blocking_conditions
        END
    FROM node_evaluation ne;
END;
$$;

-- ============================================================
-- CRITICAL CONSTRAINTS AND INDEXES
-- ============================================================

-- Ensure single active tree per tenant/name
CREATE UNIQUE INDEX idx_trees_active_per_tenant 
ON tree_core.trees(tenant_id, tree_name) 
WHERE is_published = TRUE;

-- Smart question lifecycle management
CREATE OR REPLACE FUNCTION tree_core.manage_question_lifecycle()
RETURNS TRIGGER AS $$
DECLARE
    v_active_scenarios INT;
    v_can_delete BOOLEAN;
BEGIN
    -- CORE and STANDARD questions have special rules
    IF OLD.question_scope IN ('CORE', 'STANDARD') THEN
        IF NEW.status = 'DELETED' THEN
            RAISE EXCEPTION 'Cannot delete % questions', OLD.question_scope;
        END IF;
        IF NEW.question_code != OLD.question_code THEN
            RAISE EXCEPTION 'Cannot rename % questions', OLD.question_scope;
        END IF;
    END IF;
    
    -- Check if question can be modified/deleted
    IF NEW.status IN ('ARCHIVED', 'DELETED') THEN
        -- Count active usage
        SELECT COUNT(DISTINCT s.scenario_id) INTO v_active_scenarios
        FROM tree_state.scenarios s
        JOIN tree_state.answers a ON s.scenario_id = a.scenario_id
        WHERE a.question_id = OLD.question_id
          AND s.status IN ('DRAFT', 'IN_PROGRESS');
        
        IF v_active_scenarios > 0 THEN
            RAISE EXCEPTION 'Cannot % question % - used in % active scenarios', 
                NEW.status, OLD.question_code, v_active_scenarios;
        END IF;
        
        -- Set metadata
        IF NEW.status = 'ARCHIVED' THEN
            NEW.archived_at := CURRENT_TIMESTAMP;
            NEW.archived_by := current_setting('app.user_id')::uuid;
        ELSIF NEW.status = 'DELETED' THEN
            NEW.deleted_at := CURRENT_TIMESTAMP;
            NEW.deleted_by := current_setting('app.user_id')::uuid;
            NEW.valid_to := CURRENT_TIMESTAMP;
        END IF;
    END IF;
    
    -- Update usage stats
    NEW.active_scenario_count := (
        SELECT COUNT(DISTINCT s.scenario_id)
        FROM tree_state.scenarios s
        JOIN tree_state.answers a ON s.scenario_id = a.scenario_id
        WHERE a.question_id = OLD.question_id
          AND s.status NOT IN ('COMPLETED', 'CANCELLED')
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_manage_question_lifecycle
BEFORE UPDATE ON tree_core.questions
FOR EACH ROW EXECUTE FUNCTION tree_core.manage_question_lifecycle();

-- Cascade lender deletion to their questions
CREATE OR REPLACE FUNCTION tree_core.handle_lender_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- When a lender is deleted, archive their custom questions
    UPDATE tree_core.questions
    SET status = 'ARCHIVED',
        archived_at = CURRENT_TIMESTAMP,
        archived_by = current_setting('app.user_id')::uuid,
        deletion_reason = 'Lender removed from system'
    WHERE owner_id = OLD.lender_id
      AND owner_type = 'LENDER'
      AND status = 'ACTIVE';
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Ensure events are immutable
CREATE OR REPLACE FUNCTION tree_events.prevent_event_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Events are immutable and cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_event_update
BEFORE UPDATE ON tree_events.events
FOR EACH ROW EXECUTE FUNCTION tree_events.prevent_event_modification();

CREATE TRIGGER trg_prevent_event_delete
BEFORE DELETE ON tree_events.events
FOR EACH ROW EXECUTE FUNCTION tree_events.prevent_event_modification();

-- ============================================================
-- PERFORMANCE OPTIMIZATIONS
-- ============================================================

-- Partial indexes for common queries
CREATE INDEX idx_scenarios_active ON tree_state.scenarios(tenant_id, status) 
WHERE status IN ('DRAFT', 'IN_PROGRESS');

CREATE INDEX idx_events_recent ON tree_events.events(scenario_id, event_timestamp DESC) 
WHERE event_timestamp > CURRENT_TIMESTAMP - INTERVAL '7 days';

-- BRIN index for time-series data
CREATE INDEX idx_events_timestamp_brin ON tree_events.events 
USING BRIN(event_timestamp);

-- GIN indexes for JSONB queries
CREATE INDEX idx_answers_json ON tree_state.answers USING GIN(value_json);
CREATE INDEX idx_tree_nodes_display ON tree_core.tree_nodes USING GIN(display_config);
CREATE INDEX idx_tree_nodes_behavior ON tree_core.tree_nodes USING GIN(behavior_config);

-- ============================================================
-- MULTI-TENANT SECURITY (ROW LEVEL SECURITY)
-- ============================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tree_core.trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tree_state.scenarios ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY tenant_isolation_trees ON tree_core.trees
    FOR ALL 
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_scenarios ON tree_state.scenarios
    FOR ALL 
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================
-- AUDIT AND COMPLIANCE
-- ============================================================

-- Audit log for all state changes
CREATE TABLE tree_events.audit_log (
    audit_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name         TEXT NOT NULL,
    operation          TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id          UUID NOT NULL,
    old_values         JSONB,
    new_values         JSONB,
    changed_by         UUID NOT NULL,
    changed_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address         INET,
    user_agent         TEXT
);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION tree_events.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tree_events.audit_log (
        table_name, operation, record_id,
        old_values, new_values, changed_by
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.scenario_id, OLD.scenario_id, NEW.tree_id, OLD.tree_id),
        to_jsonb(OLD),
        to_jsonb(NEW),
        current_setting('app.user_id')::uuid
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_scenarios 
AFTER INSERT OR UPDATE OR DELETE ON tree_state.scenarios
FOR EACH ROW EXECUTE FUNCTION tree_events.audit_trigger();

CREATE TRIGGER audit_answers
AFTER INSERT OR UPDATE OR DELETE ON tree_state.answers
FOR EACH ROW EXECUTE FUNCTION tree_events.audit_trigger();

-- ============================================================
-- INTEGRATION POINTS (STABLE INTERFACES)
-- ============================================================

-- Public API views (stable contracts)
CREATE OR REPLACE VIEW tree_core.v_active_trees AS
SELECT 
    t.tree_id,
    t.tenant_id,
    t.tree_name,
    t.tree_type,
    t.created_at,
    t.published_at,
    COUNT(DISTINCT tn.node_id) as node_count,
    COUNT(DISTINCT tn.question_id) as question_count
FROM tree_core.trees t
LEFT JOIN tree_core.tree_nodes tn ON t.tree_id = tn.tree_id
WHERE t.is_published = TRUE
  AND t.validation_status = 'VALID'
GROUP BY t.tree_id;

-- Scenario progress view
CREATE OR REPLACE VIEW tree_state.v_scenario_progress AS
SELECT 
    s.scenario_id,
    s.tenant_id,
    s.external_id,
    s.status,
    s.created_at,
    n.progress_percentage,
    n.current_stage_id,
    st.stage_code as current_stage,
    n.total_questions,
    n.answered_questions,
    array_length(n.completed_stages, 1) as completed_stages_count
FROM tree_state.scenarios s
JOIN tree_state.navigation n ON s.scenario_id = n.scenario_id
LEFT JOIN tree_core.stages st ON n.current_stage_id = st.stage_id;

-- ============================================================
-- INITIALIZATION DATA
-- ============================================================

-- Insert core stages for mortgage workflow
INSERT INTO tree_core.stages (stage_code, stage_category, base_order, is_required) VALUES
    ('BORROWER_IDENTITY', 'IDENTITY', 100, true),
    ('BORROWER_CREDIT', 'CREDIT', 200, true),
    ('PROPERTY_DETAILS', 'COLLATERAL', 300, true),
    ('LOAN_PURPOSE', 'PURPOSE', 400, true),
    ('LOAN_PRODUCT', 'PRODUCT', 500, true),
    ('REPAYMENT_CAPACITY', 'CAPACITY', 600, true),
    ('COMPLIANCE_CHECK', 'COMPLIANCE', 700, true);

-- ============================================================
-- LENDER MANAGEMENT TABLES
-- ============================================================

-- Lender registry
CREATE TABLE tree_core.lenders (
    lender_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lender_code        TEXT UNIQUE NOT NULL,
    lender_name        TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
        'PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'DELETED'
    )),
    -- Lifecycle
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activated_at       TIMESTAMPTZ,
    deactivated_at     TIMESTAMPTZ,
    deleted_at         TIMESTAMPTZ,
    deletion_reason    TEXT
);

-- Lender-specific question sets
CREATE TABLE tree_core.lender_question_sets (
    set_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lender_id          UUID NOT NULL REFERENCES tree_core.lenders(lender_id),
    set_name           TEXT NOT NULL,
    set_version        INT NOT NULL DEFAULT 1,
    -- Questions in this set
    question_ids       UUID[] NOT NULL DEFAULT '{}',
    -- Lifecycle
    status             TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
        'DRAFT', 'ACTIVE', 'DEPRECATED', 'ARCHIVED'
    )),
    valid_from         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to           TIMESTAMPTZ DEFAULT 'infinity',
    UNIQUE(lender_id, set_name, set_version)
);

-- Track question origin and dependencies
CREATE TABLE tree_core.question_dependencies (
    question_id        UUID REFERENCES tree_core.questions(question_id),
    depends_on_lender  UUID REFERENCES tree_core.lenders(lender_id),
    dependency_type    TEXT NOT NULL CHECK (dependency_type IN (
        'REQUIRED_BY',   -- Lender requires this question
        'CREATED_FOR',   -- Question created specifically for lender
        'MODIFIED_FOR'   -- Standard question modified for lender
    )),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (question_id, depends_on_lender)
);

-- Create trigger for lender deletion cascade
CREATE TRIGGER trg_lender_deletion_cascade
AFTER UPDATE ON tree_core.lenders
FOR EACH ROW 
WHEN (OLD.status != 'DELETED' AND NEW.status = 'DELETED')
EXECUTE FUNCTION tree_core.handle_lender_deletion();

-- ============================================================
-- QUESTION CLEANUP PROCEDURES
-- ============================================================

-- Cleanup orphaned questions
CREATE OR REPLACE PROCEDURE tree_core.cleanup_orphaned_questions(
    p_dry_run BOOLEAN DEFAULT TRUE
)
LANGUAGE plpgsql AS $$
DECLARE
    v_orphaned_count INT;
    v_deleted_count INT := 0;
BEGIN
    -- Find orphaned lender questions
    WITH orphaned AS (
        SELECT q.question_id, q.question_code, q.owner_id
        FROM tree_core.questions q
        WHERE q.question_scope = 'LENDER'
          AND q.status = 'ACTIVE'
          AND q.owner_id NOT IN (
              SELECT lender_id FROM tree_core.lenders WHERE status != 'DELETED'
          )
          AND q.active_scenario_count = 0
          AND q.last_used_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
    )
    SELECT COUNT(*) INTO v_orphaned_count FROM orphaned;
    
    IF NOT p_dry_run AND v_orphaned_count > 0 THEN
        UPDATE tree_core.questions q
        SET status = 'ARCHIVED',
            archived_at = CURRENT_TIMESTAMP,
            deletion_reason = 'Lender no longer active, question unused for 90+ days'
        FROM orphaned o
        WHERE q.question_id = o.question_id;
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    END IF;
    
    RAISE NOTICE 'Found % orphaned questions. Archived: %', 
        v_orphaned_count, v_deleted_count;
END;
$$;

-- Question usage analytics
CREATE OR REPLACE VIEW tree_core.v_question_usage AS
SELECT 
    q.question_id,
    q.question_code,
    q.question_scope,
    q.owner_type,
    CASE 
        WHEN q.owner_type = 'LENDER' THEN l.lender_name
        ELSE 'System'
    END as owner_name,
    q.status,
    q.created_at,
    q.last_used_at,
    q.usage_count,
    q.active_scenario_count,
    COUNT(DISTINCT a.scenario_id) as total_answers,
    COUNT(DISTINCT s.tenant_id) as tenants_using
FROM tree_core.questions q
LEFT JOIN tree_core.lenders l ON q.owner_id = l.lender_id
LEFT JOIN tree_state.answers a ON q.question_id = a.question_id
LEFT JOIN tree_state.scenarios s ON a.scenario_id = s.scenario_id
GROUP BY q.question_id, q.question_code, q.question_scope, 
         q.owner_type, l.lender_name, q.status, q.created_at, 
         q.last_used_at, q.usage_count, q.active_scenario_count;

COMMIT;

-- ============================================================
-- MAINTENANCE PROCEDURES (RUN PERIODICALLY)
-- ============================================================

-- Refresh materialized views
CREATE OR REPLACE PROCEDURE tree_state.refresh_materialized_views()
LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY tree_state.mv_node_visibility;
END;
$$;

-- Archive old events
CREATE OR REPLACE PROCEDURE tree_events.archive_old_events(
    p_days_to_keep INT DEFAULT 90
)
LANGUAGE plpgsql AS $$
DECLARE
    v_archived_count BIGINT;
BEGIN
    -- Move old events to archive table
    WITH archived AS (
        DELETE FROM tree_events.events
        WHERE event_timestamp < CURRENT_TIMESTAMP - (p_days_to_keep || ' days')::interval
        RETURNING *
    )
    INSERT INTO tree_events.events_archive
    SELECT * FROM archived;
    
    GET DIAGNOSTICS v_archived_count = ROW_COUNT;
    
    RAISE NOTICE 'Archived % events older than % days', v_archived_count, p_days_to_keep;
END;
$$;
