-- ADD COLUMN FOR SCRATCHED VOTES (PHIẾU BỊ GẠCH)
-- This field stores the number of times a candidate was scratched out
ALTER TABLE voting_results ADD COLUMN IF NOT EXISTS scratched_votes INTEGER DEFAULT 0;

-- Refresh PostgREST
NOTIFY pgrst, 'reload config';
