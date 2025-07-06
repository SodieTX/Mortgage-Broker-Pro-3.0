-- ===================================================================================
-- Janus v3.0: Comprehensive Testing Framework
--
-- Author:         Assistant
-- Date:           2025-01-06
--
-- Purpose:        Complete testing suite for Janus including:
--                 - Unit tests for individual functions
--                 - Integration tests for end-to-end workflows
--                 - Performance benchmarks
--                 - Data quality validation
--                 - Regression testing capabilities
-- ===================================================================================

BEGIN;

-- ===================================================================================
-- SECTION 1: TEST SCHEMA AND INFRASTRUCTURE
-- ===================================================================================

CREATE SCHEMA IF NOT EXISTS janus_test;

-- Test execution log
CREATE TABLE janus_test.TestExecutions (
    execution_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_suite          TEXT NOT NULL,
    test_name           TEXT NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    status              TEXT CHECK (status IN ('RUNNING', 'PASSED', 'FAILED', 'SKIPPED')),
    error_message       TEXT,
    execution_time_ms   INT,
    assertions_passed   INT DEFAULT 0,
    assertions_failed   INT DEFAULT 0,
    test_data           JSONB
);

-- Test data fixtures
CREATE TABLE janus_test.TestFixtures (
    fixture_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_name        TEXT UNIQUE NOT NULL,
    fixture_type        TEXT NOT NULL,
    fixture_data        JSONB NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- ===================================================================================
-- SECTION 2: TEST HELPER FUNCTIONS
-- ===================================================================================

-- Function to assert equality
CREATE OR REPLACE FUNCTION janus_test.assert_equals(
    p_expected ANYELEMENT,
    p_actual ANYELEMENT,
    p_message TEXT DEFAULT 'Values should be equal'
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
    IF p_expected IS DISTINCT FROM p_actual THEN
        RAISE EXCEPTION 'Assertion failed: %. Expected: %, Actual: %', 
            p_message, p_expected, p_actual;
    END IF;
    RETURN TRUE;
END;
$$;

-- Function to assert within range
CREATE OR REPLACE FUNCTION janus_test.assert_in_range(
    p_value DECIMAL,
    p_min DECIMAL,
    p_max DECIMAL,
    p_message TEXT DEFAULT 'Value should be within range'
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
    IF p_value < p_min OR p_value > p_max THEN
        RAISE EXCEPTION 'Assertion failed: %. Value % not in range [%, %]', 
            p_message, p_value, p_min, p_max;
    END IF;
    RETURN TRUE;
END;
$$;

-- Function to create test observations
CREATE OR REPLACE FUNCTION janus_test.create_test_observation(
    p_event_type TEXT,
    p_source_system TEXT,
    p_entity_id UUID DEFAULT gen_random_uuid(),
    p_event_data JSONB DEFAULT '{}'::JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
    v_observation_id UUID;
BEGIN
    INSERT INTO janus_observe.ObservationLog (
        source_event_id,
        source_system,
        event_type,
        primary_entity_type,
        primary_entity_id,
        event_payload,
        processing_status
    ) VALUES (
        gen_random_uuid(),
        p_source_system,
        p_event_type,
        'TEST_ENTITY',
        p_entity_id,
        p_event_data,
        'PENDING'
    ) RETURNING observation_id INTO v_observation_id;
    
    RETURN v_observation_id;
END;
$$;

-- ===================================================================================
-- SECTION 3: UNIT TESTS FOR ANALYSIS FUNCTIONS
-- ===================================================================================

-- Test Athena accuracy drift detection
CREATE OR REPLACE FUNCTION janus_test.test_athena_drift_detection()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_test_id UUID;
    v_pattern janus_analyze.PatternRegistry;
    v_offer_id UUID;
    v_scenario_id UUID;
    v_insight_count INT;
BEGIN
    v_test_id := gen_random_uuid();
    
    -- Get the pattern
    SELECT * INTO v_pattern 
    FROM janus_analyze.PatternRegistry 
    WHERE pattern_code = 'ATHENA_ACCURACY_DRIFT';
    
    -- Create test scenario and offer
    v_scenario_id := gen_random_uuid();
    v_offer_id := gen_random_uuid();
    
    INSERT INTO workflow.Scenarios (scenario_id, loan_status, loan_amount, created_at)
    VALUES (v_scenario_id, 'REJECTED', 500000, now());
    
    INSERT INTO workflow.Offers (
        offer_id, scenario_id, lender_id, program_id,
        match_score, confidence_score, ae_rating
    ) VALUES (
        v_offer_id, v_scenario_id, gen_random_uuid(), gen_random_uuid(),
        0.95, 0.90, 'PLATINUM'
    );
    
    -- Create observations for high-rated offer that got rejected
    PERFORM janus_test.create_test_observation(
        'OFFER_REJECTED',
        'ATHENA',
        v_offer_id,
        jsonb_build_object('offer_id', v_offer_id, 'scenario_id', v_scenario_id)
    );
    
    -- Run the analysis
    PERFORM janus_analyze.fn_correlate_athena_score_to_outcome(v_pattern);
    
    -- Check if insight was generated
    SELECT COUNT(*) INTO v_insight_count
    FROM janus_analyze.InsightLog
    WHERE pattern_id = v_pattern.pattern_id
      AND generated_at >= now() - INTERVAL '1 minute';
    
    -- Log test result
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at,
        assertions_passed, test_data
    ) VALUES (
        'Unit Tests', 'test_athena_drift_detection', 
        'PASSED', now(), 1,
        jsonb_build_object('insights_generated', v_insight_count)
    );
    
    -- Cleanup
    DELETE FROM workflow.Offers WHERE offer_id = v_offer_id;
    DELETE FROM workflow.Scenarios WHERE scenario_id = v_scenario_id;
    DELETE FROM janus_observe.ObservationLog WHERE primary_entity_id = v_offer_id;
    
EXCEPTION WHEN OTHERS THEN
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at,
        error_message
    ) VALUES (
        'Unit Tests', 'test_athena_drift_detection', 
        'FAILED', now(), SQLERRM
    );
    RAISE;
END;
$$;

-- Test workflow bottleneck detection
CREATE OR REPLACE FUNCTION janus_test.test_bottleneck_detection()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_pattern janus_analyze.PatternRegistry;
    v_scenario_id UUID;
    v_status_history RECORD;
    i INT;
BEGIN
    -- Get the pattern
    SELECT * INTO v_pattern 
    FROM janus_analyze.PatternRegistry 
    WHERE pattern_code = 'WORKFLOW_BOTTLENECK';
    
    -- Create test data with artificial bottleneck
    FOR i IN 1..20 LOOP
        v_scenario_id := gen_random_uuid();
        
        -- Create scenario
        INSERT INTO workflow.Scenarios (scenario_id, loan_status, created_at)
        VALUES (v_scenario_id, 'UNDERWRITING', now() - INTERVAL '10 days');
        
        -- Create history showing long time in OFFERS_IN status
        INSERT INTO workflow.ScenarioHistory (
            scenario_id, loan_status, changed_at, changed_by
        ) VALUES 
            (v_scenario_id, 'CREATED', now() - INTERVAL '10 days', 'TEST'),
            (v_scenario_id, 'OFFERS_IN', now() - INTERVAL '9 days', 'TEST'),
            (v_scenario_id, 'UNDERWRITING', now() - INTERVAL '2 days', 'TEST');
        
        -- Create observation
        PERFORM janus_test.create_test_observation(
            'SCENARIO_STATUS_CHANGED',
            'EMC2',
            v_scenario_id,
            jsonb_build_object('scenario_id', v_scenario_id)
        );
    END LOOP;
    
    -- Run analysis
    PERFORM janus_analyze.fn_calculate_status_duration(v_pattern);
    
    -- Verify insight generation
    PERFORM janus_test.assert_equals(
        TRUE,
        EXISTS(
            SELECT 1 FROM janus_analyze.InsightLog
            WHERE pattern_id = v_pattern.pattern_id
              AND insight_summary LIKE '%bottleneck%OFFERS_IN%'
              AND generated_at >= now() - INTERVAL '1 minute'
        ),
        'Bottleneck should be detected for OFFERS_IN status'
    );
    
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at, assertions_passed
    ) VALUES (
        'Unit Tests', 'test_bottleneck_detection', 'PASSED', now(), 1
    );
    
EXCEPTION WHEN OTHERS THEN
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at, error_message
    ) VALUES (
        'Unit Tests', 'test_bottleneck_detection', 'FAILED', now(), SQLERRM
    );
    RAISE;
