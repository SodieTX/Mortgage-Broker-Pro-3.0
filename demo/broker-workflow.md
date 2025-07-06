# Mortgage Broker Pro - Real Broker Workflow Demo

This demonstrates why our system passes the Pinocchio test - it solves REAL broker problems.

## Setup

1. Make sure the database is running and seeded:
```bash
# From the database/seeds directory
psql -U mortgage_user -d mortgage_broker_pro -f 00-states.sql
psql -U mortgage_user -d mortgage_broker_pro -f 01-sample-lenders.sql
```

2. Start the API:
```bash
cd services/emc2-core
npm run dev
```

## The Real Broker Workflow

### Scenario: Your client wants to buy a rental property in Texas

**Client Details:**
- Looking to buy in Dallas, TX
- Property price: $400,000
- Needs loan: $320,000 (80% LTV)
- Property type: Single Family Rental
- Has good credit (720 FICO)

### Step 1: Create the Scenario

```bash
curl -X POST http://localhost:3001/scenarios \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Smith - Dallas Rental Property",
    "description": "4-unit rental property in Dallas, looking for DSCR loan",
    "loanData": {
      "borrower": {
        "firstName": "John",
        "lastName": "Smith",
        "creditScore": 720
      },
      "property": {
        "address": "123 Main St",
        "city": "Dallas",
        "state": "TX",
        "propertyType": "Multi-Family",
        "purchasePrice": 400000
      },
      "loan": {
        "loanAmount": 320000,
        "loanPurpose": "purchase",
        "loanType": "DSCR"
      }
    }
  }'
```

### Step 2: Find Matching Lenders (THIS IS THE MAGIC!)

```bash
# Replace {scenario_id} with the ID from step 1
curl http://localhost:3001/scenarios/{scenario_id}/matches
```

**What you'll see:**
```json
{
  "scenarioId": "...",
  "criteria": {
    "state": "TX",
    "loanAmount": 320000,
    "propertyType": "Multi-Family"
  },
  "matches": [
    {
      "lenderId": "11111111-1111-1111-1111-111111111111",
      "lenderName": "Kiavi (formerly LendingHome)",
      "matchScore": 100,
      "matchReasons": [
        "Operates in TX",
        "Can handle loan amount of $320,000"
      ],
      "programs": [
        {
          "programId": "p1111111-1111-1111-1111-111111111111",
          "programName": "Kiavi Rental Loan",
          "productType": "DSCR",
          "minLoanAmount": 150000,
          "maxLoanAmount": 3000000
        }
      ]
    },
    {
      "lenderId": "22222222-2222-2222-2222-222222222222",
      "lenderName": "Lima One Capital",
      "matchScore": 100,
      "matchReasons": [
        "Operates in TX",
        "Can handle loan amount of $320,000"
      ],
      "programs": [
        {
          "programId": "p2222222-1111-1111-1111-111111111111",
          "programName": "Lima One Rental360",
          "productType": "DSCR",
          "minLoanAmount": 100000,
          "maxLoanAmount": 2000000
        }
      ]
    },
    {
      "lenderId": "55555555-5555-5555-5555-555555555555",
      "lenderName": "Truss Financial",
      "matchScore": 100,
      "matchReasons": [
        "Operates in TX",
        "Can handle loan amount of $320,000"
      ],
      "programs": [
        {
          "programId": "p5555555-1111-1111-1111-111111111111",
          "programName": "Truss DSCR Investor",
          "productType": "DSCR",
          "minLoanAmount": 75000,
          "maxLoanAmount": 1500000
        }
      ]
    }
  ],
  "summary": {
    "totalLenders": 3,
    "totalPrograms": 3,
    "byProductType": {
      "DSCR": 3
    }
  }
}
```

## Why This Passes the Pinocchio Test

1. **Real Lenders**: These are actual DSCR lenders that brokers work with daily
2. **Real Constraints**: Kiavi really doesn't lend in ND, SD, VT. Lima One really is limited to certain states.
3. **Real Value**: Instead of calculating DSCR (which Excel can do), we're showing which lenders can actually fund the deal
4. **Time Saved**: Instead of calling 20 lenders or checking 20 websites, the broker gets instant matches

## What's Missing (Next Steps)

1. **Contact Management**: Store lender contacts and track communications
2. **Offer Tracking**: When lenders respond with terms, track and compare
3. **Document Generation**: Create loan summaries to send to lenders
4. **Status Tracking**: Know which deals are with which lenders

But even without these features, **we're already saving brokers hours per deal** by instantly showing which lenders are viable options.

## Try Different Scenarios

### Small loan in Nevada ($90k)
Only Visio Plus and Truss will match (others have higher minimums)

### Large loan in New York ($5M)
Only Kiavi Bridge program can handle it

### Any loan in North Dakota
No matches! (Our lenders don't operate there)

This is the difference between a "calculator" and a "broker tool" - we're solving the actual matching problem brokers face every day.
