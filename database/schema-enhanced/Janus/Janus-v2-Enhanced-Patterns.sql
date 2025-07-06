-- ===================================================================================
-- Janus v2.0: Enhanced Pattern Detection Algorithms
--
-- Author:         Assistant
-- Date:           2025-01-06
--
-- Purpose:        Advanced pattern detection capabilities for Janus including:
--                 - Anomaly detection using statistical methods
--                 - Trend analysis with time series decomposition
--                 - Multi-dimensional correlation analysis
--                 - Predictive pattern recognition
-- ===================================================================================

BEGIN;

-- ===================================================================================
-- SECTION 1: ADVANCED PATTERN TYPES
-- ===================================================================================

-- Add new pattern types to the registry
INSERT INTO janus_analyze.PatternRegistry (pattern_code, pattern_name, description, analysis_type, target_event_types, target_entities, analysis_logic) VALUES
(
    'LENDER_PERFORMANCE_ANOMALY',
    'Lender Performance Anomaly Detection',
    'Detects sudden changes in individual lender performance metrics that may indicate issues with their programs or operations.',
    'ANOMALY_DETECTION',
    ARRAY['OFFER_ACCEPTED', 'OFFER_REJECTED', 'SCENARIO_FUNDED'],
    ARRAY['lending.Lenders', 'workflow.Offers'],
    '{"function": "janus_analyze.fn_detect_lender_anomalies", "sensitivity": 2.5}'
),
(
    'SEASONAL_VOLUME_TRENDS',
    'Seasonal Volume Pattern Analysis',
    'Identifies seasonal patterns in loan volume and types to optimize resource allocation and program offerings.',
    'TREND_ANALYSIS',
    ARRAY['SCENARIO_CREATED', 'SCENARIO_FUNDED'],
    ARRAY['workflow.Scenarios'],
    '{"function": "janus_analyze.fn_analyze_seasonal_trends", "window_days": 365}'
),
(
    'CROSS_DIMENSIONAL_RISK',
    'Cross-Dimensional Risk Correlation',
    'Analyzes correlations between multiple risk factors (geography, loan type, borrower profile) to identify hidden risk patterns.',
    'CORRELATION',
    ARRAY['SCENARIO_REJECTED', 'OFFER_REJECTED'],
    ARRAY['workflow.Scenarios', 'lending.Programs', 'geo.ZipCodes'],
    '{"function": "janus_analyze.fn_correlate_multidimensional_risk"}'
),
(
    'PREDICTIVE_FUNDING_SUCCESS',
    'Predictive Funding Success Pattern',
    'Uses machine learning techniques to identify early indicators of funding success or failure.',
    'CORRELATION',
    ARRAY['SCENARIO_CREATED', 'SCENARIO_STATUS_CHANGED', 'SCENARIO_FUNDED'],
    ARRAY['workflow.Scenarios', 'workflow.ScenarioHistory'],
    '{"function": "janus_analyze.fn_predict_funding_success"}'
)
ON CONFLICT (pattern_code) DO NOTHING;

-- ===================================================================================
-- SECTION 2: ANOMALY DETECTION FUNCTIONS
-- ===================================================================================

-- Function to detect anomalies in lender performance using Z-score analysis
CREATE OR REPLACE FUNCTION janus_analyze.fn_detect_lender_anomalies(p_pattern janus_analyze.PatternRegistry)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_lender_anomaly RECORD;
    v_observation_ids UUID[];
    v_sensitivity DECIMAL;
