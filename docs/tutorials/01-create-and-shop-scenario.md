# Tutorial: Creating and Shopping a Loan Scenario

This tutorial walks you through the complete process of creating a loan scenario and shopping it to lenders using Mortgage Broker Pro 3.0.

## Prerequisites

- Active user account with BROKER or ANALYST role
- API access token
- Basic knowledge of DSCR loans

## Overview

The loan shopping process involves these steps:

1. Create or select a borrower
2. Add property information
3. Create a scenario
4. Answer qualifying questions
5. Find matching lenders
6. Shop to selected lenders
7. Review and present offers

## Step 1: Create a Borrower

First, we need to create or select a borrower entity.

### API Request

```bash
POST /api/v1/borrowers
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "display_name": "Sunshine Properties LLC",
  "entity_type": "LLC",
  "primary_email": "john@sunshineproperties.com",
  "primary_phone": "+1-555-0123",
  "credit_score": 720,
  "net_worth": 2500000,
  "liquidity": 500000,
  "notes": "Experienced investor, owns 5 rental properties"
}
```

### Response

```json
{
  "data": {
    "borrower_id": "b7a8f3e1-4d2c-4e8a-9f1b-2c3d4e5f6a7b",
    "display_name": "Sunshine Properties LLC",
    "entity_type": "LLC",
    "status": "ACTIVE",
    "created_at": "2024-01-25T10:00:00Z"
  }
}
```

Save the `borrower_id` for the next steps.

## Step 2: Add Property Information

Next, create a property record for the investment property.

### API Request

```bash
POST /api/v1/properties
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "address_line1": "1234 Investment Dr",
  "city": "Dallas",
  "state_code": "TX",
  "postal_code": "75201",
  "property_type": "SFR",
  "year_built": 2015,
  "square_feet": 2400,
  "units": 1,
  "purchase_price": 850000,
  "current_value": 850000,
  "monthly_rent": 4500,
  "occupancy_rate": 95
}
```

### Response

```json
{
  "data": {
    "property_id": "p9b8c7d6-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "address_line1": "1234 Investment Dr",
    "city": "Dallas",
    "state_code": "TX",
    "property_type": "SFR",
    "created_at": "2024-01-25T10:05:00Z"
  }
}
```

## Step 3: Create a Scenario

Now create a loan scenario linking the borrower and property.

### API Request

```bash
POST /api/v1/scenarios
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "borrower_ids": ["b7a8f3e1-4d2c-4e8a-9f1b-2c3d4e5f6a7b"],
  "property_ids": ["p9b8c7d6-5e4f-3a2b-1c0d-9e8f7a6b5c4d"],
  "notes": "DSCR purchase loan for investment property in Dallas"
}
```

### Response

```json
{
  "data": {
    "scenario_id": "s1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6",
    "status": "Draft",
    "confidence_score": 25.0,
    "created_at": "2024-01-25T10:10:00Z"
  }
}
```

## Step 4: Answer Qualifying Questions

Retrieve and answer the questions needed for lender matching.

### Get Questions

```bash
GET /api/v1/scenarios/s1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6/questions
Authorization: Bearer <your-token>
```

### Submit Answers

```bash
POST /api/v1/scenarios/s1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6/answers
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "answers": [
    {
      "question_id": "q-loan-amount",
      "answer_value": "595000"
    },
    {
      "question_id": "q-loan-purpose",
      "answer_value": "Purchase"
    },
    {
      "question_id": "q-property-value",
      "answer_value": "850000"
    },
    {
      "question_id": "q-monthly-rent",
      "answer_value": "4500"
    },
    {
      "question_id": "q-monthly-expenses",
      "answer_value": "1200"
    },
    {
      "question_id": "q-credit-score",
      "answer_value": "720"
    }
  ]
}
```

The system automatically calculates:
- LTV: 70% (595,000 / 850,000)
- DSCR: 1.27 ((4,500 - 1,200) / 2,600)
  - Where 2,600 is the estimated P&I payment

## Step 5: Find Matching Lenders

Run the matching engine to find eligible lenders.

### API Request

```bash
POST /api/v1/scenarios/s1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6/match
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "include_soft_matches": true
}
```

### Response

