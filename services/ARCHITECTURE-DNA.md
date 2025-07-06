# Service Architecture DNA - Core Logic & Thought Process

## Fundamental Principle: Clean Separation of Concerns

Each service has ONE job and does it exceptionally well. No service knows about the internal workings of another.

## The Four Core Services & Their DNA

### 1. EMC² Core Service - The Orchestrator
**Core Purpose**: Workflow state management and coordination

**Thought Process**:
- I own the lifecycle of a loan scenario
- I publish events when state changes occur
- I coordinate but never compute
- I am the single source of truth for workflow state

**Core Logic**:
```
When scenario created:
  - Validate basic data
  - Store in database
  - Publish "ScenarioCreated" event
  - Return scenario ID

When status changes:
  - Validate transition is legal
  - Update database
  - Publish "StatusChanged" event
  - Record history
```

**What it does NOT do**:
- Calculate matches
- Transform data
- Analyze patterns
- Make decisions

### 2. Hermes Service - The Data Transformer
**Core Purpose**: Data ingestion, validation, and transformation

**Thought Process**:
- I receive raw data and make it pristine
- I understand all data formats
- I validate ruthlessly
- I publish clean, standardized data

**Core Logic**:
```
When data received:
  - Identify format
  - Apply transformation rules
  - Validate against schemas
  - Calculate quality score
  - Store clean data
  - Publish "DataReady" event
```

**What it does NOT do**:
- Make lending decisions
- Manage workflows
- Analyze outcomes
- Store business logic

### 3. Athena Service - The Decision Engine
**Core Purpose**: Matching and scoring logic

**Thought Process**:
- I match borrowers to lenders
- I score based on criteria
- I rank and recommend
- I explain my decisions

**Core Logic**:
```
When evaluation requested:
  - Load borrower profile
  - Load active lender programs
  - Apply matching rules
  - Calculate scores
  - Rank results
  - Return recommendations with explanations
```

**What it does NOT do**:
- Store loan states
- Transform data
- Learn from outcomes
- Manage workflows

### 4. Janus Service - The Learning Engine
**Core Purpose**: Pattern recognition and optimization

**Thought Process**:
- I observe everything
- I find patterns
- I suggest improvements
- I never act directly

**Core Logic**:
```
When events occur:
  - Store observation
  - Analyze patterns
  - Detect anomalies
  - Generate insights
  - Create recommendations
  - Publish findings
```

**What it does NOT do**:
- Change system behavior
- Make lending decisions
- Transform data
- Manage workflows

## Communication DNA - Event-Driven Architecture

### Core Events:
```
ScenarioCreated
  Publisher: EMC²
  Subscribers: Hermes, Janus

DataReady
  Publisher: Hermes
  Subscribers: EMC², Athena, Janus

EvaluationRequested
  Publisher: EMC²
  Subscribers: Athena

MatchesFound
  Publisher: Athena
  Subscribers: EMC², Janus

StatusChanged
  Publisher: EMC²
  Subscribers: Janus

InsightGenerated
  Publisher: Janus
  Subscribers: (Notification service, Admin UI)
```

### API Communication Pattern:
```
Synchronous (Request/Response):
  - GET /scenarios/{id} - Get current state
  - POST /evaluate - Request evaluation
  - GET /recommendations - Get matches

Asynchronous (Events):
  - All state changes
  - All completions
  - All insights
```

## Data Ownership DNA

### Clear Boundaries:
- **EMC²** owns: Scenarios, Workflow States, History
- **Hermes** owns: Import Jobs, Transformations, Quality Scores  
- **Athena** owns: Matching Rules, Scoring Models, Evaluation Results
- **Janus** owns: Observations, Patterns, Insights, Recommendations

### Database Access Rules:
1. Each service can ONLY write to its own tables
2. Each service can read from a defined set of "public" views
3. No service can call another service's stored procedures
4. All cross-service data access goes through APIs

## Error Handling DNA

### Principle: Fail Fast, Recover Gracefully
```
When error occurs:
  - Log with full context
  - Return clear error to caller
  - Publish error event if applicable
  - Never leave data in inconsistent state
  - Always provide actionable error messages
```

## Scalability DNA

### Horizontal Scaling by Design:
- **Stateless Services**: Any instance can handle any request
- **Database Connections**: Pooled and limited
- **Async Processing**: Heavy work goes to queues
- **Caching Strategy**: Read-heavy data cached aggressively

## The Anti-Patterns We're Avoiding

1. **No Service Calls Another Directly** (except through well-defined APIs)
2. **No Shared Database Transactions** across services
3. **No Synchronous Long-Running Operations**
4. **No Hidden Dependencies**
5. **No Business Logic in the Database**

## Debugging & Observability DNA

### Every Request Gets:
- Unique correlation ID
- Full audit trail
- Performance metrics
- Clear error messages

### Every Service Provides:
- Health endpoints
- Metrics endpoints
- Structured logging
- Distributed tracing

## Migration DNA - How We Move Forward

### Phase 1: Parallel Run
- New services shadow existing SQL logic
- Compare results
- Build confidence

### Phase 2: Gradual Cutover
- Route read traffic to services
- Keep writes in SQL
- Monitor carefully

### Phase 3: Full Migration
- Services own all logic
- SQL becomes pure storage
- Legacy code removed

## The End State

A system where:
- Each service is independently deployable
- Each service can be scaled based on its load
- Each service can be debugged in isolation
- Each service can be owned by a different team
- The database is just a database
