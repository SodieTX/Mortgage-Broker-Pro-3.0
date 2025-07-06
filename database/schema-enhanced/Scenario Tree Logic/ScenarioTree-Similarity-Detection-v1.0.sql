-- ============================================================
-- QUESTION SIMILARITY DETECTION AND CONCEPT MANAGEMENT
-- Prevents duplicate questions and ensures consistency
-- ============================================================

BEGIN;

-- Enable required extensions for text similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- ============================================================
-- CENTRALIZED CONCEPT DICTIONARY
-- ============================================================

-- Core concept registry (the single source of truth)
CREATE TABLE tree_core.concept_dictionary (
    concept_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_code       TEXT UNIQUE NOT NULL, -- e.g., 'ANNUAL_INCOME', 'PROPERTY_VALUE'
    concept_name       TEXT NOT NULL,
    concept_category   TEXT NOT NULL,
    definition         TEXT NOT NULL,
    -- Aliases and variations
    aliases            TEXT[] DEFAULT '{}',
    common_phrasings   TEXT[] DEFAULT '{}', -- Different ways to ask the same thing
    -- Metadata
    data_type          TEXT NOT NULL,
    validation_rules   JSONB DEFAULT '{}',
    -- Usage tracking
    usage_count        INT DEFAULT 0,
    last_used          TIMESTAMPTZ,
    -- Audit
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by         UUID NOT NULL,
    approved_at        TIMESTAMPTZ,
    approved_by        UUID,
    is_active          BOOLEAN DEFAULT TRUE,
    -- Constraints
    CONSTRAINT valid_concept_code CHECK (concept_code ~ '^[A-Z][A-Z0-9_]*$')
);

-- Link questions to concepts
ALTER TABLE tree_core.questions 
ADD COLUMN concept_id UUID REFERENCES tree_core.concept_dictionary(concept_id),
ADD COLUMN similarity_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN similarity_score NUMERIC(3,2);

-- Create index for concept lookups
CREATE INDEX idx_questions_concept ON tree_core.questions(concept_id);

-- ============================================================
-- SIMILARITY DETECTION FRAMEWORK
-- ============================================================

-- Store detected similarities for review
CREATE TABLE tree_core.question_similarities (
    similarity_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id        UUID REFERENCES tree_core.questions(question_id),
    similar_to_id      UUID REFERENCES tree_core.questions(question_id),
    similarity_type    TEXT CHECK (similarity_type IN (
        'EXACT_MATCH',      -- Same text
        'SEMANTIC_MATCH',   -- Same meaning
        'PARTIAL_MATCH',    -- Overlapping concepts
        'POTENTIAL_MATCH'   -- Needs review
    )),
    -- Similarity metrics
    text_similarity    NUMERIC(3,2), -- 0.00 to 1.00
    semantic_score     NUMERIC(3,2),
    confidence_score   NUMERIC(3,2),
    -- Resolution
    resolution_status  TEXT DEFAULT 'PENDING' CHECK (resolution_status IN (
        'PENDING', 'APPROVED', 'REJECTED', 'MERGED', 'IGNORED'
    )),
    resolved_at        TIMESTAMPTZ,
    resolved_by        UUID,
    resolution_notes   TEXT,
    -- Detection metadata
    detected_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    detection_method   TEXT,
    -- Ensure we don't duplicate similarity records
    UNIQUE(question_id, similar_to_id),
    CONSTRAINT different_questions CHECK (question_id != similar_to_id)
);

-- Create indexes for similarity queries
CREATE INDEX idx_similarities_pending ON tree_core.question_similarities(resolution_status) 
WHERE resolution_status = 'PENDING';

CREATE INDEX idx_similarities_scores ON tree_core.question_similarities(text_similarity DESC, confidence_score DESC);

-- ============================================================
-- FLEXIBLE TAGGING SYSTEM
-- ============================================================

-- Tag registry
CREATE TABLE tree_core.tags (
    tag_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name           TEXT UNIQUE NOT NULL,
    tag_category       TEXT,
    description        TEXT,
    color_hex          TEXT DEFAULT '#6B7280',
    icon               TEXT,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by         UUID NOT NULL,
    usage_count        INT DEFAULT 0
);

-- Many-to-many relationship for question tags
CREATE TABLE tree_core.question_tags (
    question_id        UUID REFERENCES tree_core.questions(question_id),
    tag_id             UUID REFERENCES tree_core.tags(tag_id),
    tagged_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    tagged_by          UUID NOT NULL,
    PRIMARY KEY (question_id, tag_id)
);