BEGIN
    v_sensitivity := COALESCE((p_pattern.analysis_logic->>'sensitivity')::DECIMAL, 2.5);
    
    -- Calculate rolling statistics for each lender
    WITH lender_metrics AS (
        SELECT
            l.lender_id,
            l.lender_name,
            date_trunc('day', obs.observed_at) AS metric_date,
            COUNT(*) FILTER (WHERE obs.event_type = 'OFFER_ACCEPTED') AS daily_acceptances,
            COUNT(*) FILTER (WHERE obs.event_type = 'OFFER_REJECTED') AS daily_rejections,
            COUNT(*) FILTER (WHERE obs.event_type = 'SCENARIO_FUNDED') AS daily_fundings,
            ARRAY_AGG(obs.observation_id) AS observation_ids
        FROM janus_observe.ObservationLog obs
        JOIN workflow.Offers o ON (obs.event_payload->>'offer_id')::UUID = o.offer_id
        JOIN lending.Lenders l ON o.lender_id = l.lender_id
        WHERE obs.processing_status = 'PENDING'
          AND obs.observed_at >= now() - INTERVAL '30 days'
        GROUP BY l.lender_id, l.lender_name, date_trunc('day', obs.observed_at)
    ),
    lender_stats AS (
        SELECT
            lender_id,
            lender_name,
            metric_date,
            daily_acceptances,
            daily_rejections,
            daily_fundings,
            observation_ids,
            -- Calculate rolling averages and standard deviations
            AVG(daily_acceptances) OVER w AS avg_acceptances,
            STDDEV(daily_acceptances) OVER w AS stddev_acceptances,
            AVG(daily_fundings) OVER w AS avg_fundings,
            STDDEV(daily_fundings) OVER w AS stddev_fundings,
            -- Calculate acceptance rate
            CASE 
                WHEN (daily_acceptances + daily_rejections) > 0 
                THEN daily_acceptances::DECIMAL / (daily_acceptances + daily_rejections)
                ELSE NULL
            END AS acceptance_rate,
            AVG(CASE 
                WHEN (daily_acceptances + daily_rejections) > 0 
                THEN daily_acceptances::DECIMAL / (daily_acceptances + daily_rejections)
                ELSE NULL
            END) OVER w AS avg_acceptance_rate,
            STDDEV(CASE 
                WHEN (daily_acceptances + daily_rejections) > 0 
                THEN daily_acceptances::DECIMAL / (daily_acceptances + daily_rejections)
                ELSE NULL
            END) OVER w AS stddev_acceptance_rate
        FROM lender_metrics
        WINDOW w AS (PARTITION BY lender_id ORDER BY metric_date ROWS BETWEEN 14 PRECEDING AND 1 PRECEDING)
    ),
    anomalies AS (
        SELECT
            lender_id,
            lender_name,
            metric_date,
            observation_ids,
            -- Calculate Z-scores
            CASE 
                WHEN stddev_acceptances > 0 
                THEN ABS(daily_acceptances - avg_acceptances) / stddev_acceptances
                ELSE 0
            END AS acceptance_zscore,
            CASE 
                WHEN stddev_fundings > 0 
                THEN ABS(daily_fundings - avg_fundings) / stddev_fundings
                ELSE 0
            END AS funding_zscore,
            CASE 
                WHEN stddev_acceptance_rate > 0 AND acceptance_rate IS NOT NULL
                THEN ABS(acceptance_rate - avg_acceptance_rate) / stddev_acceptance_rate
                ELSE 0
            END AS acceptance_rate_zscore,
            daily_acceptances,
            avg_acceptances,
            daily_fundings,
            avg_fundings,
            acceptance_rate,
            avg_acceptance_rate
        FROM lender_stats
        WHERE metric_date >= now()::date - INTERVAL '7 days'
    )
    SELECT * FROM anomalies
    WHERE acceptance_zscore > v_sensitivity
       OR funding_zscore > v_sensitivity
       OR acceptance_rate_zscore > v_sensitivity
    ORDER BY GREATEST(acceptance_zscore, funding_zscore, acceptance_rate_zscore) DESC
    LIMIT 1
    INTO v_lender_anomaly;
    
    IF v_lender_anomaly.lender_id IS NOT NULL THEN
        INSERT INTO janus_analyze.InsightLog (
            pattern_id,
            insight_summary,
            insight_details,
            confidence_score,
            severity,
            supporting_observation_ids
        ) VALUES (
            p_pattern.pattern_id,
            format('Anomalous behavior detected for lender %s on %s', 
                   v_lender_anomaly.lender_name, 
                   v_lender_anomaly.metric_date),
            jsonb_build_object(
                'lender_id', v_lender_anomaly.lender_id,
                'lender_name', v_lender_anomaly.lender_name,
                'anomaly_date', v_lender_anomaly.metric_date,
                'acceptance_zscore', round(v_lender_anomaly.acceptance_zscore, 2),
                'funding_zscore', round(v_lender_anomaly.funding_zscore, 2),
                'acceptance_rate_zscore', round(v_lender_anomaly.acceptance_rate_zscore, 2),
                'daily_metrics', jsonb_build_object(
                    'acceptances', v_lender_anomaly.daily_acceptances,
                    'expected_acceptances', round(v_lender_anomaly.avg_acceptances, 1),
                    'fundings', v_lender_anomaly.daily_fundings,
                    'expected_fundings', round(v_lender_anomaly.avg_fundings, 1),
                    'acceptance_rate', round(v_lender_anomaly.acceptance_rate, 3),
                    'expected_acceptance_rate', round(v_lender_anomaly.avg_acceptance_rate, 3)
                )
            ),
            LEAST(1.0, GREATEST(v_lender_anomaly.acceptance_zscore, 
                               v_lender_anomaly.funding_zscore,
                               v_lender_anomaly.acceptance_rate_zscore) / 4),
            CASE
                WHEN GREATEST(v_lender_anomaly.acceptance_zscore, 
                             v_lender_anomaly.funding_zscore,
                             v_lender_anomaly.acceptance_rate_zscore) > 4 THEN 'CRITICAL'
                WHEN GREATEST(v_lender_anomaly.acceptance_zscore, 
                             v_lender_anomaly.funding_zscore,
                             v_lender_anomaly.acceptance_rate_zscore) > 3 THEN 'HIGH'
                ELSE 'MEDIUM'
            END,
            v_lender_anomaly.observation_ids
        );
    END IF;
