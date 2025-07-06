-- Expanded Lender Programs
-- This file adds more varied lender programs to test different scenarios

-- Add more diverse lenders
INSERT INTO lenders (lender_id, name, website_url, contact_name, contact_email, active, profile_score, created_by, notes) VALUES
  ('66666666-6666-6666-6666-666666666666', 'CoreVest Finance', 'https://corevestfinance.com', 'David Miller', 'contact@corevest.com', true, 93.0, '00000000-0000-0000-0000-000000000000', 'Portfolio loans specialist'),
  ('77777777-7777-7777-7777-777777777777', 'RCN Capital', 'https://rcncapital.com', 'Emily Chen', 'contact@rcncapital.com', true, 87.0, '00000000-0000-0000-0000-000000000000', 'Fix and flip focus, some DSCR'),
  ('88888888-8888-8888-8888-888888888888', 'Civic Financial', 'https://civicfs.com', 'Frank Rodriguez', 'contact@civicfs.com', true, 89.0, '00000000-0000-0000-0000-000000000000', 'West coast focused'),
  ('99999999-9999-9999-9999-999999999999', 'Asset Based Lending', 'https://ablending.com', 'Grace Kim', 'contact@ablending.com', true, 82.0, '00000000-0000-0000-0000-000000000000', 'True asset-based, no credit DSCR')
ON CONFLICT (lender_id) DO NOTHING;

-- CoreVest - true nationwide
INSERT INTO lenderstates (lender_id, state_code) 
SELECT '66666666-6666-6666-6666-666666666666', state_code 
FROM states;

-- RCN Capital - East coast focus
INSERT INTO lenderstates (lender_id, state_code) VALUES
  ('77777777-7777-7777-7777-777777777777', 'CT'),
  ('77777777-7777-7777-7777-777777777777', 'NY'),
  ('77777777-7777-7777-7777-777777777777', 'NJ'),
  ('77777777-7777-7777-7777-777777777777', 'MA'),
  ('77777777-7777-7777-7777-777777777777', 'PA'),
  ('77777777-7777-7777-7777-777777777777', 'FL'),
  ('77777777-7777-7777-7777-777777777777', 'MD'),
  ('77777777-7777-7777-7777-777777777777', 'VA'),
  ('77777777-7777-7777-7777-777777777777', 'NC'),
  ('77777777-7777-7777-7777-777777777777', 'SC'),
  ('77777777-7777-7777-7777-777777777777', 'GA');

-- Civic - West coast
INSERT INTO lenderstates (lender_id, state_code) VALUES
  ('88888888-8888-8888-8888-888888888888', 'CA'),
  ('88888888-8888-8888-8888-888888888888', 'OR'),
  ('88888888-8888-8888-8888-888888888888', 'WA'),
  ('88888888-8888-8888-8888-888888888888', 'AZ'),
  ('88888888-8888-8888-8888-888888888888', 'NV'),
  ('88888888-8888-8888-8888-888888888888', 'UT'),
  ('88888888-8888-8888-8888-888888888888', 'CO');

-- ABL - Select markets
INSERT INTO lenderstates (lender_id, state_code) VALUES
  ('99999999-9999-9999-9999-999999999999', 'TX'),
  ('99999999-9999-9999-9999-999999999999', 'FL'),
  ('99999999-9999-9999-9999-999999999999', 'GA'),
  ('99999999-9999-9999-9999-999999999999', 'TN'),
  ('99999999-9999-9999-9999-999999999999', 'OH');

