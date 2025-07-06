# Scenario Tree Core Logic - Architecture Decision Record

## Overview
This document captures the **immutable architectural decisions** made for the Scenario Tree Core Logic v3.0. These decisions form the foundation that all future development must build upon.

## Critical Design Decisions (Cannot Change Later)

### 1. Immutable Question/Attribute IDs
**Decision**: Questions and attributes are append-only with UUID primary keys that never change.

**Rationale**:
- Answers reference questions by ID, not by name or path
- Allows questions to be moved/renamed without breaking historical data
- Enables proper audit trails and data lineage
- Supports multi-version scenarios (same question across different tree versions)

**Enforcement**:
```sql
-- Questions can be deprecated but never deleted
-- Trigger prevents modification once used in any tree
CREATE TRIGGER trg_prevent_question_modification
BEFORE UPDATE ON tree_core.questions
```

### 2. Event-Sourced State Management
**Decision**: All state changes are recorded as immutable events; current state is a projection.

**Rationale**:
- Complete audit trail by design
- Natural support for undo/redo
- Enables time-travel debugging
- Supports compliance requirements (SOX, GDPR)
- Allows replay for testing and migration

**Key Tables**:
- `tree_events.events` - Immutable event log
- `tree_state.answers` - Current state projection
- `tree_state.answer_history` - Temporal history

### 3. Bitemporal Data Model
**Decision**: Track both system time (when recorded) and valid time (when true in real world).

**Rationale**:
- Required for financial compliance
- Supports backdated corrections
- Enables "as-of" queries
- Critical for audit and regulatory reporting

**Implementation**:
```sql
-- Questions track when they're valid
valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
valid_to TIMESTAMPTZ DEFAULT 'infinity',
system_period tstzrange GENERATED ALWAYS AS (tstzrange(valid_from, valid_to)) STORED
```

### 4. Multi-Tenant from Day One
**Decision**: Every table includes `tenant_id` with Row Level Security enabled.

**Rationale**:
- Cannot retrofit multi-tenancy later without massive migration
- Enables SaaS deployment model
- Supports enterprise isolation requirements
- Allows per-tenant customization

**Security**:
```sql
-- RLS policies enforce tenant isolation
CREATE POLICY tenant_isolation_trees ON tree_core.trees
    FOR ALL 
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### 5. Content-Addressed Storage (Git-Style)
**Decision**: Trees and nodes are identified by content hash, not just ID.

**Rationale**:
- Enables deduplication
- Natural versioning and branching
- Immutable by design
- Supports diff/merge operations
- Efficient storage of similar trees

**Implementation**:
```sql
tree_hash TEXT UNIQUE NOT NULL, -- SHA-256 of tree content
node_hash TEXT NOT NULL, -- SHA-256 of node content
```

### 6. Position-Based Tree Structure
**Decision**: Nodes use decimal positioning with adjacency list, not paths.

**Rationale**:
- Allows infinite insertions between nodes
- Supports drag-and-drop reordering
- No cascading updates when moving nodes
- Works with any tree depth

**Key Field**:
```sql
sibling_order DECIMAL(20,10) NOT NULL, -- Allows infinite insertions
```

### 7. Declarative Conditional Logic
**Decision**: Conditions are data, not code, with content-addressed storage.

**Rationale**:
- Business users can understand/modify
- Reusable across trees
- Versionable and auditable
- Can be validated statically
- Supports visual rule builders

**Structure**:
- Simple conditions (IF field = value)
- Compound conditions (AND/OR/NOT combinations)
- Computed conditions (expressions)
- External conditions (API calls)

## Integration Architecture

### 1. Integration with Athena Evaluation Engine
```sql
-- Bridge table to connect tree nodes with evaluation models
CREATE TABLE workflow.TreeNodeEvaluations (
    node_id UUID REFERENCES tree_core.tree_nodes(node_id),
    evaluation_model_id UUID REFERENCES core.EvaluationModels(model_id),
    evaluation_priority INT DEFAULT 100
);

-- Athena reads answers through stable view
CREATE VIEW athena.v_scenario_answers AS
SELECT 
    s.scenario_id,
    s.external_id,
    q.question_code,
    COALESCE(
        a.value_text::text,
        a.value_number::text,
        a.value_boolean::text,
        a.value_date::text,
        a.value_json::text
    ) as answer_value,
    q.data_type
FROM tree_state.scenarios s
JOIN tree_state.answers a ON s.scenario_id = a.scenario_id
JOIN tree_core.questions q ON a.question_id = q.question_id;
```

### 2. Integration with EMC² Schema
```sql
-- Questions map to EMC² attributes
ALTER TABLE tree_core.questions 
ADD COLUMN emc2_attribute_id UUID REFERENCES core.AttributeDefinitions(Attribute_ID);

