# Lender API Anchor 🔧

This is the **foundational anchor** for lender database creation in the EMC² Core service. It establishes the pattern for working with the enhanced schema architecture.

## What's Been Built

### ✅ **Manual Lender Creation** 
- `POST /api/v1/lenders` - Create lenders manually
- `GET /api/v1/lenders` - List existing lenders
- Full validation using enhanced E=mc² schema
- Proper error handling with constraint violations

### ✅ **Enhanced Schema Integration**
- Uses `core.Lenders` table from EMC2-v2.0-Enhanced schema
- Email/phone validation with custom domains
- Status enums and tier constraints
- Automatic timestamp management
- JSONB metadata support

### ✅ **Foundation Pattern**
- TypeScript with proper Fastify types
- Schema validation with @sinclair/typebox
- Database connection management
- Error handling with proper HTTP codes
- Test script for validation

## Quick Start

### 1. Install Dependencies
```bash
cd services/emc2-core
npm install
```

### 2. Set Up Database
```bash
# Run the enhanced schema migration
psql -h localhost -d mortgage_broker_pro -f ../../database/migrations/002-enhanced-lender-schema.sql
```

### 3. Start the Server
```bash
npm run dev
```

### 4. Test the API
```bash
node test-lender-api.js
```

## API Examples

### Create a Lender
```bash
curl -X POST http://localhost:3001/api/v1/lenders \
  -H "Content-Type: application/json" \
  -d '{
    "name": "First National Bank",
    "legal_name": "First National Bank Corporation",
    "tax_id": "12-3456789",
    "website_url": "https://firstnational.com",
    "contact_name": "John Doe",
    "contact_email": "john@firstnational.com",
    "contact_phone": "+1234567890",
    "profile_score": 85,
    "tier": "GOLD",
    "api_enabled": true,
    "metadata": {
      "specialties": ["DSCR", "Commercial"],
      "notes": "Focuses on Texas market"
    }
  }'
```

### List Lenders
```bash
curl http://localhost:3001/api/v1/lenders
```

## Schema Validation

The API automatically validates:
- **Email format**: `contact_email` must be valid email
- **Phone format**: `contact_phone` must be international format
- **URLs**: `website_url` and `logo_url` must be valid HTTP/HTTPS
- **Percentage**: `profile_score` must be 0-100
- **Tier**: Must be one of PLATINUM, GOLD, SILVER, BRONZE
- **Uniqueness**: Name and Tax ID must be unique

## Error Handling

- **400**: Validation errors (duplicate name, invalid format)
- **500**: Server errors (database connection, etc.)
- **201**: Success with lender_id returned

## Next Steps (NOT Built Yet)

This anchor establishes the foundation. Future features to build:

1. **Spreadsheet Upload** - Parse Excel/CSV files
2. **Column Mapping** - Use Universal import logic
3. **Bulk Operations** - Create multiple lenders at once
4. **Update/Delete** - Modify existing lenders
5. **Search/Filter** - Advanced lender queries
6. **Integration** - Connect to Athena matching engine

## Architecture Notes

### Uses Enhanced Schemas
- `core.Lenders` - Main lender table
- Custom domains for validation
- Proper foreign key relationships
- Audit trail support

### Follows EMC² Patterns
- Event-driven architecture ready
- Multi-tenant support (created_by field)
- Metadata flexibility with JSONB
- Proper logging and error handling

### Database Integration
- Connection pooling via `getDatabase()`
- Prepared statements for security
- Constraint violation handling
- Automatic timestamp updates

## Testing the Anchor

The `test-lender-api.js` script verifies:
- ✅ Lender creation works
- ✅ Duplicate rejection works
- ✅ List functionality works
- ✅ Schema validation works
- ✅ Error handling works

## Files Modified

- `src/routes/lenders.ts` - Main API routes
- `src/server.ts` - Route registration
- `database/migrations/002-enhanced-lender-schema.sql` - Schema setup
- `test-lender-api.js` - Test script

---

**This anchor proves the architecture works and establishes the pattern for building more features. It's the foundation, not the finished product.** 🎯