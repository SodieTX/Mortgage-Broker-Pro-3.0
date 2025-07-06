-- Test User Accounts
-- This file creates test users with various roles and permissions
-- Password for all test accounts: TestPass123!

-- Note: These UUIDs are hardcoded for consistency in testing
-- In production, use proper UUID generation

-- System Admin User
INSERT INTO users (user_id, email, username, full_name, role, active, created_at, notes) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@mortgagebroker.test', 'admin', 'System Administrator', 'ADMIN', true, CURRENT_TIMESTAMP, 'Full system access'),
  
-- Broker Users (different experience levels)
  ('b0000000-0000-0000-0000-000000000001', 'john.broker@mortgagebroker.test', 'johnbroker', 'John Broker', 'BROKER', true, CURRENT_TIMESTAMP, 'Senior broker, 10+ years experience'),
  ('b0000000-0000-0000-0000-000000000002', 'sarah.dealmaker@mortgagebroker.test', 'sarahdeal', 'Sarah Dealmaker', 'BROKER', true, CURRENT_TIMESTAMP, 'Mid-level broker, specializes in DSCR'),
  ('b0000000-0000-0000-0000-000000000003', 'mike.newbie@mortgagebroker.test', 'mikenew', 'Mike Newbie', 'BROKER', true, CURRENT_TIMESTAMP, 'Junior broker, started 6 months ago'),
  
-- Analyst Users
  ('c0000000-0000-0000-0000-000000000001', 'alice.analyst@mortgagebroker.test', 'aliceanalyst', 'Alice Analyst', 'ANALYST', true, CURRENT_TIMESTAMP, 'Senior analyst, handles complex scenarios'),
  ('c0000000-0000-0000-0000-000000000002', 'bob.numbers@mortgagebroker.test', 'bobnumbers', 'Bob Numbers', 'ANALYST', true, CURRENT_TIMESTAMP, 'Data specialist, focuses on reporting'),
  
-- Lender Representative Users
  ('d0000000-0000-0000-0000-000000000001', 'rep.kiavi@kiavi.test', 'kiavirep', 'Kiavi Representative', 'LENDER_REP', true, CURRENT_TIMESTAMP, 'Official Kiavi account manager'),
  ('d0000000-0000-0000-0000-000000000002', 'rep.lima@limaone.test', 'limarep', 'Lima One Representative', 'LENDER_REP', true, CURRENT_TIMESTAMP, 'Lima One business development'),
  
-- Read-Only/Viewer Users
  ('e0000000-0000-0000-0000-000000000001', 'viewer@mortgagebroker.test', 'viewer', 'View Only User', 'VIEWER', true, CURRENT_TIMESTAMP, 'Read-only access for reporting'),
  ('e0000000-0000-0000-0000-000000000002', 'auditor@mortgagebroker.test', 'auditor', 'Compliance Auditor', 'VIEWER', true, CURRENT_TIMESTAMP, 'Compliance and audit review only'),
  
-- Inactive/Suspended Users (for testing)
  ('f0000000-0000-0000-0000-000000000001', 'suspended@mortgagebroker.test', 'suspended', 'Suspended User', 'BROKER', false, CURRENT_TIMESTAMP, 'Account suspended for testing'),
  ('f0000000-0000-0000-0000-000000000002', 'terminated@mortgagebroker.test', 'terminated', 'Terminated Employee', 'ANALYST', false, CURRENT_TIMESTAMP, 'No longer with company')
  
ON CONFLICT (user_id) DO NOTHING;

-- Create user preferences for active users
INSERT INTO user_preferences (user_id, preference_key, preference_value) VALUES
  -- Admin preferences
  ('a0000000-0000-0000-0000-000000000001', 'theme', 'dark'),
  ('a0000000-0000-0000-0000-000000000001', 'notifications', 'all'),
  ('a0000000-0000-0000-0000-000000000001', 'dashboard_layout', 'advanced'),
  
  -- John Broker preferences
  ('b0000000-0000-0000-0000-000000000001', 'theme', 'light'),
  ('b0000000-0000-0000-0000-000000000001', 'notifications', 'important'),
  ('b0000000-0000-0000-0000-000000000001', 'default_product_type', 'DSCR'),
  ('b0000000-0000-0000-0000-000000000001', 'favorite_lenders', '["11111111-1111-1111-1111-111111111111", "33333333-3333-3333-3333-333333333333"]'),
  
  -- Sarah Dealmaker preferences
  ('b0000000-0000-0000-0000-000000000002', 'theme', 'auto'),
  ('b0000000-0000-0000-0000-000000000002', 'notifications', 'all'),
  ('b0000000-0000-0000-0000-000000000002', 'quick_filters', '{"min_loan": 500000, "states": ["TX", "FL"]}')
  
ON CONFLICT (user_id, preference_key) DO UPDATE SET preference_value = EXCLUDED.preference_value;

-- Create team assignments
INSERT INTO teams (team_id, name, description, active) VALUES
  ('t0000000-0000-0000-0000-000000000001', 'West Coast Team', 'Handles CA, OR, WA, NV, AZ markets', true),
  ('t0000000-0000-0000-0000-000000000002', 'Texas Team', 'Specializes in Texas markets', true),
  ('t0000000-0000-0000-0000-000000000003', 'Bridge Loan Specialists', 'Focus on bridge and hard money loans', true)
ON CONFLICT (team_id) DO NOTHING;

-- Assign users to teams
INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES
  -- West Coast Team
  ('t0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'LEAD', CURRENT_TIMESTAMP),
  ('t0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'MEMBER', CURRENT_TIMESTAMP),
  ('t0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'MEMBER', CURRENT_TIMESTAMP),
  
  -- Texas Team
  ('t0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'LEAD', CURRENT_TIMESTAMP),
  ('t0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'MEMBER', CURRENT_TIMESTAMP),
  
  -- Bridge Loan Specialists
  ('t0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'MEMBER', CURRENT_TIMESTAMP),
  ('t0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'LEAD', CURRENT_TIMESTAMP)
  
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Create API keys for system integrations
INSERT INTO api_keys (key_id, user_id, key_hash, name, permissions, expires_at, last_used_at, active) VALUES
  ('k0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'hash_placeholder_1', 'Admin Full Access', '["*"]', '2025-12-31', NULL, true),
  ('k0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'hash_placeholder_2', 'John Mobile App', '["scenarios:read", "scenarios:write", "offers:read"]', '2025-06-30', NULL, true),
  ('k0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'hash_placeholder_3', 'Reporting Dashboard', '["scenarios:read", "offers:read", "reports:read"]', '2025-12-31', NULL, true)
ON CONFLICT (key_id) DO NOTHING;
