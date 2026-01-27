
-- AGGRESSIVE FIX FOR RLS (Fixes "violates row-level security policy")

-- 1. Enable RLS (Just in case)
ALTER TABLE area_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_results ENABLE ROW LEVEL SECURITY;

-- 2. Drop all previous restrictive policies to be clean
DROP POLICY IF EXISTS "Admins can manage area_stats" ON area_stats;
DROP POLICY IF EXISTS "Scope-based area_stats update" ON area_stats;
DROP POLICY IF EXISTS "Data entry users can manage all area_stats" ON area_stats;
DROP POLICY IF EXISTS "Voting units can manage own area_stats" ON area_stats;
DROP POLICY IF EXISTS "Nhap lieu can manage all" ON area_stats;

-- 3. CREATE EXPLICIT POLICIES (No complex functions)

-- A. ADMINS & NHAP LIEU: Manage EVERYTHING (Insert/Update/Delete All)
-- Explicitly listing roles to avoid function ambiguity
CREATE POLICY "Admins and Entry can manage ALL area_stats" ON area_stats
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'ban_chi_dao', 'admin_phuong', 'nhap_lieu')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'ban_chi_dao', 'admin_phuong', 'nhap_lieu')
  )
);

-- B. VOTING UNITS: Manage OWN AREA only
CREATE POLICY "Voting units can manage OWN area_stats" ON area_stats
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'to_bau_cu'
    AND area_id = area_stats.area_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'to_bau_cu'
    AND area_id = area_stats.area_id
  )
);

-- C. VIEW ACCESS (Everyone logged in)
DROP POLICY IF EXISTS "Authenticated users can view area_stats" ON area_stats;
CREATE POLICY "Authenticated users can view area_stats" ON area_stats 
FOR SELECT USING (auth.uid() IS NOT NULL);


-- REPEAT FOR VOTING_RESULTS
DROP POLICY IF EXISTS "Admins can manage voting_results" ON voting_results;
DROP POLICY IF EXISTS "Scope-based voting_results update" ON voting_results;
DROP POLICY IF EXISTS "Data entry users can manage all voting_results" ON voting_results;
DROP POLICY IF EXISTS "Voting units can manage own voting_results" ON voting_results;

CREATE POLICY "Admins and Entry can manage ALL voting_results" ON voting_results
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'ban_chi_dao', 'admin_phuong', 'nhap_lieu')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'ban_chi_dao', 'admin_phuong', 'nhap_lieu')
  )
);

CREATE POLICY "Voting units can manage OWN voting_results" ON voting_results
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'to_bau_cu'
    AND area_id = voting_results.area_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'to_bau_cu'
    AND area_id = voting_results.area_id
  )
);

DROP POLICY IF EXISTS "Authenticated users can view voting_results" ON voting_results;
CREATE POLICY "Authenticated users can view voting_results" ON voting_results 
FOR SELECT USING (auth.uid() IS NOT NULL);