-- Add varied programs
INSERT INTO programs (program_id, program_version, lender_id, product_type, name, active, created_by) VALUES
  -- CoreVest Programs
  ('p6666666-1111-1111-1111-111111111111', 1, '66666666-6666-6666-6666-666666666666', 'DSCR', 'CoreVest Portfolio Express', true, '00000000-0000-0000-0000-000000000000'),
  ('p6666666-2222-2222-2222-222222222222', 1, '66666666-6666-6666-6666-666666666666', 'Portfolio', 'CoreVest Portfolio Pro', true, '00000000-0000-0000-0000-000000000000'),
  
  -- RCN Programs
  ('p7777777-1111-1111-1111-111111111111', 1, '77777777-7777-7777-7777-777777777777', 'Fix and Flip', 'RCN Fix & Flip', true, '00000000-0000-0000-0000-000000000000'),
  ('p7777777-2222-2222-2222-222222222222', 1, '77777777-7777-7777-7777-777777777777', 'DSCR', 'RCN Rental Finance', true, '00000000-0000-0000-0000-000000000000'),
  
  -- Civic Programs
  ('p8888888-1111-1111-1111-111111111111', 1, '88888888-8888-8888-8888-888888888888', 'Bridge', 'Civic Bridge Plus', true, '00000000-0000-0000-0000-000000000000'),
  ('p8888888-2222-2222-2222-222222222222', 1, '88888888-8888-8888-8888-888888888888', 'DSCR', 'Civic Rental Pro', true, '00000000-0000-0000-0000-000000000000'),
  
  -- ABL Programs
  ('p9999999-1111-1111-1111-111111111111', 1, '99999999-9999-9999-9999-999999999999', 'DSCR', 'ABL No Credit DSCR', true, '00000000-0000-0000-0000-000000000000'),
  ('p9999999-2222-2222-2222-222222222222', 1, '99999999-9999-9999-9999-999999999999', 'Asset Based', 'ABL Pure Asset', true, '00000000-0000-0000-0000-000000000000');

-- Add varied criteria for new programs

-- CoreVest Portfolio Express: $75k - $5M, portfolio friendly
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, soft_min_value, soft_max_value, required_flag, created_by) VALUES
  (gen_random_uuid(), 'p6666666-1111-1111-1111-111111111111', 1, 'min_loan_amount', 'decimal', 75000, NULL, 150000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-1111-1111-1111-111111111111', 1, 'max_loan_amount', 'decimal', NULL, 5000000, NULL, 3000000, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-1111-1111-1111-111111111111', 1, 'min_fico', 'integer', 680, NULL, 720, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-1111-1111-1111-111111111111', 1, 'max_ltv', 'decimal', NULL, 80, NULL, 75, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-1111-1111-1111-111111111111', 1, 'min_dscr', 'decimal', 1.20, NULL, 1.25, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-1111-1111-1111-111111111111', 1, 'max_properties', 'integer', NULL, 10, NULL, 5, false, '00000000-0000-0000-0000-000000000000');

-- CoreVest Portfolio Pro: Larger portfolios
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, soft_min_value, soft_max_value, required_flag, created_by) VALUES
  (gen_random_uuid(), 'p6666666-2222-2222-2222-222222222222', 1, 'min_loan_amount', 'decimal', 1000000, NULL, 2000000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-2222-2222-2222-222222222222', 1, 'max_loan_amount', 'decimal', NULL, 50000000, NULL, 20000000, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-2222-2222-2222-222222222222', 1, 'min_properties', 'integer', 5, NULL, 10, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-2222-2222-2222-222222222222', 1, 'min_fico', 'integer', 700, NULL, 740, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-2222-2222-2222-222222222222', 1, 'max_ltv', 'decimal', NULL, 75, NULL, 70, true, '00000000-0000-0000-0000-000000000000');

-- RCN Fix & Flip: Short term, higher rates
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, soft_min_value, soft_max_value, required_flag, created_by) VALUES
  (gen_random_uuid(), 'p7777777-1111-1111-1111-111111111111', 1, 'min_loan_amount', 'decimal', 50000, NULL, 100000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p7777777-1111-1111-1111-111111111111', 1, 'max_loan_amount', 'decimal', NULL, 2500000, NULL, 1500000, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p7777777-1111-1111-1111-111111111111', 1, 'min_fico', 'integer', 650, NULL, 680, NULL, false, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p7777777-1111-1111-1111-111111111111', 1, 'max_ltc', 'decimal', NULL, 90, NULL, 85, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p7777777-1111-1111-1111-111111111111', 1, 'max_arv', 'decimal', NULL, 70, NULL, 65, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p7777777-1111-1111-1111-111111111111', 1, 'term_months', 'integer', 12, 12, NULL, NULL, true, '00000000-0000-0000-0000-000000000000');

-- RCN Rental Finance: Standard DSCR
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, soft_min_value, soft_max_value, required_flag, created_by) VALUES
  (gen_random_uuid(), 'p7777777-2222-2222-2222-222222222222', 1, 'min_loan_amount', 'decimal', 75000, NULL, 100000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p7777777-2222-2222-2222-222222222222', 1, 'max_loan_amount', 'decimal', NULL, 2500000, NULL, 2000000, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p7777777-2222-2222-2222-222222222222', 1, 'min_fico', 'integer', 680, NULL, 700, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p7777777-2222-2222-2222-222222222222', 1, 'max_ltv', 'decimal', NULL, 80, NULL, 75, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p7777777-2222-2222-2222-222222222222', 1, 'min_dscr', 'decimal', 1.10, NULL, 1.20, NULL, true, '00000000-0000-0000-0000-000000000000');