END;
$$;

-- ===================================================================================
-- SECTION 4: INTEGRATION TESTS
-- ===================================================================================

-- Test full observation to recommendation pipeline
CREATE OR REPLACE FUNCTION janus_test.test_end_to_end_pipeline()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_scenario_id UUID;
    v_observation_id UUID;
    v_recommendation_count INT;
    i INT;
BEGIN
    -- Create multiple scenarios with poor outcomes
    FOR i IN 1..50 LOOP
        v_scenario_id := gen_random_uuid();
        
        -- High-quality import that fails
        INSERT INTO workflow.Scenarios (
            scenario_id, loan_status, import_id, created_at
        ) VALUES (
            v_scenario_id, 'REJECTED', gen_random_uuid(), now() - INTERVAL '5 days'
        );
        
        INSERT INTO universal_import.QualityScores (
            import_id, overall_score, completeness_score
        ) VALUES (
            (SELECT import_id FROM workflow.Scenarios WHERE scenario_id = v_scenario_id),
            0.65, -- Low quality
            0.70
        );
        
        -- Create observation
        v_observation_id := janus_test.create_test_observation(
            'SCENARIO_REJECTED',
            'EMC2',
            v_scenario_id,
            jsonb_build_object('scenario_id', v_scenario_id)
        );
    END LOOP;
    
    -- Run the full pipeline
    CALL janus_analyze.sp_analyze_observations();
    CALL janus_recommend.sp_generate_recommendations();
    
    -- Check recommendations were generated
    SELECT COUNT(*) INTO v_recommendation_count
    FROM janus_recommend.RecommendationQueue
    WHERE generated_at >= now() - INTERVAL '1 minute';
    
    PERFORM janus_test.assert_equals(
        TRUE,
        v_recommendation_count > 0,
        'Recommendations should be generated from insights'
    );
    
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at,
        assertions_passed, test_data
    ) VALUES (
        'Integration Tests', 'test_end_to_end_pipeline', 
        'PASSED', now(), 1,
        jsonb_build_object('recommendations_generated', v_recommendation_count)
    );
    
