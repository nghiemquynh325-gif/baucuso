-- PERFORMANCE INDEXES FOR VARYING DATA SCALES (UP TO 100K+)
CREATE INDEX IF NOT EXISTS idx_voters_area_id ON voters(area_id);
CREATE INDEX IF NOT EXISTS idx_voters_voting_status ON voters(voting_status);
CREATE INDEX IF NOT EXISTS idx_voters_unit_id ON voters(unit_id);
CREATE INDEX IF NOT EXISTS idx_voters_neighborhood_id ON voters(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_voters_group_name ON voters(group_name);

-- 1. RPC: get_election_summary()
-- Returns high-level numbers for the dashboard cards
CREATE OR REPLACE FUNCTION get_election_summary()
RETURNS JSON AS $$
DECLARE
    result JSON;
    total_count BIGINT := 0;
    voted_count BIGINT := 0;
    locked_count BIGINT := 0;
    completed_count BIGINT := 0;
    area_count BIGINT := 0;
    rec RECORD;
BEGIN
    -- We derive the list of areas from the voters table or a hardcoded list if preferred.
    -- For maximum flexibility with dynamic data, we'll use distinct area_id from voters.
    FOR rec IN (SELECT DISTINCT area_id FROM voters WHERE area_id IS NOT NULL) LOOP
        DECLARE
            s_locked BOOLEAN := FALSE;
            s_total INTEGER := 0;
            s_received INTEGER := 0;
            v_total BIGINT := 0;
            v_voted BIGINT := 0;
        BEGIN
            area_count := area_count + 1;
            
            -- Check if locked in area_stats
            SELECT is_locked, total_voters, received_votes 
            INTO s_locked, s_total, s_received 
            FROM area_stats WHERE area_id = rec.area_id;

            IF s_locked IS TRUE THEN
                total_count := total_count + s_total;
                voted_count := voted_count + s_received;
                locked_count := locked_count + 1;
                IF s_total > 0 AND (s_received::float / s_total) >= 0.9 THEN
                    completed_count := completed_count + 1;
                END IF;
            ELSE
                SELECT count(*), count(*) FILTER (WHERE voting_status = 'da-bau')
                INTO v_total, v_voted
                FROM voters WHERE area_id = rec.area_id;
                
                total_count := total_count + v_total;
                voted_count := voted_count + v_voted;
                IF v_total > 0 AND (v_voted::float / v_total) >= 0.9 THEN
                    completed_count := completed_count + 1;
                END IF;
            END IF;
        END;
    END LOOP;

    result := json_build_object(
        'total', total_count,
        'voted', voted_count,
        'lockedAreas', locked_count,
        'totalAreas', area_count,
        'completedAreas', completed_count
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: get_aggregated_stats(view_mode text)
-- Returns the detailed list for the table based on the view mode
CREATE OR REPLACE FUNCTION get_aggregated_stats(p_view_mode TEXT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF p_view_mode = 'area' THEN
        SELECT json_agg(t) INTO result FROM (
            SELECT 
                a.area_id as "rawId",
                a.area_id as "id",
                COALESCE(s.is_locked, FALSE) as "isLocked",
                CASE 
                    WHEN COALESCE(s.is_locked, FALSE) THEN s.total_voters 
                    ELSE (SELECT count(*) FROM voters v WHERE v.area_id = a.area_id)
                END as "total",
                CASE 
                    WHEN COALESCE(s.is_locked, FALSE) THEN s.received_votes 
                    ELSE (SELECT count(*) FROM voters v WHERE v.area_id = a.area_id AND v.voting_status = 'da-bau')
                END as "voted",
                COALESCE(s.valid_votes, 0) as "validVotes",
                COALESCE(s.unvoted_votes, 0) as "unvotedVotes"
            FROM (SELECT DISTINCT area_id FROM voters WHERE area_id IS NOT NULL) a
            LEFT JOIN area_stats s ON a.area_id = s.area_id
        ) t;
    ELSIF p_view_mode = 'unit' THEN
        SELECT json_agg(t) INTO result FROM (
            SELECT 
                unit_id as "rawId",
                unit_id as "id",
                FALSE as "isLocked",
                count(*) as "total",
                count(*) FILTER (WHERE voting_status = 'da-bau') as "voted"
            FROM voters
            WHERE unit_id IS NOT NULL
            GROUP BY unit_id
        ) t;
    ELSIF p_view_mode = 'neighborhood' THEN
        SELECT json_agg(t) INTO result FROM (
            SELECT 
                neighborhood_id as "rawId",
                neighborhood_id as "id",
                FALSE as "isLocked",
                count(*) as "total",
                count(*) FILTER (WHERE voting_status = 'da-bau') as "voted"
            FROM voters
            WHERE neighborhood_id IS NOT NULL
            GROUP BY neighborhood_id
        ) t;
    ELSIF p_view_mode = 'group' THEN
        SELECT json_agg(t) INTO result FROM (
            SELECT 
                group_name as "rawId",
                group_name as "id",
                FALSE as "isLocked",
                count(*) as "total",
                count(*) FILTER (WHERE voting_status = 'da-bau') as "voted"
            FROM voters
            WHERE group_name IS NOT NULL
            GROUP BY group_name
        ) t;
    ELSE
        result := '[]'::json;
    END IF;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: get_voters_paged
-- For detail modal, supports high-scale 100k+ rows with paging
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
    total_count BIGINT
) AS $$
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
        c.full_count
    FROM filtered_voters fv, counting c
    ORDER BY fv.name ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