-- Scenarios link to EMC² workflows
ALTER TABLE tree_state.scenarios
ADD COLUMN emc2_scenario_id UUID REFERENCES workflow.Scenarios(Scenario_ID);
```

### 3. Integration with Import System (Hermes)
```sql
-- Import events feed into scenario events
CREATE TABLE import.ImportToScenarioMapping (
    import_job_id UUID REFERENCES import.Jobs(job_id),
    scenario_id UUID REFERENCES tree_state.scenarios(scenario_id),
    field_mappings JSONB NOT NULL,
    import_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to create events from imports
CREATE TRIGGER trg_import_to_events
AFTER INSERT ON import.ImportedData
FOR EACH ROW EXECUTE FUNCTION tree_events.create_import_event();
```

## Performance Guarantees

### 1. Sub-100ms Response Times
- Materialized views for complex queries
- Strategic indexes on all foreign keys
- BRIN indexes for time-series data
- Partial indexes for common filters

### 2. Horizontal Scalability
- Event sourcing enables read replicas
- Tenant isolation allows sharding
- Stateless evaluation functions
- Content-addressed storage enables CDN caching

### 3. Zero Downtime Updates
- All changes are additive (new versions)
- Old versions remain accessible
- Gradual migration via event replay
- Blue-green deployments supported

## Data Consistency Guarantees

### 1. ACID Compliance
- PostgreSQL transactional guarantees
- Foreign key constraints
- Check constraints on all enums
- Unique constraints prevent duplicates

### 2. Event Ordering
- Events have scenario-scoped versions
- Idempotency keys prevent duplicates
- Correlation IDs track causation
- Timestamps for global ordering

### 3. Eventual Consistency
- Materialized views refresh async
- Event projections are idempotent
- State can be rebuilt from events
- Cache invalidation is explicit

## Extension Points (Can Add Later)

### 1. Custom Validators
```sql
-- Extensible validation framework
CREATE TABLE tree_core.custom_validators (
    validator_id UUID PRIMARY KEY,
    validator_name TEXT NOT NULL,
    validator_function TEXT NOT NULL,
    input_schema JSONB NOT NULL
);
```

### 2. Computed Fields
```sql
-- Questions can be computed from others
ALTER TABLE tree_core.questions
ADD COLUMN computation_expression TEXT,
ADD COLUMN depends_on_questions UUID[];
```

### 3. External Data Sources
```sql
-- Questions can fetch from APIs
CREATE TABLE tree_core.external_sources (
    source_id UUID PRIMARY KEY,
    source_type TEXT NOT NULL,
    connection_config JSONB NOT NULL,
    refresh_strategy TEXT NOT NULL
);
```

### 4. Machine Learning Integration
```sql
-- ML predictions as answers
CREATE TABLE ml.PredictionResults (
    scenario_id UUID REFERENCES tree_state.scenarios(scenario_id),
    question_id UUID REFERENCES tree_core.questions(question_id),
    predicted_value JSONB NOT NULL,
    confidence_score DECIMAL(3,2),
    model_version TEXT NOT NULL
);
```

## Migration Strategy

### From Existing Systems
1. Create questions for all existing fields
2. Build tree structure matching current flow
3. Import historical data as events
4. Validate state projections match
5. Switch over with feature flags

### Future Schema Changes
1. New fields are new questions (additive)
2. Deprecated questions get valid_to timestamp
3. Tree changes create new versions
4. Events enable backward compatibility

## Testing Strategy

### 1. Property-Based Testing
- Events always increase version
- State projection is deterministic
- Conditions are pure functions
- Tree traversal is cycle-free

### 2. Scenario Testing
```sql
-- Test scenarios in isolated tenants
CREATE SCHEMA test_tenant_001;
-- Run full scenarios
-- Validate against expected outcomes
-- Clean up after tests
```

### 3. Performance Testing
- Generate 1M+ events
- Measure query response times
- Validate materialized view refresh
- Test concurrent updates

## Monitoring and Observability

### 1. Key Metrics
```sql
-- Performance metrics view
CREATE VIEW monitoring.v_tree_metrics AS
SELECT 
    COUNT(DISTINCT scenario_id) as active_scenarios,
    COUNT(*) as total_events,
    AVG(duration_ms) as avg_event_duration,
    MAX(event_timestamp) as last_activity
FROM tree_events.events
WHERE event_timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour';
```

### 2. Health Checks
- Materialized view staleness
- Event processing lag
- Cache hit rates
- Tenant isolation violations

### 3. Audit Trail
- All changes logged with actor
- IP addresses captured
- Correlation IDs for tracing
- Exportable for compliance

## Security Considerations

### 1. Data Protection
- PII fields marked in questions
- Encryption at rest via PostgreSQL
- TLS for data in transit
- Field-level encryption available

### 2. Access Control
- Row Level Security per tenant
- Function security definer/invoker
- Prepared statements prevent SQL injection
- Rate limiting at API layer

### 3. Compliance
- GDPR right-to-forget via events
- SOX compliance via immutable audit
- HIPAA compliance via encryption
- PCI compliance via tokenization

## Conclusion

This architecture provides a rock-solid foundation that:
- **Won't need breaking changes** as the system grows
- **Supports all current and anticipated use cases**
- **Maintains performance at scale**
- **Enables compliance and audit requirements**
- **Allows extension without modification**

The key insight is that by making data structures immutable and state changes explicit through events, we create a system that is both flexible for business needs and robust for technical requirements. This is the foundation you can build your mortgage decision engine on with confidence.