END;
$$;

-- ===================================================================================
-- SECTION 3: TREND ANALYSIS FUNCTIONS
-- ===================================================================================

-- Function to analyze seasonal trends in loan volumes and characteristics
CREATE OR REPLACE FUNCTION janus_analyze.fn_analyze_seasonal_trends(p_pattern janus_analyze.PatternRegistry)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_trend_data JSONB;
    v_observation_ids UUID[];
    v_window_days INT;
    v_seasonality_strength DECIMAL;
BEGIN
    v_window_days := COALESCE((p_pattern.analysis_logic->>'window_days')::INT, 365);
    
    -- Analyze volume patterns with time series decomposition
    WITH daily_volumes AS (
        SELECT
            date_trunc('day', obs.observed_at) AS volume_date,
            COUNT(*) FILTER (WHERE obs.event_type = 'SCENARIO_CREATED') AS scenarios_created,
            COUNT(*) FILTER (WHERE obs.event_type = 'SCENARIO_FUNDED') AS scenarios_funded,
            AVG((s.loan_amount)::DECIMAL) AS avg_loan_amount,
            ARRAY_AGG(DISTINCT obs.observation_id) AS observation_ids
        FROM janus_observe.ObservationLog obs
        JOIN workflow.Scenarios s ON (obs.event_payload->>'scenario_id')::UUID = s.scenario_id
        WHERE obs.processing_status = 'PENDING'
          AND obs.observed_at >= now() - make_interval(days => v_window_days)
        GROUP BY date_trunc('day', obs.observed_at)
    ),
    seasonal_analysis AS (
        SELECT
            EXTRACT(DOW FROM volume_date) AS day_of_week,
            EXTRACT(DAY FROM volume_date) AS day_of_month,
            EXTRACT(MONTH FROM volume_date) AS month,
            AVG(scenarios_created) AS avg_created,
            AVG(scenarios_funded) AS avg_funded,
            AVG(avg_loan_amount) AS avg_loan_size,
            STDDEV(scenarios_created) AS stddev_created,
            STDDEV(scenarios_funded) AS stddev_funded,
            COUNT(*) AS sample_size
        FROM daily_volumes
        GROUP BY EXTRACT(DOW FROM volume_date), 
                 EXTRACT(DAY FROM volume_date), 
                 EXTRACT(MONTH FROM volume_date)
    ),
    pattern_strength AS (
        SELECT
            -- Calculate coefficient of variation for each grouping
            AVG(CASE WHEN avg_created > 0 THEN stddev_created / avg_created ELSE 0 END) AS weekly_cv,
            AVG(CASE WHEN avg_funded > 0 THEN stddev_funded / avg_funded ELSE 0 END) AS monthly_cv,
            -- Identify peak periods
            (SELECT jsonb_agg(jsonb_build_object(
                'month', month,
                'avg_volume', round(avg_created, 1)
            ) ORDER BY avg_created DESC) FROM (
                SELECT month, AVG(avg_created) as avg_created
                FROM seasonal_analysis
                GROUP BY month
                ORDER BY AVG(avg_created) DESC
                LIMIT 3
            ) top_months) AS peak_months,
            -- Identify trough periods
            (SELECT jsonb_agg(jsonb_build_object(
                'month', month,
                'avg_volume', round(avg_created, 1)
            ) ORDER BY avg_created) FROM (
                SELECT month, AVG(avg_created) as avg_created
                FROM seasonal_analysis
                GROUP BY month
                ORDER BY AVG(avg_created)
                LIMIT 3
            ) bottom_months) AS trough_months
        FROM seasonal_analysis
    )
    SELECT 
        1 - LEAST(weekly_cv, monthly_cv),
        jsonb_build_object(
            'analysis_window_days', v_window_days,
            'weekly_pattern_strength', round(1 - weekly_cv, 3),
            'monthly_pattern_strength', round(1 - monthly_cv, 3),
            'peak_months', peak_months,
            'trough_months', trough_months,
            'recommendation', CASE
                WHEN (1 - LEAST(weekly_cv, monthly_cv)) > 0.7 THEN
                    'Strong seasonal patterns detected. Consider adjusting staffing and resource allocation.'
                WHEN (1 - LEAST(weekly_cv, monthly_cv)) > 0.5 THEN
                    'Moderate seasonal patterns detected. Monitor for planning purposes.'
                ELSE
                    'Weak seasonal patterns. Volume is relatively consistent year-round.'
            END
        ),
        ARRAY(SELECT DISTINCT unnest(observation_ids) FROM daily_volumes LIMIT 1000)
    INTO v_seasonality_strength, v_trend_data, v_observation_ids
    FROM pattern_strength;
    
    IF v_seasonality_strength > 0.5 THEN
        INSERT INTO janus_analyze.InsightLog (
            pattern_id,
            insight_summary,
            insight_details,
            confidence_score,
            severity,
            supporting_observation_ids
        ) VALUES (
            p_pattern.pattern_id,
            format('Seasonal volume patterns detected with %s%% pattern strength',
                   round(v_seasonality_strength * 100)),
            v_trend_data,
            v_seasonality_strength,
            CASE
                WHEN v_seasonality_strength > 0.8 THEN 'HIGH'
                WHEN v_seasonality_strength > 0.6 THEN 'MEDIUM'
                ELSE 'LOW'
            END,
            v_observation_ids
        );
    END IF;
