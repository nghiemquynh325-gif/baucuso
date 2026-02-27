-- ADD COLUMN FOR UNVOTED VOTES
-- This field stores the number of votes not cast for any candidate (blank slots on valid ballots)
ALTER TABLE area_stats ADD COLUMN IF NOT EXISTS unvoted_votes INTEGER DEFAULT 0;

-- Refresh PostgREST
NOTIFY pgrst, 'reload config';
