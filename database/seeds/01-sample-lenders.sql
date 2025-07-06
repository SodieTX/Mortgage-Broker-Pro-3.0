-- Sample DSCR Lenders and Programs
-- This gives us real data to work with for the Pinocchio test

-- Clear existing test data (careful in production!)
TRUNCATE TABLE programcriteria CASCADE;
TRUNCATE TABLE programs CASCADE;
TRUNCATE TABLE lenderstates CASCADE;
TRUNCATE TABLE lenders CASCADE;

-- Insert some real DSCR lenders
INSERT INTO lenders (lender_id, name, website_url, contact_name, contact_email, active, profile_score, created_by, notes) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Kiavi (formerly LendingHome)', 'https://kiavi.com', 'John Smith', 'contact@kiavi.com', true, 95.0, '00000000-0000-0000-0000-000000000000', 'Major DSCR lender, fast closings'),
  ('22222222-2222-2222-2222-222222222222', 'Lima One Capital', 'https://limaone.com', 'Jane Doe', 'contact@limaone.com', true, 92.0, '00000000-0000-0000-0000-000000000000', 'Good for fix and flip and DSCR'),
  ('33333333-3333-3333-3333-333333333333', 'Visio Lending', 'https://visiolending.com', 'Bob Johnson', 'contact@visiolending.com', true, 88.0, '00000000-0000-0000-0000-000000000000', 'DSCR specialist, nationwide coverage'),
  ('44444444-4444-4444-4444-444444444444', 'Griffin Funding', 'https://griffinfunding.com', 'Alice Brown', 'contact@griffinfunding.com', true, 85.0, '00000000-0000-0000-0000-000000000000', 'Good rates, slower process'),
  ('55555555-5555-5555-5555-555555555555', 'Truss Financial', 'https://trussfinancial.com', 'Charlie Wilson', 'contact@trussfinancial.com', true, 90.0, '00000000-0000-0000-0000-000000000000', 'DSCR focus, good for new investors');

-- State coverage (some nationwide, some limited)
-- Kiavi - nationwide except ND, SD, VT
INSERT INTO lenderstates (lender_id, state_code) 
SELECT '11111111-1111-1111-1111-111111111111', state_code 
FROM states 
WHERE state_code NOT IN ('ND', 'SD', 'VT');

-- Lima One - limited states
INSERT INTO lenderstates (lender_id, state_code) VALUES
  ('22222222-2222-2222-2222-222222222222', 'TX'),
  ('22222222-2222-2222-2222-222222222222', 'FL'),
  ('22222222-2222-2222-2222-222222222222', 'GA'),
  ('22222222-2222-2222-2222-222222222222', 'NC'),
  ('22222222-2222-2222-2222-222222222222', 'SC'),
  ('22222222-2222-2222-2222-222222222222', 'TN'),
  ('22222222-2222-2222-2222-222222222222', 'AL'),
  ('22222222-2222-2222-2222-222222222222', 'OH');

-- Visio - true nationwide
-- (No entries means they cover all states)

-- Griffin - most states
INSERT INTO lenderstates (lender_id, state_code) 
SELECT '44444444-4444-4444-4444-444444444444', state_code 
FROM states 
WHERE state_code NOT IN ('NY', 'CA', 'MN', 'ND', 'SD', 'OR');

-- Truss - growth markets
INSERT INTO lenderstates (lender_id, state_code) VALUES
  ('55555555-5555-5555-5555-555555555555', 'TX'),
  ('55555555-5555-5555-5555-555555555555', 'FL'),
  ('55555555-5555-5555-5555-555555555555', 'AZ'),
  ('55555555-5555-5555-5555-555555555555', 'NV'),
  ('55555555-5555-5555-5555-555555555555', 'CO'),
  ('55555555-5555-5555-5555-555555555555', 'GA'),
  ('55555555-5555-5555-5555-555555555555', 'NC');

-- Programs for each lender
-- Kiavi DSCR Program
INSERT INTO programs (program_id, program_version, lender_id, product_type, name, active, created_by) VALUES
  ('p1111111-1111-1111-1111-111111111111', 1, '11111111-1111-1111-1111-111111111111', 'DSCR', 'Kiavi Rental Loan', true, '00000000-0000-0000-0000-000000000000'),
  ('p1111111-2222-2222-2222-222222222222', 1, '11111111-1111-1111-1111-111111111111', 'Bridge', 'Kiavi Bridge Loan', true, '00000000-0000-0000-0000-000000000000');

-- Lima One Programs
INSERT INTO programs (program_id, program_version, lender_id, product_type, name, active, created_by) VALUES
  ('p2222222-1111-1111-1111-111111111111', 1, '22222222-2222-2222-2222-222222222222', 'DSCR', 'Lima One Rental360', true, '00000000-0000-0000-0000-000000000000'),
  ('p2222222-2222-2222-2222-222222222222', 1, '22222222-2222-2222-2222-222222222222', 'Fix and Flip', 'Lima One Fix & Flip', true, '00000000-0000-0000-0000-000000000000');

-- Visio Programs
INSERT INTO programs (program_id, program_version, lender_id, product_type, name, active, created_by) VALUES
  ('p3333333-1111-1111-1111-111111111111', 1, '33333333-3333-3333-3333-333333333333', 'DSCR', 'Visio Rental360', true, '00000000-0000-0000-0000-000000000000'),
  ('p3333333-2222-2222-2222-222222222222', 1, '33333333-3333-3333-3333-333333333333', 'DSCR', 'Visio Plus (High LTV)', true, '00000000-0000-0000-0000-000000000000');

