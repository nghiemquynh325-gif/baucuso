-- ===================================================================
-- FIX RLS POLICIES FOR CANDIDATES TABLE
-- ===================================================================
-- This script adds missing RLS policies to allow data entry users
-- to UPDATE and INSERT candidates, enabling unit transfers.
-- 
-- ISSUE: Current policies only allow:
--   - Admins: ALL operations
--   - Authenticated users: SELECT only
-- Missing: UPDATE and INSERT policies for nhap_lieu and to_bau_cu roles
-- ===================================================================

-- 1. Add policy for updating candidates (for data entry and election committee)
DROP POLICY IF EXISTS "Data entry can update candidates" ON candidates;

CREATE POLICY "Data entry can update candidates" ON candidates 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('nhap_lieu', 'to_bau_cu', 'ban_chi_dao', 'admin_phuong')
    AND profiles.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('nhap_lieu', 'to_bau_cu', 'ban_chi_dao', 'admin_phuong')
    AND profiles.status = 'active'
  )
);

-- 2. Add policy for inserting new candidates
DROP POLICY IF EXISTS "Data entry can insert candidates" ON candidates;

CREATE POLICY "Data entry can insert candidates" ON candidates 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('nhap_lieu', 'to_bau_cu', 'ban_chi_dao', 'admin_phuong')
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
WHERE tablename = 'candidates'
ORDER BY policyname;

-- Expected result: Should see 4 policies:
-- 1. "Admins can manage candidates" (FOR ALL)
-- 2. "Authenticated users can view candidates" (FOR SELECT)
-- 3. "Data entry can update candidates" (FOR UPDATE)
-- 4. "Data entry can insert candidates" (FOR INSERT)
-- ===================================================================