-- Civic Bridge Plus: Higher leverage bridge
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, soft_min_value, soft_max_value, required_flag, created_by) VALUES
  (gen_random_uuid(), 'p8888888-1111-1111-1111-111111111111', 1, 'min_loan_amount', 'decimal', 150000, NULL, 250000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p8888888-1111-1111-1111-111111111111', 1, 'max_loan_amount', 'decimal', NULL, 10000000, NULL, 5000000, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p8888888-1111-1111-1111-111111111111', 1, 'min_fico', 'integer', 660, NULL, 700, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p8888888-1111-1111-1111-111111111111', 1, 'max_ltv', 'decimal', NULL, 85, NULL, 80, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p8888888-1111-1111-1111-111111111111', 1, 'term_months', 'integer', 12, 24, 12, 18, true, '00000000-0000-0000-0000-000000000000');

-- Civic Rental Pro: California focused DSCR
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, soft_min_value, soft_max_value, required_flag, created_by) VALUES
  (gen_random_uuid(), 'p8888888-2222-2222-2222-222222222222', 1, 'min_loan_amount', 'decimal', 150000, NULL, 300000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p8888888-2222-2222-2222-222222222222', 1, 'max_loan_amount', 'decimal', NULL, 5000000, NULL, 3000000, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p8888888-2222-2222-2222-222222222222', 1, 'min_fico', 'integer', 700, NULL, 720, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p8888888-2222-2222-2222-222222222222', 1, 'max_ltv', 'decimal', NULL, 75, NULL, 70, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p8888888-2222-2222-2222-222222222222', 1, 'min_dscr', 'decimal', 1.20, NULL, 1.25, NULL, true, '00000000-0000-0000-0000-000000000000');

-- ABL No Credit DSCR: True asset-based
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, soft_min_value, soft_max_value, required_flag, created_by) VALUES
  (gen_random_uuid(), 'p9999999-1111-1111-1111-111111111111', 1, 'min_loan_amount', 'decimal', 100000, NULL, 150000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p9999999-1111-1111-1111-111111111111', 1, 'max_loan_amount', 'decimal', NULL, 2000000, NULL, 1500000, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p9999999-1111-1111-1111-111111111111', 1, 'min_fico', 'integer', NULL, NULL, NULL, NULL, false, '00000000-0000-0000-0000-000000000000'), -- No FICO requirement!
  (gen_random_uuid(), 'p9999999-1111-1111-1111-111111111111', 1, 'max_ltv', 'decimal', NULL, 70, NULL, 65, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p9999999-1111-1111-1111-111111111111', 1, 'min_dscr', 'decimal', 1.25, NULL, 1.35, NULL, true, '00000000-0000-0000-0000-000000000000');

-- ABL Pure Asset: Property value only
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, soft_min_value, soft_max_value, required_flag, created_by) VALUES
  (gen_random_uuid(), 'p9999999-2222-2222-2222-222222222222', 1, 'min_loan_amount', 'decimal', 100000, NULL, 200000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p9999999-2222-2222-2222-222222222222', 1, 'max_loan_amount', 'decimal', NULL, 1500000, NULL, 1000000, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p9999999-2222-2222-2222-222222222222', 1, 'max_ltv', 'decimal', NULL, 65, NULL, 60, true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p9999999-2222-2222-2222-222222222222', 1, 'min_property_value', 'decimal', 150000, NULL, 300000, NULL, true, '00000000-0000-0000-0000-000000000000');

-- Add special property type restrictions
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, enum_values, required_flag, created_by) VALUES
  -- CoreVest allows most property types
  (gen_random_uuid(), 'p6666666-1111-1111-1111-111111111111', 1, 'property_types', 'enum', '["SFR", "MF", "Condo", "Townhome"]', true, '00000000-0000-0000-0000-000000000000'),
  -- RCN Fix & Flip only SFR
  (gen_random_uuid(), 'p7777777-1111-1111-1111-111111111111', 1, 'property_types', 'enum', '["SFR"]', true, '00000000-0000-0000-0000-000000000000'),
  -- Civic allows condos with restrictions
  (gen_random_uuid(), 'p8888888-2222-2222-2222-222222222222', 1, 'property_types', 'enum', '["SFR", "Condo", "Townhome"]', true, '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p8888888-2222-2222-2222-222222222222', 1, 'condo_warrantable', 'bool', NULL, false, '00000000-0000-0000-0000-000000000000');