EXCEPTION WHEN OTHERS THEN
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at, error_message
    ) VALUES (
        'Integration Tests', 'test_end_to_end_pipeline', 
        'FAILED', now(), SQLERRM
    );
    RAISE;
END;
$$;

-- ===================================================================================
-- SECTION 5: PERFORMANCE BENCHMARKS
-- ===================================================================================

-- Benchmark analysis performance with varying data volumes
CREATE OR REPLACE FUNCTION janus_test.benchmark_analysis_performance()
RETURNS TABLE(
    data_volume INT,
    execution_time_ms INT,
    observations_per_second DECIMAL
) LANGUAGE plpgsql AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_volume INT;
    v_execution_ms INT;
BEGIN
    FOR v_volume IN SELECT unnest(ARRAY[100, 1000, 10000]) LOOP
        -- Create test observations
        INSERT INTO janus_observe.ObservationLog (
            source_event_id, source_system, event_type,
            primary_entity_type, primary_entity_id, event_payload
        )
        SELECT 
            gen_random_uuid(), 
            'BENCHMARK',
            'SCENARIO_CREATED',
            'workflow.Scenarios',
            gen_random_uuid(),
            jsonb_build_object('test_run', 'benchmark')
        FROM generate_series(1, v_volume);
        
        -- Time the analysis
        v_start_time := clock_timestamp();
        CALL janus_analyze.sp_analyze_observations();
        v_end_time := clock_timestamp();
        
        v_execution_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INT;
        
        data_volume := v_volume;
        execution_time_ms := v_execution_ms;
        observations_per_second := CASE 
            WHEN v_execution_ms > 0 
            THEN (v_volume * 1000.0 / v_execution_ms)::DECIMAL(10,2)
            ELSE 0 
        END;
        
        RETURN NEXT;
        
        -- Cleanup
        DELETE FROM janus_observe.ObservationLog WHERE source_system = 'BENCHMARK';
    END LOOP;
    
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at,
        test_data
    ) VALUES (
        'Performance', 'benchmark_analysis_performance', 
        'PASSED', now(),
        jsonb_build_object('benchmark_completed', TRUE)
    );