-- Create indexes for tag queries
CREATE INDEX idx_question_tags_question ON tree_core.question_tags(question_id);
CREATE INDEX idx_question_tags_tag ON tree_core.question_tags(tag_id);

-- ============================================================
-- SIMILARITY DETECTION FUNCTIONS
-- ============================================================

-- Advanced text similarity detection
CREATE OR REPLACE FUNCTION tree_core.calculate_text_similarity(
    p_text1 TEXT,
    p_text2 TEXT
) RETURNS NUMERIC AS $$
DECLARE
    v_similarity NUMERIC;
    v_trigram_sim NUMERIC;
    v_levenshtein_sim NUMERIC;
    v_metaphone_sim NUMERIC;
BEGIN
    -- Normalize texts
    p_text1 := lower(trim(p_text1));
    p_text2 := lower(trim(p_text2));
    
    -- Calculate different similarity metrics
    v_trigram_sim := similarity(p_text1, p_text2);
    
    -- Levenshtein distance normalized to 0-1
    v_levenshtein_sim := 1.0 - (levenshtein(p_text1, p_text2)::NUMERIC / 
                                GREATEST(length(p_text1), length(p_text2)));
    
    -- Metaphone similarity for phonetic matching
    v_metaphone_sim := CASE 
        WHEN metaphone(p_text1, 10) = metaphone(p_text2, 10) THEN 1.0
        ELSE 0.5
    END;
    
    -- Weighted average
    v_similarity := (v_trigram_sim * 0.5 + v_levenshtein_sim * 0.3 + v_metaphone_sim * 0.2);
    
    RETURN ROUND(v_similarity, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Detect similar questions when creating new ones
CREATE OR REPLACE FUNCTION tree_core.detect_similar_questions(
    p_question_text TEXT,
    p_concept_category TEXT DEFAULT NULL,
    p_threshold NUMERIC DEFAULT 0.7
) RETURNS TABLE (
    question_id UUID,
    question_code TEXT,
    question_text TEXT,
    similarity_score NUMERIC,
    concept_name TEXT,
    match_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH text_analysis AS (
        SELECT 
            q.question_id,
            q.question_code,
            q.question_scope,
            COALESCE(q.display_label, q.question_code) as question_text,
            tree_core.calculate_text_similarity(
                p_question_text, 
                COALESCE(q.display_label, q.question_code)
            ) as text_score,
            c.concept_name,
            c.concept_category
        FROM tree_core.questions q
        LEFT JOIN tree_core.concept_dictionary c ON q.concept_id = c.concept_id
        WHERE q.status = 'ACTIVE'
    ),
    categorized_matches AS (
        SELECT 
            ta.*,
            CASE 
                WHEN ta.text_score >= 0.95 THEN 'EXACT_MATCH'
                WHEN ta.text_score >= 0.85 THEN 'SEMANTIC_MATCH'
                WHEN ta.text_score >= 0.70 THEN 'PARTIAL_MATCH'
                ELSE 'POTENTIAL_MATCH'
            END as match_type
        FROM text_analysis ta
        WHERE ta.text_score >= p_threshold
           OR (p_concept_category IS NOT NULL AND ta.concept_category = p_concept_category)
    )
    SELECT 
        cm.question_id,
        cm.question_code,
        cm.question_text,
        cm.text_score as similarity_score,
        cm.concept_name,
        cm.match_type
    FROM categorized_matches cm
    ORDER BY cm.text_score DESC, cm.question_code
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Automatically check for similarities when creating questions
CREATE OR REPLACE FUNCTION tree_core.check_question_similarity()
RETURNS TRIGGER AS $$
DECLARE
    v_similar_count INT;
    v_top_match RECORD;
BEGIN
    -- Only check for new questions
    IF TG_OP = 'INSERT' THEN
        -- Find similar questions
        SELECT COUNT(*) INTO v_similar_count
        FROM tree_core.detect_similar_questions(
            COALESCE(NEW.display_label, NEW.question_code),
            NULL,
            0.8
        );
        
        IF v_similar_count > 0 THEN
            -- Get the top match
            SELECT * INTO v_top_match
            FROM tree_core.detect_similar_questions(
                COALESCE(NEW.display_label, NEW.question_code),
                NULL,
                0.8
            )
            LIMIT 1;
            
            -- Record the similarity for review
            INSERT INTO tree_core.question_similarities (
                question_id,
                similar_to_id,
                similarity_type,
                text_similarity,
                confidence_score,
                detection_method
            ) VALUES (
                NEW.question_id,
                v_top_match.question_id,
                v_top_match.match_type,
                v_top_match.similarity_score,
                v_top_match.similarity_score,
                'AUTO_DETECTION'
            ) ON CONFLICT (question_id, similar_to_id) DO NOTHING;
            
            -- Update the question with similarity info
            NEW.similarity_score := v_top_match.similarity_score;
            
            -- Log a warning if very similar
            IF v_top_match.similarity_score > 0.9 THEN
                RAISE WARNING 'Question "%" is % similar to existing question "%"', 
                    NEW.question_code, 
                    v_top_match.similarity_score,
                    v_top_match.question_code;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_question_similarity
BEFORE INSERT ON tree_core.questions
FOR EACH ROW EXECUTE FUNCTION tree_core.check_question_similarity();

-- ============================================================
-- CONCEPT MANAGEMENT FUNCTIONS
-- ============================================================

-- Ensure concept exists before creating question
CREATE OR REPLACE FUNCTION tree_core.get_or_create_concept(
    p_concept_code TEXT,
    p_concept_name TEXT,
    p_category TEXT,
    p_data_type TEXT,
    p_definition TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_concept_id UUID;
BEGIN
    -- Try to find existing concept
    SELECT concept_id INTO v_concept_id
    FROM tree_core.concept_dictionary
    WHERE concept_code = p_concept_code
       OR p_concept_name = ANY(common_phrasings)
       OR p_concept_name = ANY(aliases);
    
    -- Create if not found
    IF v_concept_id IS NULL THEN
        INSERT INTO tree_core.concept_dictionary (
            concept_code,
            concept_name,
            concept_category,
            data_type,
            definition,
            created_by
        ) VALUES (
            p_concept_code,
            p_concept_name,
            p_category,
            p_data_type,
            COALESCE(p_definition, 'Auto-generated concept for ' || p_concept_name),
            COALESCE(p_created_by, current_setting('app.user_id')::uuid)
        ) RETURNING concept_id INTO v_concept_id;
    END IF;
    
    -- Update usage
    UPDATE tree_core.concept_dictionary
    SET usage_count = usage_count + 1,
        last_used = CURRENT_TIMESTAMP
    WHERE concept_id = v_concept_id;
    
    RETURN v_concept_id;
END;
$$ LANGUAGE plpgsql;

-- Find all questions related to a concept
CREATE OR REPLACE FUNCTION tree_core.find_questions_by_concept(
    p_concept_code TEXT
) RETURNS TABLE (
    question_id UUID,
    question_code TEXT,
    lender_name TEXT,
    similarity_score NUMERIC,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.question_id,
        q.question_code,
        l.lender_name,
        q.similarity_score,
        q.status
    FROM tree_core.questions q
    LEFT JOIN tree_core.lenders l ON q.owner_id = l.lender_id
    WHERE q.concept_id = (
        SELECT concept_id 
        FROM tree_core.concept_dictionary 
        WHERE concept_code = p_concept_code
    )
    ORDER BY q.status, l.lender_name, q.question_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TAG MANAGEMENT FUNCTIONS
-- ============================================================

-- Apply tags to questions
CREATE OR REPLACE FUNCTION tree_core.tag_question(
    p_question_id UUID,
    p_tags TEXT[],
    p_user_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_tag TEXT;
    v_tag_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, current_setting('app.user_id')::uuid);
    
    FOREACH v_tag IN ARRAY p_tags LOOP
        -- Get or create tag
        SELECT tag_id INTO v_tag_id
        FROM tree_core.tags
        WHERE tag_name = v_tag;
        
        IF v_tag_id IS NULL THEN
            INSERT INTO tree_core.tags (tag_name, created_by)
            VALUES (v_tag, v_user_id)
            RETURNING tag_id INTO v_tag_id;
        END IF;
        
        -- Apply tag to question
        INSERT INTO tree_core.question_tags (question_id, tag_id, tagged_by)
        VALUES (p_question_id, v_tag_id, v_user_id)
        ON CONFLICT (question_id, tag_id) DO NOTHING;
        
        -- Update usage count
        UPDATE tree_core.tags
        SET usage_count = usage_count + 1
        WHERE tag_id = v_tag_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Find questions by tags
CREATE OR REPLACE FUNCTION tree_core.find_questions_by_tags(
    p_tags TEXT[],
    p_match_all BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
    question_id UUID,
    question_code TEXT,
    matching_tags TEXT[],
    tag_count INT
) AS $$
BEGIN
    IF p_match_all THEN
        -- Must have ALL specified tags
        RETURN QUERY
        SELECT 
            q.question_id,
            q.question_code,
            array_agg(t.tag_name) as matching_tags,
            COUNT(t.tag_id)::INT as tag_count
        FROM tree_core.questions q
        JOIN tree_core.question_tags qt ON q.question_id = qt.question_id
        JOIN tree_core.tags t ON qt.tag_id = t.tag_id
        WHERE t.tag_name = ANY(p_tags)
        GROUP BY q.question_id, q.question_code
        HAVING COUNT(DISTINCT t.tag_name) = array_length(p_tags, 1);
    ELSE
        -- Has ANY of the specified tags
        RETURN QUERY
        SELECT 
            q.question_id,
            q.question_code,
            array_agg(DISTINCT t.tag_name) as matching_tags,
            COUNT(DISTINCT t.tag_id)::INT as tag_count
        FROM tree_core.questions q
        JOIN tree_core.question_tags qt ON q.question_id = qt.question_id
        JOIN tree_core.tags t ON qt.tag_id = t.tag_id
        WHERE t.tag_name = ANY(p_tags)
        GROUP BY q.question_id, q.question_code;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SIMILARITY RESOLUTION FUNCTIONS
-- ============================================================

-- Merge duplicate questions
CREATE OR REPLACE FUNCTION tree_core.merge_duplicate_questions(
    p_keep_question_id UUID,
    p_merge_question_ids UUID[],
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{"merged": 0, "errors": []}'::jsonb;
    v_merge_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, current_setting('app.user_id')::uuid);
    
    -- Validate that all questions exist
    IF NOT EXISTS (SELECT 1 FROM tree_core.questions WHERE question_id = p_keep_question_id) THEN
        RAISE EXCEPTION 'Keep question % does not exist', p_keep_question_id;
    END IF;
    
    FOREACH v_merge_id IN ARRAY p_merge_question_ids LOOP
        BEGIN
            -- Update all references to point to the kept question
            UPDATE tree_state.answers
            SET question_id = p_keep_question_id
            WHERE question_id = v_merge_id;
            
            UPDATE tree_core.tree_nodes
            SET question_id = p_keep_question_id
            WHERE question_id = v_merge_id;
            
            -- Archive the merged question
            UPDATE tree_core.questions
            SET status = 'ARCHIVED',
                archived_at = CURRENT_TIMESTAMP,
                archived_by = v_user_id,
                deletion_reason = format('Merged into question %s', p_keep_question_id)
            WHERE question_id = v_merge_id;
            
            -- Update similarity records
            UPDATE tree_core.question_similarities
            SET resolution_status = 'MERGED',
                resolved_at = CURRENT_TIMESTAMP,
                resolved_by = v_user_id
            WHERE (question_id = v_merge_id AND similar_to_id = p_keep_question_id)
               OR (question_id = p_keep_question_id AND similar_to_id = v_merge_id);
            
            v_result := jsonb_set(v_result, '{merged}', 
                to_jsonb((v_result->>'merged')::int + 1));
                
        EXCEPTION WHEN OTHERS THEN
            v_result := jsonb_set(v_result, '{errors}', 
                v_result->'errors' || jsonb_build_object(
                    'question_id', v_merge_id,
                    'error', SQLERRM
                ));
        END;
    END LOOP;
    
    -- Log the merge operation
    INSERT INTO tree_events.audit_log (
        table_name, operation, record_id,
        new_values, changed_by
    ) VALUES (
        'questions', 'MERGE', p_keep_question_id,
        jsonb_build_object(
            'merged_ids', p_merge_question_ids,
            'result', v_result
        ),
        v_user_id
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SIMILARITY MONITORING VIEWS
-- ============================================================

-- Dashboard view for similarity management
CREATE OR REPLACE VIEW tree_core.v_similarity_dashboard AS
WITH similarity_stats AS (
    SELECT 
        resolution_status,
        COUNT(*) as count,
        AVG(text_similarity) as avg_similarity,
        MAX(detected_at) as last_detected
    FROM tree_core.question_similarities
    GROUP BY resolution_status
),
concept_usage AS (
    SELECT 
        c.concept_code,
        c.concept_name,
        COUNT(DISTINCT q.question_id) as question_count,
        COUNT(DISTINCT q.owner_id) as owner_count
    FROM tree_core.concept_dictionary c
    LEFT JOIN tree_core.questions q ON c.concept_id = q.concept_id
    GROUP BY c.concept_id, c.concept_code, c.concept_name
)
SELECT 
    (SELECT COUNT(*) FROM tree_core.question_similarities WHERE resolution_status = 'PENDING') as pending_reviews,
    (SELECT COUNT(*) FROM tree_core.questions WHERE similarity_score > 0.9) as high_similarity_questions,
    (SELECT COUNT(*) FROM tree_core.concept_dictionary WHERE is_active = TRUE) as active_concepts,
    (SELECT COUNT(DISTINCT concept_id) FROM tree_core.questions WHERE concept_id IS NOT NULL) as concepts_in_use,
    (SELECT json_agg(json_build_object(
        'status', resolution_status,
        'count', count,
        'avg_similarity', ROUND(avg_similarity, 2)
    )) FROM similarity_stats) as similarity_summary,
    (SELECT json_agg(json_build_object(
        'concept', concept_code,
        'questions', question_count,
        'owners', owner_count
    ) ORDER BY question_count DESC) FROM concept_usage LIMIT 10) as top_concepts;

-- View for pending similarity reviews
CREATE OR REPLACE VIEW tree_core.v_pending_similarities AS
SELECT 
    qs.similarity_id,
    qs.detected_at,
    qs.text_similarity,
    qs.similarity_type,
    -- Question 1 details
    q1.question_id as question1_id,
    q1.question_code as question1_code,
    COALESCE(q1.display_label, q1.question_code) as question1_text,
    l1.lender_name as question1_lender,
    -- Question 2 details
    q2.question_id as question2_id,
    q2.question_code as question2_code,
    COALESCE(q2.display_label, q2.question_code) as question2_text,
    l2.lender_name as question2_lender,
    -- Concept info
    c1.concept_name as question1_concept,
    c2.concept_name as question2_concept
FROM tree_core.question_similarities qs
JOIN tree_core.questions q1 ON qs.question_id = q1.question_id
JOIN tree_core.questions q2 ON qs.similar_to_id = q2.question_id
LEFT JOIN tree_core.lenders l1 ON q1.owner_id = l1.lender_id
LEFT JOIN tree_core.lenders l2 ON q2.owner_id = l2.lender_id
LEFT JOIN tree_core.concept_dictionary c1 ON q1.concept_id = c1.concept_id
LEFT JOIN tree_core.concept_dictionary c2 ON q2.concept_id = c2.concept_id
WHERE qs.resolution_status = 'PENDING'
ORDER BY qs.text_similarity DESC, qs.detected_at DESC;

-- ============================================================
-- INITIAL DATA POPULATION
-- ============================================================

-- Insert common mortgage concepts
INSERT INTO tree_core.concept_dictionary (
    concept_code, concept_name, concept_category, data_type, definition, created_by
) VALUES 
    ('LOAN_AMOUNT', 'Loan Amount', 'LOAN_DETAILS', 'money', 
     'The total amount of money being borrowed', '00000000-0000-0000-0000-000000000000'::uuid),
    
    ('PROPERTY_VALUE', 'Property Value', 'COLLATERAL', 'money', 
     'The estimated or appraised value of the property', '00000000-0000-0000-0000-000000000000'::uuid),
    
    ('ANNUAL_INCOME', 'Annual Income', 'INCOME_ASSETS', 'money', 
     'Total yearly income from all sources', '00000000-0000-0000-0000-000000000000'::uuid),
    
    ('CREDIT_SCORE', 'Credit Score', 'CREDIT', 'number', 
     'FICO or other credit scoring model result', '00000000-0000-0000-0000-000000000000'::uuid),
    
    ('PROPERTY_TYPE', 'Property Type', 'COLLATERAL', 'enum', 
     'Type of property (SFR, Condo, Multi-family, etc.)', '00000000-0000-0000-0000-000000000000'::uuid),
    
    ('OCCUPANCY_TYPE', 'Occupancy Type', 'COLLATERAL', 'enum', 
     'How the property will be used (Primary, Secondary, Investment)', '00000000-0000-0000-0000-000000000000'::uuid),
    
    ('EMPLOYMENT_STATUS', 'Employment Status', 'EMPLOYMENT', 'enum', 
     'Current employment situation', '00000000-0000-0000-0000-000000000000'::uuid),
    
    ('DOWN_PAYMENT', 'Down Payment', 'LOAN_DETAILS', 'money', 
     'Amount of money paid upfront', '00000000-0000-0000-0000-000000000000'::uuid);

-- Add common phrasings for concepts
UPDATE tree_core.concept_dictionary SET common_phrasings = ARRAY[
    'How much do you want to borrow?',
    'What is the loan amount?',
    'Requested loan amount',
    'Total loan needed',
    'Mortgage amount'
] WHERE concept_code = 'LOAN_AMOUNT';

UPDATE tree_core.concept_dictionary SET common_phrasings = ARRAY[
    'What is your annual salary?',
    'Yearly income',
    'Total annual earnings',
    'Gross annual income',
    'How much do you make per year?'
] WHERE concept_code = 'ANNUAL_INCOME';

-- Insert common tags
INSERT INTO tree_core.tags (tag_name, tag_category, description, created_by) VALUES
    ('required', 'validation', 'This question is mandatory', '00000000-0000-0000-0000-000000000000'::uuid),
    ('income', 'category', 'Income-related questions', '00000000-0000-0000-0000-000000000000'::uuid),
    ('asset', 'category', 'Asset-related questions', '00000000-0000-0000-0000-000000000000'::uuid),
    ('employment', 'category', 'Employment-related questions', '00000000-0000-0000-0000-000000000000'::uuid),
    ('property', 'category', 'Property-related questions', '00000000-0000-0000-0000-000000000000'::uuid),
    ('personal', 'category', 'Personal information questions', '00000000-0000-0000-0000-000000000000'::uuid),
    ('financial', 'category', 'Financial questions', '00000000-0000-0000-0000-000000000000'::uuid),
    ('verification', 'process', 'Requires verification', '00000000-0000-0000-0000-000000000000'::uuid),
    ('sensitive', 'security', 'Contains sensitive information', '00000000-0000-0000-0000-000000000000'::uuid);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Indexes for similarity detection
CREATE INDEX idx_questions_text_search ON tree_core.questions 
USING gin(to_tsvector('english', COALESCE(display_label, question_code)));

CREATE INDEX idx_concepts_aliases ON tree_core.concept_dictionary 
USING gin(aliases);

CREATE INDEX idx_concepts_phrasings ON tree_core.concept_dictionary 
USING gin(common_phrasings);

-- Trigram indexes for fuzzy matching
CREATE INDEX idx_questions_trigram ON tree_core.questions 
USING gin(COALESCE(display_label, question_code) gin_trgm_ops);

CREATE INDEX idx_concepts_name_trigram ON tree_core.concept_dictionary 
USING gin(concept_name gin_trgm_ops);

COMMIT;

-- ============================================================
-- MAINTENANCE PROCEDURES
-- ============================================================

-- Periodic similarity detection for all questions
CREATE OR REPLACE PROCEDURE tree_core.detect_all_similarities(
    p_threshold NUMERIC DEFAULT 0.7
)
LANGUAGE plpgsql AS $$
DECLARE
    v_question RECORD;
    v_detected INT := 0;
BEGIN
    FOR v_question IN 
        SELECT question_id, COALESCE(display_label, question_code) as text
        FROM tree_core.questions
        WHERE status = 'ACTIVE'
          AND concept_id IS NULL  -- Only check uncategorized questions
    LOOP
        -- Find and record similarities
        INSERT INTO tree_core.question_similarities (
            question_id,
            similar_to_id,
            similarity_type,
            text_similarity,
            confidence_score,
            detection_method
        )
        SELECT 
            v_question.question_id,
            ds.question_id,
            ds.match_type,
            ds.similarity_score,
            ds.similarity_score,
            'BATCH_DETECTION'
        FROM tree_core.detect_similar_questions(v_question.text, NULL, p_threshold) ds
        WHERE ds.question_id != v_question.question_id
        ON CONFLICT (question_id, similar_to_id) DO NOTHING;
        
        GET DIAGNOSTICS v_detected = v_detected + ROW_COUNT;
    END LOOP;
    
    RAISE NOTICE 'Detected % new similarities', v_detected;
END;
$$;
