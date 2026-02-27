-- RESET TEST DATA FOR KV01
-- This will unlock the area and reset the stats so they mirror realtime check-ins
DELETE FROM area_stats WHERE area_id = 'kv01';

-- ALTERNATIVELY, if you want to keep the record but reset it:
-- UPDATE area_stats 
-- SET is_locked = false, 
--     received_votes = 0, 
--     total_voters = (SELECT count(*) FROM voters WHERE area_id = 'kv01'),
--     issued_votes = 0,
--     valid_votes = 0,
--     invalid_votes = 0
-- WHERE area_id = 'kv01';

-- Reload config
NOTIFY pgrst, 'reload config';