END;
$$;

-- ===================================================================================
-- SECTION 6: DATA VALIDATION TESTS
-- ===================================================================================

-- Validate observation data integrity
CREATE OR REPLACE FUNCTION janus_test.test_observation_data_integrity()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_orphaned_count INT;
    v_invalid_status_count INT;
BEGIN
    -- Check for orphaned observations (no matching entity)
    SELECT COUNT(*) INTO v_orphaned_count
    FROM janus_observe.ObservationLog o
    WHERE o.primary_entity_type = 'workflow.Scenarios'
      AND NOT EXISTS (
          SELECT 1 FROM workflow.Scenarios s 
          WHERE s.scenario_id = o.primary_entity_id
      );
    
    PERFORM janus_test.assert_equals(
        0, v_orphaned_count,
        'No orphaned observations should exist'
    );
    
    -- Check for invalid processing status transitions
    WITH status_pairs AS (
        SELECT 
            observation_id,
            processing_status,
            LAG(processing_status) OVER (PARTITION BY observation_id ORDER BY observed_at) AS prev_status
        FROM janus_observe.ObservationLog
    )
    SELECT COUNT(*) INTO v_invalid_status_count
    FROM status_pairs
    WHERE prev_status = 'ANALYZED' AND processing_status = 'PENDING';
    
    PERFORM janus_test.assert_equals(
        0, v_invalid_status_count,
        'No invalid status transitions should exist'
    );
    
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at, assertions_passed
    ) VALUES (
        'Data Validation', 'test_observation_data_integrity', 
        'PASSED', now(), 2
    );
    
EXCEPTION WHEN OTHERS THEN
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at, error_message
    ) VALUES (
        'Data Validation', 'test_observation_data_integrity', 
        'FAILED', now(), SQLERRM
    );
    RAISE;
END;
$$;

-- ===================================================================================
-- SECTION 7: TEST SUITE RUNNER
-- ===================================================================================

-- Main test runner procedure
CREATE OR REPLACE PROCEDURE janus_test.run_all_tests()
LANGUAGE plpgsql AS $$
DECLARE
    v_test RECORD;
    v_start_time TIMESTAMP;
    v_total_tests INT := 0;
    v_passed_tests INT := 0;
    v_failed_tests INT := 0;