END;
$$;

-- ===================================================================================
-- SECTION 4: MULTI-DIMENSIONAL CORRELATION FUNCTIONS
-- ===================================================================================

-- Function to analyze cross-dimensional risk correlations
CREATE OR REPLACE FUNCTION janus_analyze.fn_correlate_multidimensional_risk(p_pattern janus_analyze.PatternRegistry)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_risk_correlation JSONB;
    v_observation_ids UUID[];
    v_max_risk_score DECIMAL;
BEGIN
    -- Analyze risk factors across multiple dimensions
    WITH risk_factors AS (
        SELECT
            s.scenario_id,
            s.loan_status,
            s.loan_amount,
            s.property_type,
            p.program_name,
            p.min_fico,
            p.max_ltv,
            z.state_code,
            z.county,
            z.median_income,
            CASE 
                WHEN s.loan_status IN ('REJECTED', 'WITHDRAWN') THEN 1
                WHEN s.loan_status = 'FUNDED' THEN 0
                ELSE NULL
            END AS risk_outcome,
            obs.observation_id
        FROM janus_observe.ObservationLog obs
        JOIN workflow.Scenarios s ON (obs.event_payload->>'scenario_id')::UUID = s.scenario_id
        LEFT JOIN workflow.Offers o ON o.scenario_id = s.scenario_id AND o.is_selected = true
        LEFT JOIN lending.Programs p ON o.program_id = p.program_id
        LEFT JOIN geo.ZipCodes z ON s.property_zip = z.zip_code
        WHERE obs.event_type IN ('SCENARIO_REJECTED', 'OFFER_REJECTED', 'SCENARIO_FUNDED')
          AND obs.processing_status = 'PENDING'
          AND obs.observed_at >= now() - INTERVAL '60 days'
          AND s.loan_status IN ('REJECTED', 'WITHDRAWN', 'FUNDED')
    ),
    risk_patterns AS (
        SELECT
            -- Geographic risk patterns
            state_code,
            property_type,
            CASE 
                WHEN loan_amount > 1000000 THEN 'JUMBO'
                WHEN loan_amount > 647200 THEN 'HIGH_BALANCE'
                ELSE 'CONFORMING'
            END AS loan_tier,
            COUNT(*) AS total_scenarios,
            AVG(risk_outcome) AS failure_rate,
            ARRAY_AGG(observation_id) AS observation_ids
        FROM risk_factors
        WHERE risk_outcome IS NOT NULL
        GROUP BY state_code, property_type, 
                 CASE 
                     WHEN loan_amount > 1000000 THEN 'JUMBO'
                     WHEN loan_amount > 647200 THEN 'HIGH_BALANCE'
                     ELSE 'CONFORMING'
                 END
        HAVING COUNT(*) >= 10 -- Minimum sample size
    ),
    high_risk_combinations AS (
        SELECT
            state_code,
            property_type,
            loan_tier,
            total_scenarios,
            failure_rate,
            observation_ids,
            -- Calculate risk score based on failure rate and volume
            failure_rate * LN(total_scenarios + 1) AS risk_score
        FROM risk_patterns
        WHERE failure_rate > 0.3 -- 30% failure threshold
        ORDER BY failure_rate * LN(total_scenarios + 1) DESC
        LIMIT 5
    )
    SELECT
        MAX(risk_score),
        jsonb_agg(jsonb_build_object(
            'state', state_code,
            'property_type', property_type,
            'loan_tier', loan_tier,
            'scenarios_analyzed', total_scenarios,
            'failure_rate', round(failure_rate * 100, 1),
            'risk_score', round(risk_score, 2)
        ) ORDER BY risk_score DESC),
        ARRAY(SELECT DISTINCT unnest(observation_ids) FROM high_risk_combinations LIMIT 1000)
    INTO v_max_risk_score, v_risk_correlation, v_observation_ids
    FROM high_risk_combinations;
    
    IF v_max_risk_score > 1.0 THEN
        INSERT INTO janus_analyze.InsightLog (
            pattern_id,
            insight_summary,
            insight_details,
            confidence_score,
            severity,
            supporting_observation_ids
        ) VALUES (
            p_pattern.pattern_id,
            'High-risk scenario combinations identified across multiple dimensions',
            jsonb_build_object(
                'high_risk_combinations', v_risk_correlation,
                'analysis_window', '60 days',
                'recommendation', 'Review underwriting criteria for these specific combinations'
            ),
            LEAST(1.0, v_max_risk_score / 3),
            CASE
                WHEN v_max_risk_score > 2.5 THEN 'CRITICAL'
                WHEN v_max_risk_score > 1.5 THEN 'HIGH'
                ELSE 'MEDIUM'
            END,
            v_observation_ids
        );
    END IF;
