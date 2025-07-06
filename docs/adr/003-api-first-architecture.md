# 3. API-First Architecture

Date: 2024-01-25

## Status

Accepted

## Context

Mortgage Broker Pro 3.0 needs to support multiple client types and integration patterns:

- Web application (primary UI)
- Mobile applications (future)
- Third-party integrations (lender systems, CRMs)
- Internal service-to-service communication
- Reporting and analytics tools
- Potential white-label deployments

An API-first approach ensures that all functionality is accessible through well-defined interfaces, promoting:
- Separation of concerns
- Testability
- Flexibility in client implementations
- Clear contracts between services
- Future extensibility

## Decision

We will adopt an API-first architecture where:

1. **All business logic is exposed through RESTful APIs**
   - No direct database access from clients
   - Consistent authentication and authorization
   - Versioned endpoints for backward compatibility

2. **OpenAPI 3.0 specification defines all APIs**
   - Contract-first development
   - Auto-generated documentation
   - Client SDK generation
   - API testing tools integration

3. **Standard patterns across all endpoints**
   - Consistent error handling
   - Pagination for list endpoints
   - Filtering and sorting capabilities
   - HATEOAS where appropriate

4. **Security by design**
   - JWT-based authentication
   - Role-based access control (RBAC)
   - Rate limiting
   - API key management for integrations

## Consequences

### Positive

- Clear separation between frontend and backend
- Enables multiple client types without code duplication
- Easier to test APIs in isolation
- Third-party integrations are first-class citizens
- API documentation is always up-to-date
- Facilitates microservices migration if needed

### Negative

- Additional complexity compared to monolithic approach
- Potential performance overhead for internal calls
- Requires robust API versioning strategy
- More moving parts to monitor and maintain

### Neutral

- Need to maintain OpenAPI specifications
- Requires API gateway or reverse proxy setup
- Client applications need error handling for network issues

## Implementation Guidelines

1. **API Design Principles**
   - Use nouns for resources (e.g., `/lenders`, `/scenarios`)
   - HTTP verbs for actions (GET, POST, PUT, PATCH, DELETE)
   - Nested resources for relationships (e.g., `/scenarios/{id}/offers`)
   - Consistent naming conventions (snake_case for JSON)

2. **Response Format**
   ```json
   {
     "data": { /* resource data */ },
     "meta": { /* pagination, etc. */ },
     "links": { /* HATEOAS links */ }
   }
   ```

3. **Error Format**
   ```json
   {
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "Validation failed",
       "details": [
         {
           "field": "loan_amount",
           "message": "Must be greater than 0"
         }
       ]
     }
   }
   ```

4. **Versioning Strategy**
   - Version in URL path (e.g., `/api/v1/`)
   - Major versions only
   - Deprecation notices in headers
   - Minimum 6-month deprecation period

## References

- [RESTful API Design Best Practices](https://restfulapi.net/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [JSON API Specification](https://jsonapi.org/)
- [Microsoft API Design Guidelines](https://github.com/microsoft/api-guidelines)