-- Add metro-specific programs (overriding state coverage)
INSERT INTO programmetros (program_id, program_version, metro_id) 
SELECT 'p8888888-2222-2222-2222-222222222222', 1, metro_id 
FROM metros 
WHERE name IN ('Bay Area', 'Los Angeles', 'San Diego');

-- Create pricing matrices for some programs
INSERT INTO pricingmatrix (matrix_id, program_id, program_version, rate_index_id, spread_bps, ltv_band, dscr_band, created_by) VALUES
  -- Kiavi DSCR pricing tiers
  (gen_random_uuid(), 'p1111111-1111-1111-1111-111111111111', 1, NULL, 675, '0-65', '1.35+', '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p1111111-1111-1111-1111-111111111111', 1, NULL, 700, '65-70', '1.35+', '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p1111111-1111-1111-1111-111111111111', 1, NULL, 725, '70-75', '1.35+', '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p1111111-1111-1111-1111-111111111111', 1, NULL, 700, '0-65', '1.25-1.35', '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p1111111-1111-1111-1111-111111111111', 1, NULL, 725, '65-70', '1.25-1.35', '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p1111111-1111-1111-1111-111111111111', 1, NULL, 750, '70-75', '1.25-1.35', '00000000-0000-0000-0000-000000000000'),
  
  -- CoreVest Portfolio pricing
  (gen_random_uuid(), 'p6666666-2222-2222-2222-222222222222', 1, NULL, 625, '0-60', '1.30+', '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-2222-2222-2222-222222222222', 1, NULL, 650, '60-65', '1.30+', '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-2222-2222-2222-222222222222', 1, NULL, 675, '65-70', '1.30+', '00000000-0000-0000-0000-000000000000'),
  (gen_random_uuid(), 'p6666666-2222-2222-2222-222222222222', 1, NULL, 700, '70-75', '1.30+', '00000000-0000-0000-0000-000000000000');

-- Add some metros for testing
INSERT INTO metros (metro_id, name, state_code, coverage_notes) VALUES
  ('m1111111-1111-1111-1111-111111111111', 'DFW', 'TX', 'Dallas-Fort Worth metroplex'),
  ('m2222222-2222-2222-2222-222222222222', 'Houston', 'TX', 'Greater Houston area'),
  ('m3333333-3333-3333-3333-333333333333', 'Bay Area', 'CA', 'San Francisco Bay Area'),
  ('m4444444-4444-4444-4444-444444444444', 'Los Angeles', 'CA', 'Greater Los Angeles'),
  ('m5555555-5555-5555-5555-555555555555', 'San Diego', 'CA', 'San Diego County'),
  ('m6666666-6666-6666-6666-666666666666', 'Phoenix', 'AZ', 'Phoenix metropolitan area'),
  ('m7777777-7777-7777-7777-777777777777', 'Miami', 'FL', 'Miami-Dade, Broward, Palm Beach')
ON CONFLICT (metro_id) DO NOTHING;