END;
$$;

-- ===================================================================================
-- SECTION 5: PREDICTIVE PATTERN FUNCTIONS
-- ===================================================================================

-- Function to predict funding success based on early indicators
CREATE OR REPLACE FUNCTION janus_analyze.fn_predict_funding_success(p_pattern janus_analyze.PatternRegistry)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_prediction_accuracy DECIMAL;
    v_early_indicators JSONB;
    v_observation_ids UUID[];
BEGIN
    -- Analyze early lifecycle patterns that correlate with eventual funding success
    WITH scenario_lifecycle AS (
        SELECT
            s.scenario_id,
            s.loan_status,
            s.created_at,
            -- Calculate time to first status change
            MIN(sh.changed_at) FILTER (WHERE sh.loan_status != 'CREATED') - s.created_at AS time_to_first_action,
            -- Count status changes in first 24 hours
            COUNT(sh.*) FILTER (WHERE sh.changed_at <= s.created_at + INTERVAL '24 hours') AS status_changes_24h,
            -- Check if offers were received quickly
            MIN(o.created_at) FILTER (WHERE o.offer_id IS NOT NULL) - s.created_at AS time_to_first_offer,
            -- Count of offers received
            COUNT(DISTINCT o.offer_id) AS offer_count,
            -- Import quality score
            qs.overall_score AS import_quality,
            CASE 
                WHEN s.loan_status = 'FUNDED' THEN 1
                WHEN s.loan_status IN ('REJECTED', 'WITHDRAWN') THEN 0
                ELSE NULL
            END AS success_outcome,
            ARRAY_AGG(DISTINCT obs.observation_id) AS observation_ids
        FROM janus_observe.ObservationLog obs
        JOIN workflow.Scenarios s ON (obs.event_payload->>'scenario_id')::UUID = s.scenario_id
        LEFT JOIN workflow.ScenarioHistory sh ON s.scenario_id = sh.scenario_id
        LEFT JOIN workflow.Offers o ON s.scenario_id = o.scenario_id
        LEFT JOIN universal_import.QualityScores qs ON s.import_id = qs.import_id
        WHERE obs.processing_status = 'PENDING'
          AND obs.observed_at >= now() - INTERVAL '90 days'
          AND s.loan_status IN ('FUNDED', 'REJECTED', 'WITHDRAWN')
        GROUP BY s.scenario_id, s.loan_status, s.created_at, qs.overall_score
    ),
    indicator_analysis AS (
        SELECT
            -- Quick first action (< 1 hour) as positive indicator
            AVG(success_outcome) FILTER (WHERE time_to_first_action < INTERVAL '1 hour') AS quick_action_success_rate,
            AVG(success_outcome) FILTER (WHERE time_to_first_action >= INTERVAL '1 hour') AS slow_action_success_rate,
            -- Multiple early status changes as positive indicator
            AVG(success_outcome) FILTER (WHERE status_changes_24h >= 3) AS high_activity_success_rate,
            AVG(success_outcome) FILTER (WHERE status_changes_24h < 3) AS low_activity_success_rate,
            -- Quick offer generation as positive indicator
            AVG(success_outcome) FILTER (WHERE time_to_first_offer < INTERVAL '2 hours') AS quick_offer_success_rate,
            AVG(success_outcome) FILTER (WHERE time_to_first_offer >= INTERVAL '2 hours' OR time_to_first_offer IS NULL) AS slow_offer_success_rate,
            -- High import quality as positive indicator
            AVG(success_outcome) FILTER (WHERE import_quality >= 0.8) AS high_quality_success_rate,
            AVG(success_outcome) FILTER (WHERE import_quality < 0.8) AS low_quality_success_rate,
            COUNT(*) AS total_scenarios,
            ARRAY_AGG(observation_ids) AS all_observation_ids
        FROM scenario_lifecycle
        WHERE success_outcome IS NOT NULL
    ),
    prediction_model AS (
        SELECT
            -- Calculate lift for each indicator
            GREATEST(
                quick_action_success_rate - slow_action_success_rate,
                high_activity_success_rate - low_activity_success_rate,
                quick_offer_success_rate - slow_offer_success_rate,
                high_quality_success_rate - low_quality_success_rate
            ) AS max_indicator_lift,
            jsonb_build_object(
                'quick_action_lift', round((quick_action_success_rate - slow_action_success_rate) * 100, 1),
                'high_activity_lift', round((high_activity_success_rate - low_activity_success_rate) * 100, 1),
                'quick_offer_lift', round((quick_offer_success_rate - slow_offer_success_rate) * 100, 1),
                'high_quality_lift', round((high_quality_success_rate - low_quality_success_rate) * 100, 1),
                'baseline_success_rate', round(AVG(quick_action_success_rate + slow_action_success_rate) / 2 * 100, 1)
            ) AS indicator_impacts,
            all_observation_ids
        FROM indicator_analysis
    )
    SELECT
        max_indicator_lift,
        indicator_impacts,
        ARRAY(SELECT DISTINCT unnest(all_observation_ids) LIMIT 1000)
    INTO v_prediction_accuracy, v_early_indicators, v_observation_ids
    FROM prediction_model;
    
    IF v_prediction_accuracy > 0.15 THEN -- 15% lift threshold
        INSERT INTO janus_analyze.InsightLog (
            pattern_id,
            insight_summary,
            insight_details,
            confidence_score,
            severity,
            supporting_observation_ids
        ) VALUES (
            p_pattern.pattern_id,
            format('Early indicators show %s%% predictive lift for funding success',
                   round(v_prediction_accuracy * 100)),
            jsonb_build_object(
                'early_indicators', v_early_indicators,
                'analysis_window', '90 days',
                'recommendations', jsonb_build_array(
                    'Prioritize scenarios with quick initial actions',
                    'Focus on maintaining high import quality',
                    'Optimize for rapid offer generation',
                    'Monitor early lifecycle activity as success predictor'
                )
            ),
            LEAST(1.0, v_prediction_accuracy * 3),
            CASE
                WHEN v_prediction_accuracy > 0.3 THEN 'HIGH'
                WHEN v_prediction_accuracy > 0.2 THEN 'MEDIUM'
                ELSE 'LOW'
            END,
            v_observation_ids
        );
    END IF;
