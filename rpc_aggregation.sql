-- PERFORMANCE INDEXES FOR VARYING DATA SCALES (UP TO 100K+)
CREATE INDEX IF NOT EXISTS idx_voters_area_id ON voters(area_id);
CREATE INDEX IF NOT EXISTS idx_voters_voting_status ON voters(voting_status);
CREATE INDEX IF NOT EXISTS idx_voters_unit_id ON voters(unit_id);
CREATE INDEX IF NOT EXISTS idx_voters_neighborhood_id ON voters(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_voters_group_name ON voters(group_name);

-- Ensure area_stats table has all necessary columns for robust aggregation
DO $$ 
BEGIN 
    -- Add columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='area_stats' AND column_name='male_voted') THEN
        ALTER TABLE area_stats ADD COLUMN male_voted INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='area_stats' AND column_name='female_voted') THEN
        ALTER TABLE area_stats ADD COLUMN female_voted INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='area_stats' AND column_name='valid_votes') THEN
        ALTER TABLE area_stats ADD COLUMN valid_votes INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='area_stats' AND column_name='unvoted_votes') THEN
        ALTER TABLE area_stats ADD COLUMN unvoted_votes INTEGER DEFAULT 0;
    END IF;
END $$;

-- 1. RPC: get_election_summary()
-- Returns high-level numbers for the dashboard cards
DROP FUNCTION IF EXISTS get_election_summary();
CREATE OR REPLACE FUNCTION get_election_summary()
RETURNS JSON AS $$
DECLARE
    v_total_voters BIGINT;
    v_voted_voters BIGINT;
    v_total_male BIGINT;
    v_total_female BIGINT;
    v_male_voted BIGINT;
    v_female_voted BIGINT;
    v_age_stats JSON;
    v_locked_count BIGINT;
    v_total_areas BIGINT;
    v_completed_count BIGINT;
