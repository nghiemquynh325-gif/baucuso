-- ===================================================================
-- FIX RLS POLICY FOR AREA_STATS AND VOTING_RESULTS
-- ===================================================================
-- This script fixes the Row Level Security policies to allow UPSERT
-- operations in the Data Entry page for all voting areas.
-- 
-- ISSUE: The existing policies use "FOR ALL USING" without "WITH CHECK"
-- which prevents INSERT operations during UPSERT.
-- ===================================================================

-- 1. Fix area_stats RLS Policy
DROP POLICY IF EXISTS "Scope-based area_stats update" ON area_stats;

CREATE POLICY "Scope-based area_stats update" ON area_stats 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('nhap_lieu', 'to_bau_cu')
    AND profiles.area_id = area_stats.area_id
    AND profiles.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('nhap_lieu', 'to_bau_cu')
    AND profiles.area_id = area_stats.area_id
    AND profiles.status = 'active'
  )
);

-- 2. Fix voting_results RLS Policy
DROP POLICY IF EXISTS "Scope-based voting_results update" ON voting_results;

CREATE POLICY "Scope-based voting_results update" ON voting_results 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('nhap_lieu', 'to_bau_cu')
    AND profiles.area_id = voting_results.area_id
    AND profiles.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('nhap_lieu', 'to_bau_cu')
    AND profiles.area_id = voting_results.area_id
    AND profiles.status = 'active'
  )
);

-- 3. Refresh schema cache
NOTIFY pgrst, 'reload config';

-- ===================================================================
-- VERIFICATION QUERY
-- ===================================================================
-- Run this after executing the script to verify the policies:
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual IS NOT NULL as has_using,
    with_check IS NOT NULL as has_with_check
FROM pg_policies 
WHERE tablename IN ('area_stats', 'voting_results')
ORDER BY tablename, policyname;

-- Expected result: Both policies should have has_using=true AND has_with_check=true