END;
$$;

-- ===================================================================================
-- SECTION 6: RECOMMENDATION ENHANCEMENT FOR NEW PATTERNS
-- ===================================================================================

-- Add recommendation generators for new pattern types
CREATE OR REPLACE FUNCTION janus_recommend.fn_formulate_anomaly_rec(p_insight RECORD)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_anomaly_data JSONB;
BEGIN
    v_anomaly_data := p_insight.insight_details;
    
    INSERT INTO janus_recommend.RecommendationQueue (
        insight_id,
        target_system,
        target_component,
        recommendation_text,
        justification,
        proposed_change,
        estimated_impact,
        confidence_score
    ) VALUES (
        p_insight.insight_id,
        'ATHENA',
        'lending.Lenders',
        format('Investigate anomalous behavior for lender %s. Unusual activity detected on %s',
               v_anomaly_data->>'lender_name',
               v_anomaly_data->>'anomaly_date'),
        'Statistical analysis shows significant deviation from normal operating patterns',
        jsonb_build_object(
            'action', 'INVESTIGATE_LENDER',
            'lender_id', v_anomaly_data->>'lender_id',
            'suggested_actions', jsonb_build_array(
                'Contact lender to verify operational status',
                'Review recent program changes',
                'Temporarily adjust matching weights',
                'Monitor closely for next 7 days'
            )
        ),
        'Prevent potential service disruptions and maintain platform reliability',
        p_insight.confidence_score
    );