BEGIN
    -- 1. Get base stats from voters table
    SELECT 
        count(*), 
        count(*) FILTER (WHERE voting_status = 'da-bau'),
        count(*) FILTER (WHERE gender = 'Nam'),
        count(*) FILTER (WHERE gender = 'Nữ'),
        count(*) FILTER (WHERE gender = 'Nam' AND voting_status = 'da-bau'),
        count(*) FILTER (WHERE gender = 'Nữ' AND voting_status = 'da-bau')
    INTO 
        v_total_voters, v_voted_voters,
        v_total_male, v_total_female,
        v_male_voted, v_female_voted
    FROM voters;

    -- 2. Age stats (Realtime from da-bau)
    WITH age_calc AS (
        SELECT 
            CASE 
                WHEN TRIM(dob) ~ '^\d{2}/\d{2}/\d{4}$' THEN EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM to_date(TRIM(dob), 'DD/MM/YYYY'))
                WHEN TRIM(dob) ~ '^\d{4}-\d{2}-\d{2}$' THEN EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM to_date(TRIM(dob), 'YYYY-MM-DD'))
                WHEN TRIM(dob) ~ '^\d{4}$' THEN EXTRACT(YEAR FROM CURRENT_DATE) - TRIM(dob)::int
                ELSE 0
            END as age
        FROM voters
        WHERE voting_status = 'da-bau'
    )
    SELECT json_build_object(
        '18-30', count(*) FILTER (WHERE age >= 18 AND age <= 30),
        '31-45', count(*) FILTER (WHERE age >= 31 AND age <= 45),
        '46-60', count(*) FILTER (WHERE age >= 46 AND age <= 60),
        'Trên 60', count(*) FILTER (WHERE age > 60)
    ) INTO v_age_stats FROM age_calc;

    -- 3. Area/Lock stats
    SELECT count(*), count(*) FILTER (WHERE is_locked = TRUE)
    INTO v_total_areas, v_locked_count
    FROM (SELECT DISTINCT area_id FROM voters WHERE area_id IS NOT NULL) a
    LEFT JOIN area_stats s ON a.area_id = s.area_id;

    -- Completed areas (>90%)
    SELECT count(*) INTO v_completed_count
    FROM (
        SELECT area_id, count(*), count(*) FILTER (WHERE voting_status = 'da-bau') as voted
        FROM voters GROUP BY area_id
    ) t WHERE count > 0 AND (voted::float / count) >= 0.9;

    RETURN json_build_object(
        'total', v_total_voters,
        'voted', v_voted_voters,
        'totalMale', v_total_male,
        'totalFemale', v_total_female,
        'maleVoted', v_male_voted,
        'femaleVoted', v_female_voted,
        'ageStats', v_age_stats,
        'lockedAreas', COALESCE(v_locked_count, 0),
        'totalAreas', COALESCE(v_total_areas, 0),
        'completedAreas', COALESCE(v_completed_count, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: get_aggregated_stats(view_mode text)
-- Returns the detailed list for the table based on the view mode
DROP FUNCTION IF EXISTS get_aggregated_stats(TEXT);
CREATE OR REPLACE FUNCTION get_aggregated_stats(p_view_mode TEXT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF p_view_mode = 'area' THEN
        SELECT json_agg(t) INTO result FROM (
            SELECT 
                a.area_id as "rawId", a.area_id as "id",
                COALESCE(s.is_locked, FALSE) as "isLocked",
                CASE WHEN COALESCE(s.is_locked, FALSE) THEN s.total_voters ELSE (SELECT count(*) FROM voters v WHERE v.area_id = a.area_id) END as "total",
                CASE WHEN COALESCE(s.is_locked, FALSE) THEN s.received_votes ELSE (SELECT count(*) FROM voters v WHERE v.area_id = a.area_id AND v.voting_status = 'da-bau') END as "voted",
                CASE WHEN COALESCE(s.is_locked, FALSE) THEN COALESCE(s.male_voted, 0) ELSE (SELECT count(*) FROM voters v WHERE v.area_id = a.area_id AND v.voting_status = 'da-bau' AND v.gender = 'Nam') END as "maleVoted",
                CASE WHEN COALESCE(s.is_locked, FALSE) THEN COALESCE(s.female_voted, 0) ELSE (SELECT count(*) FROM voters v WHERE v.area_id = a.area_id AND v.voting_status = 'da-bau' AND v.gender = 'Nữ') END as "femaleVoted",
                COALESCE(s.valid_votes, 0) as "validVotes", COALESCE(s.unvoted_votes, 0) as "unvotedVotes"
            FROM (SELECT DISTINCT area_id FROM voters WHERE area_id IS NOT NULL) a
            LEFT JOIN area_stats s ON a.area_id = s.area_id
        ) t;
    ELSIF p_view_mode = 'unit' THEN
        SELECT json_agg(t) INTO result FROM (
            SELECT 
                unit_id as "rawId", unit_id as "id", FALSE as "isLocked",
                count(*) as "total",
                count(*) FILTER (WHERE voting_status = 'da-bau') as "voted",
                count(*) FILTER (WHERE voting_status = 'da-bau' AND gender = 'Nam') as "maleVoted",
                count(*) FILTER (WHERE voting_status = 'da-bau' AND gender = 'Nữ') as "femaleVoted"
            FROM voters WHERE unit_id IS NOT NULL GROUP BY unit_id
        ) t;
    ELSIF p_view_mode = 'neighborhood' THEN
        SELECT json_agg(t) INTO result FROM (
            SELECT 
                neighborhood_id as "rawId", neighborhood_id as "id", FALSE as "isLocked",
                count(*) as "total",
                count(*) FILTER (WHERE voting_status = 'da-bau') as "voted",
                count(*) FILTER (WHERE voting_status = 'da-bau' AND gender = 'Nam') as "maleVoted",
                count(*) FILTER (WHERE voting_status = 'da-bau' AND gender = 'Nữ') as "femaleVoted"
            FROM voters WHERE neighborhood_id IS NOT NULL GROUP BY neighborhood_id
        ) t;
    ELSIF p_view_mode = 'group' THEN
        SELECT json_agg(t) INTO result FROM (
            SELECT 
                group_name as "rawId", group_name as "id", FALSE as "isLocked",
                count(*) as "total",
                count(*) FILTER (WHERE voting_status = 'da-bau') as "voted",
                count(*) FILTER (WHERE voting_status = 'da-bau' AND gender = 'Nam') as "maleVoted",
                count(*) FILTER (WHERE voting_status = 'da-bau' AND gender = 'Nữ') as "femaleVoted"
            FROM voters WHERE group_name IS NOT NULL GROUP BY group_name
        ) t;
    ELSE
        result := '[]'::json;
    END IF;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: get_voters_paged
-- For detail modal, supports high-scale 100k+ rows with paging
DROP FUNCTION IF EXISTS get_voters_paged(TEXT, TEXT, TEXT, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_voters_paged(
    p_filter_col TEXT, 
    p_filter_val TEXT, 
    p_voting_status TEXT DEFAULT 'all',
    p_offset INTEGER DEFAULT 0,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    cccd TEXT,
    voter_card_number TEXT,
    area_id TEXT,
    neighborhood_id TEXT,
    group_name TEXT,
    voting_status TEXT,
    vote_qh BOOLEAN,
    vote_t BOOLEAN,
    vote_p BOOLEAN,
    total_count BIGINT
) AS $body$
BEGIN
    RETURN QUERY
    WITH filtered_voters AS (
        SELECT v.*
        FROM voters v
        WHERE (CASE 
            WHEN p_filter_col = 'area_id' THEN v.area_id = p_filter_val
            WHEN p_filter_col = 'unit_id' THEN v.unit_id = p_filter_val
            WHEN p_filter_col = 'neighborhood_id' THEN v.neighborhood_id = p_filter_val
            WHEN p_filter_col = 'group_name' THEN v.group_name = p_filter_val
            ELSE TRUE
        END)
        AND (CASE 
            WHEN p_voting_status = 'da-bau' THEN v.voting_status = 'da-bau'
            WHEN p_voting_status = 'chua-bau' THEN v.voting_status != 'da-bau'
            ELSE TRUE
        END)
    ),
    counting AS (
        SELECT count(*) as full_count FROM filtered_voters
    )
    SELECT 
        fv.id, fv.name, fv.cccd, fv.voter_card_number, fv.area_id, fv.neighborhood_id, fv.group_name, fv.voting_status,
        fv.vote_qh, fv.vote_t, fv.vote_p,
        c.full_count
    FROM filtered_voters fv, counting c
    ORDER BY fv.name ASC
    LIMIT p_limit OFFSET p_offset;
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER;
