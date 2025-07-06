# 2. Use PostgreSQL as Primary Database

Date: 2024-01-25

## Status

Accepted

## Context

Mortgage Broker Pro 3.0 needs a robust, scalable database system that can handle:

- Complex relational data (lenders, programs, criteria, scenarios)
- JSON/JSONB data for flexible schema areas (fees, terms, conditions)
- Geospatial data for property locations and coverage areas
- Full-text search capabilities for documents and notes
- ACID compliance for financial data integrity
- Concurrent access from multiple services
- Future scalability to handle thousands of lenders and millions of scenarios

We evaluated several options:
- **PostgreSQL**: Mature, feature-rich, open-source RDBMS
- **MySQL**: Popular open-source database, less feature-rich
- **SQL Server**: Microsoft's enterprise database
- **MongoDB**: Document database, good for flexible schemas
- **DynamoDB**: AWS managed NoSQL database

## Decision

We will use PostgreSQL 15+ as our primary database for the following reasons:

1. **Advanced Features**: JSONB support, full-text search, PostGIS for geospatial, CTEs, window functions
2. **Data Integrity**: Strong ACID compliance, foreign keys, constraints, triggers
3. **Performance**: Excellent query optimizer, parallel queries, proper indexing strategies
4. **Flexibility**: Supports both relational and document-style (JSONB) data models
5. **Cost**: Open source with no licensing fees
6. **Cloud Ready**: First-class support on Azure (Azure Database for PostgreSQL)
7. **Ecosystem**: Extensive tooling, ORMs, migration tools, monitoring solutions

Specific PostgreSQL features we'll leverage:
- JSONB columns for flexible data (fees_json, terms_json, payload_snapshot)
- Generated columns for calculated fields (LTV calculations)
- Partial indexes for soft-deleted records
- Row-level security for multi-tenancy preparation
- Listen/Notify for real-time updates
- Foreign data wrappers for future integrations

## Consequences

### Positive

- Single database technology to maintain
- Rich feature set reduces need for additional services
- Strong consistency for financial data
- Excellent performance with proper indexing
- Easy local development with Docker
- Great Azure support for production

### Negative

- Requires PostgreSQL expertise on the team
- More complex than simple key-value stores
- Backup and restore more complex than managed services
- Need to manage indexes and query optimization

### Neutral

- Will use Azure Database for PostgreSQL in production
- Requires migration strategy from any existing systems
- Need to establish backup and disaster recovery procedures

## Implementation Notes

- Use PostgreSQL 15+ for latest features
- Enable UUID extension for primary keys
- Configure appropriate connection pooling
- Set up regular VACUUM and ANALYZE schedules
- Use schemas to organize related tables (core, workflow, audit, etc.)

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Azure Database for PostgreSQL](https://azure.microsoft.com/en-us/services/postgresql/)
- [PostgreSQL JSONB Performance](https://www.postgresql.org/docs/current/datatype-json.html)