-- Griffin Programs
INSERT INTO programs (program_id, program_version, lender_id, product_type, name, active, created_by) VALUES
  ('p4444444-1111-1111-1111-111111111111', 1, '44444444-4444-4444-4444-444444444444', 'DSCR', 'Griffin DSCR Standard', true, '00000000-0000-0000-0000-000000000000');

-- Truss Programs
INSERT INTO programs (program_id, program_version, lender_id, product_type, name, active, created_by) VALUES
  ('p5555555-1111-1111-1111-111111111111', 1, '55555555-5555-5555-5555-555555555555', 'DSCR', 'Truss DSCR Investor', true, '00000000-0000-0000-0000-000000000000');

-- Program Criteria (loan amounts)
-- Kiavi DSCR: $150k - $3M
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, required_flag, created_by) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 1, 'min_loan_amount', 'decimal', 150000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  ('c1111111-2222-2222-2222-222222222222', 'p1111111-1111-1111-1111-111111111111', 1, 'max_loan_amount', 'decimal', NULL, 3000000, true, '00000000-0000-0000-0000-000000000000');

-- Kiavi Bridge: $150k - $7.5M
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, required_flag, created_by) VALUES
  ('c1111111-3333-3333-3333-333333333333', 'p1111111-2222-2222-2222-222222222222', 1, 'min_loan_amount', 'decimal', 150000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  ('c1111111-4444-4444-4444-444444444444', 'p1111111-2222-2222-2222-222222222222', 1, 'max_loan_amount', 'decimal', NULL, 7500000, true, '00000000-0000-0000-0000-000000000000');

-- Lima One DSCR: $100k - $2M
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, required_flag, created_by) VALUES
  ('c2222222-1111-1111-1111-111111111111', 'p2222222-1111-1111-1111-111111111111', 1, 'min_loan_amount', 'decimal', 100000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  ('c2222222-2222-2222-2222-222222222222', 'p2222222-1111-1111-1111-111111111111', 1, 'max_loan_amount', 'decimal', NULL, 2000000, true, '00000000-0000-0000-0000-000000000000');

-- Visio Standard: $100k - $2M
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, required_flag, created_by) VALUES
  ('c3333333-1111-1111-1111-111111111111', 'p3333333-1111-1111-1111-111111111111', 1, 'min_loan_amount', 'decimal', 100000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  ('c3333333-2222-2222-2222-222222222222', 'p3333333-1111-1111-1111-111111111111', 1, 'max_loan_amount', 'decimal', NULL, 2000000, true, '00000000-0000-0000-0000-000000000000');

-- Visio Plus: $75k - $3M (lower minimum!)
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, required_flag, created_by) VALUES
  ('c3333333-3333-3333-3333-333333333333', 'p3333333-2222-2222-2222-222222222222', 1, 'min_loan_amount', 'decimal', 75000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  ('c3333333-4444-4444-4444-444444444444', 'p3333333-2222-2222-2222-222222222222', 1, 'max_loan_amount', 'decimal', NULL, 3000000, true, '00000000-0000-0000-0000-000000000000');

-- Griffin: $150k - $2.5M
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, required_flag, created_by) VALUES
  ('c4444444-1111-1111-1111-111111111111', 'p4444444-1111-1111-1111-111111111111', 1, 'min_loan_amount', 'decimal', 150000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  ('c4444444-2222-2222-2222-222222222222', 'p4444444-1111-1111-1111-111111111111', 1, 'max_loan_amount', 'decimal', NULL, 2500000, true, '00000000-0000-0000-0000-000000000000');

-- Truss: $75k - $1.5M (good for smaller deals)
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, required_flag, created_by) VALUES
  ('c5555555-1111-1111-1111-111111111111', 'p5555555-1111-1111-1111-111111111111', 1, 'min_loan_amount', 'decimal', 75000, NULL, true, '00000000-0000-0000-0000-000000000000'),
  ('c5555555-2222-2222-2222-222222222222', 'p5555555-1111-1111-1111-111111111111', 1, 'max_loan_amount', 'decimal', NULL, 1500000, true, '00000000-0000-0000-0000-000000000000');

-- Add a few more realistic criteria for Kiavi (to show the system can handle complex criteria)
INSERT INTO programcriteria (criteria_id, program_id, program_version, name, data_type, hard_min_value, hard_max_value, soft_min_value, soft_max_value, required_flag, created_by) VALUES
  ('c1111111-5555-5555-5555-555555555555', 'p1111111-1111-1111-1111-111111111111', 1, 'min_fico', 'integer', 660, NULL, 700, NULL, true, '00000000-0000-0000-0000-000000000000'),
  ('c1111111-6666-6666-6666-666666666666', 'p1111111-1111-1111-1111-111111111111', 1, 'max_ltv', 'decimal', NULL, 80, NULL, 75, true, '00000000-0000-0000-0000-000000000000'),
  ('c1111111-7777-7777-7777-777777777777', 'p1111111-1111-1111-1111-111111111111', 1, 'min_dscr', 'decimal', 1.15, NULL, 1.25, NULL, true, '00000000-0000-0000-0000-000000000000');