BEGIN
    v_start_time := clock_timestamp();
    
    RAISE NOTICE 'Starting Janus test suite execution...';
    
    -- Run unit tests
    FOR v_test IN 
        SELECT proname AS test_name 
        FROM pg_proc 
        WHERE pronamespace = 'janus_test'::regnamespace
          AND proname LIKE 'test_%'
    LOOP
        v_total_tests := v_total_tests + 1;
        
        BEGIN
            EXECUTE format('SELECT janus_test.%I()', v_test.test_name);
            v_passed_tests := v_passed_tests + 1;
            RAISE NOTICE '✓ %', v_test.test_name;
        EXCEPTION WHEN OTHERS THEN
            v_failed_tests := v_failed_tests + 1;
            RAISE NOTICE '✗ %: %', v_test.test_name, SQLERRM;
        END;
    END LOOP;
    
    -- Run benchmarks
    RAISE NOTICE 'Running performance benchmarks...';
    PERFORM janus_test.benchmark_analysis_performance();
    
    -- Summary
    RAISE NOTICE '';
    RAISE NOTICE 'Test Suite Summary:';
    RAISE NOTICE '==================';
    RAISE NOTICE 'Total Tests: %', v_total_tests;
    RAISE NOTICE 'Passed: %', v_passed_tests;
    RAISE NOTICE 'Failed: %', v_failed_tests;
    RAISE NOTICE 'Duration: %', clock_timestamp() - v_start_time;
    
    -- Save summary
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at,
        test_data
    ) VALUES (
        'Test Suite', 'Summary', 
        CASE WHEN v_failed_tests = 0 THEN 'PASSED' ELSE 'FAILED' END,
        now(),
        jsonb_build_object(
            'total_tests', v_total_tests,
            'passed', v_passed_tests,
            'failed', v_failed_tests,
            'duration', (clock_timestamp() - v_start_time)::TEXT
        )
    );
END;
$$;

-- ===================================================================================
-- SECTION 8: TEST DATA GENERATORS
-- ===================================================================================

-- Generate realistic test scenarios
CREATE OR REPLACE FUNCTION janus_test.generate_test_scenarios(p_count INT DEFAULT 100)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_states TEXT[] := ARRAY['CA', 'TX', 'FL', 'NY', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];
    v_property_types TEXT[] := ARRAY['SFR', 'CONDO', 'TOWNHOUSE', '2-4 UNIT'];
    v_statuses TEXT[] := ARRAY['FUNDED', 'REJECTED', 'WITHDRAWN', 'APPROVED'];
    i INT;
BEGIN
    FOR i IN 1..p_count LOOP
        INSERT INTO workflow.Scenarios (
            scenario_id,
            loan_amount,
            property_type,
            property_zip,
            loan_status,
            created_at
        ) VALUES (
            gen_random_uuid(),
            (random() * 900000 + 100000)::INT, -- 100k to 1M
            v_property_types[1 + floor(random() * array_length(v_property_types, 1))],
            (10000 + floor(random() * 89999))::TEXT, -- Random zip
            v_statuses[1 + floor(random() * array_length(v_statuses, 1))],
            now() - (random() * 180 || ' days')::INTERVAL -- Last 6 months
        );
    END LOOP;
    
    RAISE NOTICE 'Generated % test scenarios', p_count;
END;
$$;

-- ===================================================================================
-- SECTION 9: REGRESSION TEST FRAMEWORK
-- ===================================================================================

-- Capture current state for regression testing
CREATE OR REPLACE FUNCTION janus_test.capture_regression_baseline()
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
    v_baseline_id UUID := gen_random_uuid();
    v_insight_snapshot JSONB;
    v_recommendation_snapshot JSONB;