END;
$$;

-- Update the recommendation generation procedure to handle new patterns
CREATE OR REPLACE PROCEDURE janus_recommend.sp_generate_recommendations()
LANGUAGE plpgsql AS $$
DECLARE
    v_insight RECORD;
BEGIN
    FOR v_insight IN
        SELECT i.*, p.pattern_code 
        FROM janus_analyze.InsightLog i
        JOIN janus_analyze.PatternRegistry p ON i.pattern_id = p.pattern_id
        WHERE i.recommendation_status = 'PENDING'
          AND i.confidence_score >= 0.8
          AND i.severity IN ('HIGH', 'CRITICAL')
    LOOP
        -- Route to appropriate recommendation generator based on pattern
        CASE v_insight.pattern_code
            WHEN 'ATHENA_ACCURACY_DRIFT' THEN
                PERFORM janus_recommend.fn_formulate_athena_tuning_rec(v_insight);
            WHEN 'WORKFLOW_BOTTLENECK' THEN
                PERFORM janus_recommend.fn_formulate_workflow_optimization_rec(v_insight);
            WHEN 'HERMES_QUALITY_IMPACT' THEN
                PERFORM janus_recommend.fn_formulate_data_quality_rec(v_insight);
            WHEN 'LENDER_PERFORMANCE_ANOMALY' THEN
                PERFORM janus_recommend.fn_formulate_anomaly_rec(v_insight);
            ELSE
                -- Generic recommendation for new pattern types
                INSERT INTO janus_recommend.RecommendationQueue (
                    insight_id,
                    target_system,
                    target_component,
                    recommendation_text,
                    justification,
                    proposed_change,
                    estimated_impact,
                    confidence_score
                ) VALUES (
                    v_insight.insight_id,
                    'PLATFORM',
                    'janus_analyze.PatternRegistry',
                    v_insight.insight_summary,
                    'Automated insight requires manual review',
                    v_insight.insight_details,
                    'To be determined after manual analysis',
                    v_insight.confidence_score
                );
        END CASE;
        
        RAISE NOTICE 'Generated recommendation for insight: %', v_insight.insight_summary;
        
        -- Update the insight log
        UPDATE janus_analyze.InsightLog
        SET recommendation_status = 'GENERATED', recommended_at = now()
        WHERE insight_id = v_insight.insight_id;
    END LOOP;
END;
$$;

COMMIT;

-- ===================================================================================
-- END OF JANUS v2.0 ENHANCED PATTERNS
-- ===================================================================================
