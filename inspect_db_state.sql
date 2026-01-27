
-- Check policies for area_stats
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'area_stats';

-- Check definition of is_admin function
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'is_admin';

-- Check policies for voting_results (for completeness)
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'voting_results';