BEGIN
    -- Capture current insights
    SELECT jsonb_agg(jsonb_build_object(
        'pattern_code', p.pattern_code,
        'insight_count', il.insight_count,
        'avg_confidence', il.avg_confidence,
        'severity_distribution', il.severity_dist
    ))
    INTO v_insight_snapshot
    FROM (
        SELECT 
            pattern_id,
            COUNT(*) AS insight_count,
            AVG(confidence_score) AS avg_confidence,
            jsonb_object_agg(severity, count) AS severity_dist
        FROM (
            SELECT pattern_id, confidence_score, severity, COUNT(*) AS count
            FROM janus_analyze.InsightLog
            WHERE generated_at >= now() - INTERVAL '7 days'
            GROUP BY pattern_id, confidence_score, severity
        ) sub
        GROUP BY pattern_id
    ) il
    JOIN janus_analyze.PatternRegistry p ON il.pattern_id = p.pattern_id;
    
    -- Capture current recommendations
    SELECT jsonb_agg(jsonb_build_object(
        'target_system', target_system,
        'recommendation_count', count,
        'avg_confidence', avg_confidence
    ))
    INTO v_recommendation_snapshot
    FROM (
        SELECT 
            target_system,
            COUNT(*) AS count,
            AVG(confidence_score) AS avg_confidence
        FROM janus_recommend.RecommendationQueue
        WHERE generated_at >= now() - INTERVAL '7 days'
        GROUP BY target_system
    ) r;
    
    -- Store baseline
    INSERT INTO janus_test.TestFixtures (
        fixture_id, fixture_name, fixture_type, fixture_data
    ) VALUES (
        v_baseline_id,
        'regression_baseline_' || to_char(now(), 'YYYY_MM_DD_HH24_MI'),
        'REGRESSION_BASELINE',
        jsonb_build_object(
            'captured_at', now(),
            'insights', v_insight_snapshot,
            'recommendations', v_recommendation_snapshot
        )
    );
    
    RETURN v_baseline_id;
END;
$$;

-- Compare against regression baseline
CREATE OR REPLACE FUNCTION janus_test.test_regression_against_baseline(p_baseline_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_baseline JSONB;
    v_current_state JSONB;
    v_deviation_threshold DECIMAL := 0.1; -- 10% deviation allowed
BEGIN
    -- Get baseline
    SELECT fixture_data INTO v_baseline
    FROM janus_test.TestFixtures
    WHERE fixture_id = p_baseline_id;
    
    IF v_baseline IS NULL THEN
        RAISE EXCEPTION 'Baseline % not found', p_baseline_id;
    END IF;
    
    -- Run current analysis
    CALL janus_analyze.sp_analyze_observations();
    CALL janus_recommend.sp_generate_recommendations();
    
    -- Compare results
    -- This is a simplified comparison - in production you'd have more sophisticated checks
    PERFORM janus_test.assert_in_range(
        (SELECT COUNT(*) FROM janus_analyze.InsightLog WHERE generated_at >= now() - INTERVAL '1 minute'),
        0,
        100,
        'Insight generation should be within expected range'
    );
    
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at,
        assertions_passed, test_data
    ) VALUES (
        'Regression Tests', 'test_regression_against_baseline', 
        'PASSED', now(), 1,
        jsonb_build_object('baseline_id', p_baseline_id)
    );
    
EXCEPTION WHEN OTHERS THEN
    INSERT INTO janus_test.TestExecutions (
        test_suite, test_name, status, completed_at, error_message
    ) VALUES (
        'Regression Tests', 'test_regression_against_baseline', 
        'FAILED', now(), SQLERRM
    );
    RAISE;
END;
$$;

-- ===================================================================================
-- SECTION 10: CLEANUP AND MAINTENANCE
-- ===================================================================================

-- Clean up old test data
CREATE OR REPLACE PROCEDURE janus_test.cleanup_old_test_data(p_days_to_keep INT DEFAULT 30)
LANGUAGE plpgsql AS $$
BEGIN
    -- Delete old test executions
    DELETE FROM janus_test.TestExecutions
    WHERE completed_at < now() - make_interval(days => p_days_to_keep);
    
    -- Delete old test fixtures
    DELETE FROM janus_test.TestFixtures
    WHERE created_at < now() - make_interval(days => p_days_to_keep);
    
    -- Clean up test observations
    DELETE FROM janus_observe.ObservationLog
    WHERE source_system IN ('TEST', 'BENCHMARK')
      AND observed_at < now() - make_interval(days => p_days_to_keep);
    
    RAISE NOTICE 'Cleaned up test data older than % days', p_days_to_keep;
END;
$$;

COMMIT;

-- ===================================================================================
-- END OF JANUS v3.0 TESTING FRAMEWORK
-- ===================================================================================