```json
{
  "data": {
    "matches": [
      {
        "lender_id": "11111111-1111-1111-1111-111111111111",
        "lender_name": "Kiavi",
        "match_score": 95.0,
        "matching_programs": [
          {
            "program_id": "p1111111-1111-1111-1111-111111111111",
            "program_name": "Kiavi Rental Loan",
            "match_type": "HARD",
            "unmet_criteria": []
          }
        ]
      },
      {
        "lender_id": "33333333-3333-3333-3333-333333333333",
        "lender_name": "Visio Lending",
        "match_score": 92.0,
        "matching_programs": [
          {
            "program_id": "p3333333-1111-1111-1111-111111111111",
            "program_name": "Visio Rental360",
            "match_type": "HARD",
            "unmet_criteria": []
          }
        ]
      },
      {
        "lender_id": "66666666-6666-6666-6666-666666666666",
        "lender_name": "CoreVest Finance",
        "match_score": 88.0,
        "matching_programs": [
          {
            "program_id": "p6666666-1111-1111-1111-111111111111",
            "program_name": "CoreVest Portfolio Express",
            "match_type": "SOFT",
            "unmet_criteria": ["min_loan_amount: requires 600k, have 595k"]
          }
        ]
      }
    ],
    "total_matches": 3,
    "confidence_score": 92.0
  }
}
```

## Step 6: Shop to Selected Lenders

Send the scenario to selected lenders for pricing.

### API Request

```bash
POST /api/v1/scenarios/s1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6/shop
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "lender_ids": [
    "11111111-1111-1111-1111-111111111111",
    "33333333-3333-3333-3333-333333333333",
    "66666666-6666-6666-6666-666666666666"
  ],
  "message": "Please provide your best pricing for this DSCR purchase in Dallas. Strong borrower with excellent credit and liquidity."
}
```

### Response

```json
{
  "data": {
    "round_id": 1,
    "lenders_contacted": 3,
    "estimated_response_time": "24-48 hours",
    "scenario_status": "Shopped"
  }
}
```

## Step 7: Review Offers

After lenders respond (typically 24-48 hours), retrieve and review offers.

### API Request

```bash
GET /api/v1/scenarios/s1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6/offers
Authorization: Bearer <your-token>
```

### Response

```json
{
  "data": {
    "offers": [
      {
        "offer_id": "o1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6",
        "lender_name": "Kiavi",
        "program_name": "Kiavi Rental Loan",
        "status": "FIRM",
        "rate": 7.125,
        "loan_amount": 595000,
        "ltv": 70.0,
        "total_fees": 13895,
        "fee_breakdown": {
          "origination": 5950,
          "processing": 1295,
          "underwriting": 995,
          "broker": 5655
        },
        "estimated_closing": "30 days",
        "received_at": "2024-01-26T14:30:00Z"
      },
      {
        "offer_id": "o2b3c4d5-e6f7-a8b9-c0d1-e2f3a4b5c6d7",
        "lender_name": "Visio Lending",
        "program_name": "Visio Rental360",
        "status": "FIRM",
        "rate": 7.375,
        "loan_amount": 595000,
        "ltv": 70.0,
        "total_fees": 15870,
        "fee_breakdown": {
          "origination": 8925,
          "processing": 995,
          "underwriting": 1000,
          "broker": 4950
        },
        "estimated_closing": "35 days",
        "received_at": "2024-01-26T16:45:00Z"
      }
    ]
  }
}
```

## Step 8: Generate Presentation

Create a professional presentation for the borrower.

### API Request

```bash
POST /api/v1/scenarios/s1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6/presentation
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "include_offers": ["o1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6", "o2b3c4d5-e6f7-a8b9-c0d1-e2f3a4b5c6d7"],
  "format": "PDF",
  "include_comparison": true
}
```

### Response

```json
{
  "data": {
    "presentation_id": "pr1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6",
    "download_url": "/api/v1/presentations/pr1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6/download",
    "expires_at": "2024-01-27T10:00:00Z"
  }
}
```

## Best Practices

1. **Complete Information**: The more complete the scenario, the better the matches and offers
2. **Accurate DSCR**: Ensure rent and expense estimates are realistic
3. **Multiple Lenders**: Shop to at least 3-5 lenders for competitive offers
4. **Timely Response**: Respond to lender questions quickly to maintain momentum
5. **Documentation**: Keep all communications within the platform for compliance

## Common Issues

### Low Match Score
- Check if all required questions are answered
- Verify property is in a state the lenders cover
- Consider adjusting loan amount or LTV

### No Offers Received
- Follow up with lenders after 48 hours
- Check if additional documentation is needed
- Consider expanding lender selection

### Offer Variations
- Rate differences often reflect lender risk assessment
- Fee structures vary by lender
- Some lenders may offer better terms for specific property types

## Next Steps

- Learn about [Managing Multiple Scenarios](./02-managing-multiple-scenarios.md)
- Explore [Advanced Matching Strategies](./03-advanced-matching.md)
- Review [Offer Negotiation Tips](./04-offer-negotiation.md)
