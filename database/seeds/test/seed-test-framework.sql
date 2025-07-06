-- Seed Test Framework
-- "Design is not just what it looks like and feels like. Design is how it works." - Steve Jobs
-- This framework ensures our seeds create a perfect, consistent world every time.

-- Create test schema for validation
CREATE SCHEMA IF NOT EXISTS seed_test;

-- Test result tracking with beautiful simplicity
CREATE TABLE IF NOT EXISTS seed_test.results (
    test_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    suite_name TEXT NOT NULL,
    test_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'SKIP')),
    expected_value TEXT,
    actual_value TEXT,
    error_message TEXT,
    execution_time_ms INT,
    executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Test suite metadata
CREATE TABLE IF NOT EXISTS seed_test.suites (
    suite_name TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_run TIMESTAMPTZ,
    total_runs INT DEFAULT 0,
    pass_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN total_runs > 0 THEN 
                (SELECT COUNT(*)::DECIMAL / total_runs * 100 
                 FROM seed_test.results 
                 WHERE suite_name = suites.suite_name AND status = 'PASS')
            ELSE 0 
        END
    ) STORED
);

-- Simple, powerful test runner
CREATE OR REPLACE FUNCTION seed_test.run_test(
    p_suite_name TEXT,
    p_test_name TEXT,
    p_test_query TEXT,
    p_expected_value TEXT DEFAULT NULL,
    p_comparison_operator TEXT DEFAULT '='
) RETURNS BOOLEAN AS $$
DECLARE
    v_actual_value TEXT;
    v_status TEXT;
    v_error_message TEXT;
    v_start_time TIMESTAMPTZ;
    v_execution_time_ms INT;
    v_test_passed BOOLEAN;
BEGIN
    v_start_time := clock_timestamp();
    
    BEGIN
        -- Execute the test query
        EXECUTE p_test_query INTO v_actual_value;
        
        -- Determine test result
        IF p_expected_value IS NULL THEN
            -- If no expected value, just check query executes successfully
            v_test_passed := TRUE;
        ELSE
            -- Compare actual vs expected
            EXECUTE format('SELECT %L %s %L', v_actual_value, p_comparison_operator, p_expected_value) 
            INTO v_test_passed;
        END IF;
        
        v_status := CASE WHEN v_test_passed THEN 'PASS' ELSE 'FAIL' END;
        
    EXCEPTION WHEN OTHERS THEN
        v_status := 'FAIL';
        v_error_message := SQLERRM;
        v_test_passed := FALSE;
    END;
    
    v_execution_time_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time);
    
    -- Record result
    INSERT INTO seed_test.results (
        suite_name, test_name, status, expected_value, 
        actual_value, error_message, execution_time_ms
    ) VALUES (
        p_suite_name, p_test_name, v_status, p_expected_value,
        v_actual_value, v_error_message, v_execution_time_ms
    );
    
    -- Update suite metadata
    UPDATE seed_test.suites 
    SET last_run = CURRENT_TIMESTAMP,
        total_runs = total_runs + 1
    WHERE suite_name = p_suite_name;
    
    RETURN v_test_passed;
END;
$$ LANGUAGE plpgsql;

-- Beautiful test output formatter
CREATE OR REPLACE FUNCTION seed_test.format_results(p_suite_name TEXT DEFAULT NULL)
RETURNS TABLE (
    output_line TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH test_summary AS (
        SELECT 
            suite_name,
            COUNT(*) as total_tests,
            COUNT(*) FILTER (WHERE status = 'PASS') as passed,
            COUNT(*) FILTER (WHERE status = 'FAIL') as failed,
            COUNT(*) FILTER (WHERE status = 'SKIP') as skipped,
            MAX(executed_at) as last_run,
            SUM(execution_time_ms) as total_time_ms
        FROM seed_test.results
        WHERE suite_name = COALESCE(p_suite_name, suite_name)
          AND executed_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        GROUP BY suite_name
    ),
    detailed_results AS (
        SELECT 
            suite_name,
            test_name,
            status,
            execution_time_ms,
            error_message,
            CASE 
                WHEN status = 'PASS' THEN '✅'
                WHEN status = 'FAIL' THEN '❌'
                ELSE '⏭️'
            END as icon
        FROM seed_test.results
        WHERE suite_name = COALESCE(p_suite_name, suite_name)
          AND executed_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        ORDER BY suite_name, executed_at
    )
    -- Header
    SELECT '┌─────────────────────────────────────────────────────────┐'
    UNION ALL
    SELECT '│           🧪 Seed Test Results - ' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI') || '           │'
    UNION ALL
    SELECT '└─────────────────────────────────────────────────────────┘'
    UNION ALL
    SELECT ''
    UNION ALL
    -- Summary for each suite
    SELECT format('📊 Suite: %s', suite_name) FROM test_summary
    UNION ALL
    SELECT format('   Total: %s | ✅ Passed: %s | ❌ Failed: %s | ⏱️ Time: %sms',
        total_tests, passed, failed, total_time_ms)
    FROM test_summary
    UNION ALL
    SELECT ''
    UNION ALL
    -- Detailed results
    SELECT format('   %s %s (%sms)%s', 
        icon, 
        test_name, 
        execution_time_ms,
        CASE WHEN error_message IS NOT NULL 
             THEN E'\n      ↳ ' || error_message 
             ELSE '' 
        END
    )
    FROM detailed_results
    UNION ALL
    SELECT ''
    UNION ALL
    -- Footer
    SELECT CASE 
        WHEN (SELECT SUM(failed) FROM test_summary) = 0 THEN 
            '✨ All tests passed! Your seeds are perfect. ✨'
        ELSE 
            '⚠️  Some tests failed. Please review and fix.'
    END;
END;
$$ LANGUAGE plpgsql;

-- Clean test execution
CREATE OR REPLACE FUNCTION seed_test.run_suite(p_suite_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Clear previous results for this suite
    DELETE FROM seed_test.results 
    WHERE suite_name = p_suite_name 
      AND executed_at < CURRENT_TIMESTAMP - INTERVAL '1 hour';
    
    -- Ensure suite exists
    INSERT INTO seed_test.suites (suite_name, description)
    VALUES (p_suite_name, 'Automated test suite for ' || p_suite_name)
    ON CONFLICT (suite_name) DO NOTHING;
    
    RAISE NOTICE 'Starting test suite: %', p_suite_name;
END;
$$ LANGUAGE plpgsql;

-- Show results in a beautiful way
CREATE OR REPLACE FUNCTION seed_test.show_results(p_suite_name TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM seed_test.format_results(p_suite_name)
    LOOP
        RAISE NOTICE '%', r.output_line;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
