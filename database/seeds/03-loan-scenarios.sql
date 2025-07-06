-- Realistic Loan Scenarios
-- This file creates demo loan scenarios representing common DSCR and investment property deals

-- First, let's create some borrowers
INSERT INTO borrower (borrower_id, display_name, entity_type, country_code, created_by) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Lone Star Holdings LLC', 'LLC', 'US', 'b0000000-0000-0000-0000-000000000001'),
  ('b2222222-2222-2222-2222-222222222222', 'Bay Area Investments Trust', 'Trust', 'US', 'b0000000-0000-0000-0000-000000000001'),
  ('b3333333-3333-3333-3333-333333333333', 'John and Jane Smith', 'Individual', 'US', 'b0000000-0000-0000-0000-000000000002'),
  ('b4444444-4444-4444-4444-444444444444', 'Phoenix Real Estate Partners', 'Corporation', 'US', 'b0000000-0000-0000-0000-000000000002'),
  ('b5555555-5555-5555-5555-555555555555', 'Miami Beach Ventures LLC', 'LLC', 'US', 'b0000000-0000-0000-0000-000000000003')
ON CONFLICT (borrower_id) DO NOTHING;

-- Create some sample properties
INSERT INTO property (property_id, address_line1, city, state_code, postal_code, property_type, created_by) VALUES
  ('p1111111-1111-1111-1111-111111111111', '123 Main St', 'Dallas', 'TX', '75201', 'SFR', 'b0000000-0000-0000-0000-000000000001'),
  ('p2222222-2222-2222-2222-222222222222', '456 Oak Ave', 'Austin', 'TX', '78701', 'SFR', 'b0000000-0000-0000-0000-000000000001'),
  ('p3333333-3333-3333-3333-333333333333', '789 Pine St, Units 1-4', 'San Francisco', 'CA', '94103', 'MF', 'b0000000-0000-0000-0000-000000000001'),
  ('p4444444-4444-4444-4444-444444444444', '321 Desert Rd', 'Phoenix', 'AZ', '85001', 'SFR', 'b0000000-0000-0000-0000-000000000002'),
  ('p5555555-5555-5555-5555-555555555555', '555 Beach Blvd', 'Miami', 'FL', '33139', 'SFR', 'b0000000-0000-0000-0000-000000000003'),
  ('p6666666-6666-6666-6666-666666666666', '100 Commerce Center', 'Houston', 'TX', '77002', 'Office', 'b0000000-0000-0000-0000-000000000002'),
  ('p7777777-7777-7777-7777-777777777777', '200 Retail Plaza', 'Las Vegas', 'NV', '89101', 'Retail', 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT (property_id) DO NOTHING;

-- Create realistic loan scenarios
INSERT INTO scenarios (scenario_id, status, created_by, confidence_score, notes) VALUES
  -- Scenario 1: Standard DSCR Purchase in Texas
  ('s1111111-1111-1111-1111-111111111111', 'Offers_In', 'b0000000-0000-0000-0000-000000000001', 95.0, 
   'Strong DSCR purchase, experienced investor, clean deal'),
  
  -- Scenario 2: High-Value California Rental
  ('s2222222-2222-2222-2222-222222222222', 'Shopped', 'b0000000-0000-0000-0000-000000000001', 88.0,
   'High-value property, good DSCR but in expensive market'),
  
  -- Scenario 3: Bridge to DSCR Refinance
  ('s3333333-3333-3333-3333-333333333333', 'Matching', 'b0000000-0000-0000-0000-000000000002', 75.0,
   'Currently in bridge loan, looking to refinance to DSCR'),
  
  -- Scenario 4: Portfolio Deal - Multiple Properties
  ('s4444444-4444-4444-4444-444444444444', 'Presented', 'b0000000-0000-0000-0000-000000000002', 92.0,
   'Portfolio of 3 properties, cross-collateralized'),
  
  -- Scenario 5: New Investor First Purchase
  ('s5555555-5555-5555-5555-555555555555', 'Draft', 'b0000000-0000-0000-0000-000000000003', 60.0,
   'First-time investor, needs hand-holding'),
  
  -- Scenario 6: Commercial Property DSCR
  ('s6666666-6666-6666-6666-666666666666', 'Won', 'b0000000-0000-0000-0000-000000000002', 98.0,
   'Office building with strong tenant, closed last month'),
  
  -- Scenario 7: Problem Property Turnaround
  ('s7777777-7777-7777-7777-777777777777', 'Lost', 'b0000000-0000-0000-0000-000000000001', 45.0,
   'Property needed too much work, couldn''t get financing')
ON CONFLICT (scenario_id) DO NOTHING;

-- Link scenarios to borrowers
INSERT INTO scenarioborrower (scenario_id, borrower_id, role) VALUES
  ('s1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Borrower'),
  ('s2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'Borrower'),
  ('s3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333', 'Borrower'),
  ('s4444444-4444-4444-4444-444444444444', 'b4444444-4444-4444-4444-444444444444', 'Borrower'),
  ('s5555555-5555-5555-5555-555555555555', 'b5555555-5555-5555-5555-555555555555', 'Borrower'),
  ('s6666666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111', 'Borrower'),
  ('s7777777-7777-7777-7777-777777777777', 'b3333333-3333-3333-3333-333333333333', 'Borrower')
ON CONFLICT (scenario_id, borrower_id) DO NOTHING;

-- Link scenarios to properties
INSERT INTO scenarioproperty (scenario_id, property_id) VALUES
  ('s1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111'),
  ('s2222222-2222-2222-2222-222222222222', 'p3333333-3333-3333-3333-333333333333'),
  ('s3333333-3333-3333-3333-333333333333', 'p2222222-2222-2222-2222-222222222222'),
  ('s4444444-4444-4444-4444-444444444444', 'p4444444-4444-4444-4444-444444444444'),
  ('s4444444-4444-4444-4444-444444444444', 'p5555555-5555-5555-5555-555555555555'),
  ('s4444444-4444-4444-4444-444444444444', 'p1111111-1111-1111-1111-111111111111'),
  ('s5555555-5555-5555-5555-555555555555', 'p5555555-5555-5555-5555-555555555555'),
  ('s6666666-6666-6666-6666-666666666666', 'p6666666-6666-6666-6666-666666666666'),
  ('s7777777-7777-7777-7777-777777777777', 'p7777777-7777-7777-7777-777777777777')
ON CONFLICT (scenario_id, property_id) DO NOTHING;

-- Create shopping rounds for active scenarios
INSERT INTO scenarioround (scenario_id, round_id, started_at, ended_at, created_by) VALUES
  ('s1111111-1111-1111-1111-111111111111', 1, '2024-01-15 10:00:00', '2024-01-18 17:00:00', 'b0000000-0000-0000-0000-000000000001'),
  ('s2222222-2222-2222-2222-222222222222', 1, '2024-01-20 09:00:00', NULL, 'b0000000-0000-0000-0000-000000000001'),
  ('s4444444-4444-4444-4444-444444444444', 1, '2024-01-10 14:00:00', '2024-01-12 16:00:00', 'b0000000-0000-0000-0000-000000000002'),
  ('s4444444-4444-4444-4444-444444444444', 2, '2024-01-13 10:00:00', '2024-01-15 15:00:00', 'b0000000-0000-0000-0000-000000000002'),
  ('s6666666-6666-6666-6666-666666666666', 1, '2023-12-01 11:00:00', '2023-12-05 16:00:00', 'b0000000-0000-0000-0000-000000000002'),
  ('s7777777-7777-7777-7777-777777777777', 1, '2023-11-15 13:00:00', '2023-11-20 17:00:00', 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT (scenario_id, round_id) DO NOTHING;

-- Create sample offers for scenarios
INSERT INTO offers (offer_id, scenario_id, round_id, lender_id, program_id, program_version, 
                   rate, loan_amount, ltv, fees_json, status, created_by) VALUES
  -- Offers for Scenario 1 (Texas DSCR)
  ('o1111111-1111-1111-1111-111111111111', 's1111111-1111-1111-1111-111111111111', 1, 
   '11111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 1,
   7.125, 420000, 70.0, '{"origination": 4200, "processing": 1295, "broker": 8400}', 
   'Firm', 'b0000000-0000-0000-0000-000000000001'),
   
  ('o1111111-2222-2222-2222-222222222222', 's1111111-1111-1111-1111-111111111111', 1,
   '33333333-3333-3333-3333-333333333333', 'p3333333-1111-1111-1111-111111111111', 1,
   7.375, 420000, 70.0, '{"origination": 6300, "processing": 995, "broker": 8400}',
   'Firm', 'b0000000-0000-0000-0000-000000000001'),
   
  -- Offers for Scenario 2 (California)
  ('o2222222-1111-1111-1111-111111111111', 's2222222-2222-2222-2222-222222222222', 1,
   '11111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 1,
   7.625, 1500000, 65.0, '{"origination": 15000, "processing": 1795, "broker": 30000}',
   'Indicative', 'b0000000-0000-0000-0000-000000000001'),
   
  -- Offers for Scenario 4 (Portfolio)
  ('o4444444-1111-1111-1111-111111111111', 's4444444-4444-4444-4444-444444444444', 2,
   '44444444-4444-4444-4444-444444444444', 'p4444444-1111-1111-1111-111111111111', 1,
   7.875, 2100000, 70.0, '{"origination": 31500, "processing": 2495, "broker": 42000}',
   'Soft', 'b0000000-0000-0000-0000-000000000002'),
   
  -- Winning offer for Scenario 6 (Commercial)
  ('o6666666-1111-1111-1111-111111111111', 's6666666-6666-6666-6666-666666666666', 1,
   '11111111-1111-1111-1111-111111111111', 'p1111111-2222-2222-2222-222222222222', 1,
   6.750, 3500000, 65.0, '{"origination": 35000, "processing": 3995, "broker": 70000}',
   'Firm', 'b0000000-0000-0000-0000-000000000002')
   
ON CONFLICT (offer_id) DO NOTHING;

-- Create scenario status history
INSERT INTO scenariostatuslog (log_id, scenario_id, old_status, new_status, changed_by, notes) VALUES
  (gen_random_uuid(), 's1111111-1111-1111-1111-111111111111', 'Draft', 'Matching', 'b0000000-0000-0000-0000-000000000001', 'Initial submission complete'),
  (gen_random_uuid(), 's1111111-1111-1111-1111-111111111111', 'Matching', 'Shopped', 'b0000000-0000-0000-0000-000000000001', 'Sent to 5 lenders'),
  (gen_random_uuid(), 's1111111-1111-1111-1111-111111111111', 'Shopped', 'Offers_In', 'b0000000-0000-0000-0000-000000000001', 'Received 2 offers'),
  (gen_random_uuid(), 's6666666-6666-6666-6666-666666666666', 'Offers_In', 'Presented', 'b0000000-0000-0000-0000-000000000002', 'Presented to borrower'),
  (gen_random_uuid(), 's6666666-6666-6666-6666-666666666666', 'Presented', 'Won', 'b0000000-0000-0000-0000-000000000002', 'Borrower accepted Kiavi offer'),
  (gen_random_uuid(), 's7777777-7777-7777-7777-777777777777', 'Shopped', 'Lost', 'b0000000-0000-0000-0000-000000000001', 'Property condition issues')
ON CONFLICT (log_id) DO NOTHING;

-- Add sample answers for scenarios (just a few key ones)
INSERT INTO scenarioanswers (scenario_id, question_id, answer_value, created_by) 
SELECT 
  's1111111-1111-1111-1111-111111111111',
  question_id,
  CASE 
    WHEN base_text LIKE '%loan amount%' THEN '600000'
    WHEN base_text LIKE '%property value%' THEN '857000'
    WHEN base_text LIKE '%property type%' THEN 'Single Family Rental'
    WHEN base_text LIKE '%DSCR%' THEN '1.35'
    WHEN base_text LIKE '%credit score%' THEN '740'
    ELSE NULL
  END,
  'b0000000-0000-0000-0000-000000000001'
FROM questions 
WHERE base_text LIKE '%loan amount%' 
   OR base_text LIKE '%property value%'
   OR base_text LIKE '%property type%'
   OR base_text LIKE '%DSCR%'
   OR base_text LIKE '%credit score%'
ON CONFLICT (scenario_id, question_id) DO NOTHING;
