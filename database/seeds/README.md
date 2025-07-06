# Database Seeds

This directory contains seed data for development and testing environments. Seeds provide realistic demo data to help developers test features without manually creating records.

## Seed Files

### Core Seeds (Run in Order)

1. **00-states.sql**
   - US states reference data
   - Required for geographic coverage features
   - Safe to run multiple times (uses ON CONFLICT)

2. **01-sample-lenders.sql**
   - 5 real DSCR lenders with actual program types
   - Includes state coverage mappings
   - Sample programs with realistic criteria

3. **02-test-users.sql**
   - Test user accounts for different roles
   - Default password: `TestPass123!`
   - Includes teams and API keys

4. **03-loan-scenarios.sql**
   - 7 realistic loan scenarios in various stages
   - Includes borrowers, properties, and offers
   - Demonstrates complete workflow

5. **04-expanded-lender-programs.sql**
   - Additional lenders for testing variety
   - More diverse program types (Bridge, Fix & Flip, Portfolio)
   - Complex criteria including metros and special conditions

## Data Generation Script

**generate-test-data.ps1** - PowerShell script to generate random test data

```powershell
# Generate 100 random borrowers, properties, and scenarios
.\generate-test-data.ps1 -Count 100 -OutputFile large-dataset.sql

# Generate only properties
.\generate-test-data.ps1 -Count 50 -IncludeBorrowers:$false -IncludeScenarios:$false
```

## Running Seeds

### Local Development

```bash
# Run all seeds in order
psql -U postgres -d mortgagebroker < 00-states.sql
psql -U postgres -d mortgagebroker < 01-sample-lenders.sql
psql -U postgres -d mortgagebroker < 02-test-users.sql
psql -U postgres -d mortgagebroker < 03-loan-scenarios.sql
psql -U postgres -d mortgagebroker < 04-expanded-lender-programs.sql

# Or use a script to run all
for file in *.sql; do
  psql -U postgres -d mortgagebroker < "$file"
done
```

### Docker Environment

```bash
# Copy seeds into container and run
docker cp ./database/seeds postgres_container:/seeds
docker exec -it postgres_container bash -c "cd /seeds && for file in *.sql; do psql -U postgres -d mortgagebroker < \$file; done"
```

### Azure Database

```bash
# Use Azure CLI or psql with connection string
psql "host=myserver.postgres.database.azure.com port=5432 dbname=mortgagebroker user=myuser@myserver password=mypassword sslmode=require" < 00-states.sql
```

## Test Accounts

After running `02-test-users.sql`, these accounts are available:

| Role | Email | Username | Description |
|------|-------|----------|-------------|
| Admin | admin@mortgagebroker.test | admin | Full system access |
| Senior Broker | john.broker@mortgagebroker.test | johnbroker | 10+ years experience |
| Mid Broker | sarah.dealmaker@mortgagebroker.test | sarahdeal | DSCR specialist |
| Junior Broker | mike.newbie@mortgagebroker.test | mikenew | New broker |
| Analyst | alice.analyst@mortgagebroker.test | aliceanalyst | Senior analyst |
| Viewer | viewer@mortgagebroker.test | viewer | Read-only access |

## Sample Data Highlights

### Lenders
- **Kiavi**: Nationwide DSCR lender, fast closings
- **Lima One**: Limited states, good for fix & flip
- **Visio Lending**: True nationwide, DSCR specialist
- **CoreVest**: Portfolio loans specialist
- **ABL**: No credit DSCR options

### Scenarios
- Standard DSCR purchase in Texas (95% confidence)
- High-value California rental
- Bridge to DSCR refinance
- Portfolio deal with multiple properties
- Commercial property DSCR (completed/won)
- Problem property (lost deal example)

### Program Variations
- Standard DSCR: 1.20+ DSCR, 680+ FICO
- Portfolio programs: 5+ properties minimum
- Bridge loans: 12-24 month terms
- No-credit DSCR: Asset-based only
- Fix & Flip: Higher LTC, shorter terms

## Customization

To add your own test data:

1. Follow the UUID pattern for consistency
2. Use `ON CONFLICT DO NOTHING` for idempotent seeds
3. Reference existing IDs from earlier seeds
4. Include realistic values for testing edge cases
5. Document any special test scenarios

## Cleanup

To reset the database:

```sql
-- Be careful! This removes all data
TRUNCATE TABLE scenarios CASCADE;
TRUNCATE TABLE borrower CASCADE;
TRUNCATE TABLE property CASCADE;
TRUNCATE TABLE lenders CASCADE;
-- etc...
```

## Best Practices

1. **Idempotency**: All seeds should be safe to run multiple times
2. **Order Matters**: Run seeds in numerical order due to foreign keys
3. **Realistic Data**: Use actual lender names and realistic criteria
4. **Test Coverage**: Include edge cases and various statuses
5. **Documentation**: Comment complex test scenarios in the SQL

## Production Warning

⚠️ **NEVER run these seeds in production!** They contain:
- Test user accounts with known passwords
- Sample data that could conflict with real data
- Hard-coded UUIDs that might collide
- Development-only API keys

For production, use proper data migration tools and secure account creation processes.
