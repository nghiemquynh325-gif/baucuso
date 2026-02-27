-- COMPREHENSIVE RESET FOR AREA STATS
-- This will clear ALL locked/dummy data, returning the system to 100% Real-time check-in counts.

-- 1. Clear all summarized statistics
DELETE FROM area_stats;

-- 2. Clear all voting results (if any test data exists there)
DELETE FROM voting_results;

-- 3. Reload PostgREST to ensure cache is fresh
NOTIFY pgrst, 'reload config';
