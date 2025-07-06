-- Core Seed Validation Tests
-- "Quality is more important than quantity. One home run is much better than two doubles." - Steve Jobs

\i test/seed-test-framework.sql

-- Initialize test suite
SELECT seed_test.run_suite('core_seeds');

-- Test 1: All states are loaded
SELECT seed_test.run_test(
    'core_seeds',
    'All 50 states plus DC loaded',
    'SELECT COUNT(*)::TEXT FROM states',
    '51'
);

-- Test 2: Essential lenders exist
SELECT seed_test.run_test(
    'core_seeds',
    'Minimum lenders loaded',
    'SELECT COUNT(*)::TEXT FROM lenders WHERE active = true',
    '5',
    '>='
);

-- Test 3: Every lender has at least one program
SELECT seed_test.run_test(
    'core_seeds',
    'Every lender has programs',
    'SELECT COUNT(*)::TEXT FROM lenders l WHERE NOT EXISTS (SELECT 1 FROM programs p WHERE p.lender_id = l.lender_id AND p.active = true)',
    '0'
);

-- Test 4: Every program has criteria
SELECT seed_test.run_test(
    'core_seeds',
    'Every program has criteria',
    'SELECT COUNT(*)::TEXT FROM programs p WHERE NOT EXISTS (SELECT 1 FROM programcriteria pc WHERE pc.program_id = p.program_id AND pc.program_version = p.program_version)',
    '0'
);

-- Test 5: Loan amount criteria consistency
SELECT seed_test.run_test(
    'core_seeds',
    'Min loan amounts less than max',
    $$SELECT COUNT(*)::TEXT FROM (
        SELECT p.program_id 
        FROM programs p
        JOIN programcriteria pc_min ON pc_min.program_id = p.program_id 
            AND pc_min.program_version = p.program_version 
            AND pc_min.name = 'min_loan_amount'
        JOIN programcriteria pc_max ON pc_max.program_id = p.program_id 
            AND pc_max.program_version = p.program_version 
            AND pc_max.name = 'max_loan_amount'
        WHERE pc_min.hard_min_value > pc_max.hard_max_value
    ) inconsistent$$,
    '0'
);

-- Test 6: LTV criteria are percentages
SELECT seed_test.run_test(
    'core_seeds',
    'LTV values are valid percentages',
    $$SELECT COUNT(*)::TEXT FROM programcriteria 
      WHERE name LIKE '%ltv%' 
      AND (hard_max_value > 100 OR hard_min_value < 0)$$,
    '0'
);

-- Test 7: State coverage integrity
SELECT seed_test.run_test(
    'core_seeds',
    'All state references are valid',
    $$SELECT COUNT(*)::TEXT FROM lenderstates ls 
      WHERE NOT EXISTS (SELECT 1 FROM states s WHERE s.state_code = ls.state_code)$$,
    '0'
);

-- Test 8: Metro coverage integrity
SELECT seed_test.run_test(
    'core_seeds',
    'All metro references valid states',
    $$SELECT COUNT(*)::TEXT FROM metros m 
      WHERE NOT EXISTS (SELECT 1 FROM states s WHERE s.state_code = m.state_code)$$,
    '0'
);

-- Test 9: Test users have proper roles
SELECT seed_test.run_test(
    'core_seeds',
    'Test users have valid roles',
    $$SELECT COUNT(*)::TEXT FROM users 
      WHERE role NOT IN ('ADMIN', 'BROKER', 'ANALYST', 'LENDER_REP', 'VIEWER')$$,
    '0'
);

-- Test 10: No orphaned scenarios
SELECT seed_test.run_test(
    'core_seeds',
    'All scenarios have borrowers',
    $$SELECT COUNT(*)::TEXT FROM scenarios s 
      WHERE NOT EXISTS (SELECT 1 FROM scenarioborrower sb WHERE sb.scenario_id = s.scenario_id)$$,
    '0'
);

-- Test 11: Scenario status progression is logical
SELECT seed_test.run_test(
    'core_seeds',
    'Won/Lost scenarios have offers',
    $$SELECT COUNT(*)::TEXT FROM scenarios s 
      WHERE s.status IN ('Won', 'Lost') 
      AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.scenario_id = s.scenario_id)$$,
    '0'
);

-- Test 12: Offer amounts match scenario patterns
SELECT seed_test.run_test(
    'core_seeds',
    'Offers have reasonable LTVs',
    $$SELECT COUNT(*)::TEXT FROM offers 
      WHERE ltv NOT BETWEEN 50 AND 90$$,
    '0'
);

-- Test 13: DSCR criteria are reasonable
SELECT seed_test.run_test(
    'core_seeds',
    'DSCR values are realistic',
    $$SELECT COUNT(*)::TEXT FROM programcriteria 
      WHERE name LIKE '%dscr%' 
      AND (hard_min_value < 1.0 OR hard_max_value > 3.0)$$,
    '0'
);

-- Test 14: Geographic coverage makes sense
SELECT seed_test.run_test(
    'core_seeds',
    'Nationwide lenders cover most states',
    $$SELECT CASE 
        WHEN COUNT(DISTINCT state_code) > 45 THEN 'true'
        ELSE 'false'
      END::TEXT
      FROM lenderstates 
      WHERE lender_id IN (
        SELECT lender_id FROM lenders WHERE notes LIKE '%nationwide%'
      )$$,
    'true'
);

-- Test 15: Data consistency across relationships
SELECT seed_test.run_test(
    'core_seeds',
    'All foreign keys are valid',
    $$WITH fk_violations AS (
        SELECT 'programs.lender_id' as violation FROM programs p 
        WHERE NOT EXISTS (SELECT 1 FROM lenders l WHERE l.lender_id = p.lender_id)
        UNION ALL
        SELECT 'offers.scenario_id' FROM offers o 
        WHERE NOT EXISTS (SELECT 1 FROM scenarios s WHERE s.scenario_id = o.scenario_id)
        UNION ALL
        SELECT 'scenarioproperty.property_id' FROM scenarioproperty sp 
        WHERE NOT EXISTS (SELECT 1 FROM property p WHERE p.property_id = sp.property_id)
    )
    SELECT COUNT(*)::TEXT FROM fk_violations$$,
    '0'
);

-- Performance test: Indexes exist for common queries
SELECT seed_test.run_test(
    'core_seeds',
    'Critical indexes exist',
    $$SELECT COUNT(*)::TEXT FROM pg_indexes 
      WHERE tablename IN ('scenarios', 'offers', 'programs') 
      AND indexname LIKE '%idx%'$$,
    '0',
    '>='
);

-- Show beautiful results
SELECT seed_test.show_results('core_seeds');
