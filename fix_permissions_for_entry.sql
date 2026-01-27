
-- Script to fixes RLS policies for Data Entry (area_stats & voting_results)
-- Helps fix "new row violates row-level security policy" error.

-- 1. Ensure is_admin() includes 'nhap_lieu' (Data Entry Manager)
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'ban_chi_dao', 'admin_phuong', 'nhap_lieu')
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RESET POLICIES FOR AREA_STATS
-- We want:
--  - Admins (including nhap_lieu) can do EVERYTHING (Insert/Update/Delete) for ANY area.
--  - Voting Units (to_bau_cu) can ONLY update/insert their OWN area.

ALTER TABLE area_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage area_stats" ON area_stats;
DROP POLICY IF EXISTS "Scope-based area_stats update" ON area_stats;
DROP POLICY IF EXISTS "Data entry users can manage all area_stats" ON area_stats;

-- Policy 1: Admins (super_admin, ban_chi_dao, admin_phuong, nhap_lieu)
-- Can manage ALL stats.
CREATE POLICY "Admins can manage area_stats" ON area_stats 
FOR ALL USING (is_admin()) 
WITH CHECK (is_admin());

-- Policy 2: Voting Units (to_bau_cu)
-- Can only manage their OWN area.
CREATE POLICY "Voting units can manage own area_stats" ON area_stats 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'to_bau_cu'
    AND profiles.area_id = area_stats.area_id
    AND profiles.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'to_bau_cu'
    AND profiles.area_id = area_stats.area_id
    AND profiles.status = 'active'
  )
);

-- 3. RESET POLICIES FOR VOTING_RESULTS
-- Same logic: Admins all, Voting Units own area.

ALTER TABLE voting_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage voting_results" ON voting_results;
DROP POLICY IF EXISTS "Scope-based voting_results update" ON voting_results;
DROP POLICY IF EXISTS "Data entry users can manage all voting_results" ON voting_results;

CREATE POLICY "Admins can manage voting_results" ON voting_results 
FOR ALL USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Voting units can manage own voting_results" ON voting_results 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'to_bau_cu'
    AND profiles.area_id = voting_results.area_id
    AND profiles.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'to_bau_cu'
    AND profiles.area_id = voting_results.area_id
    AND profiles.status = 'active'
  )
);

-- 4. Ensure authenticated users can View
DROP POLICY IF EXISTS "Authenticated users can view area_stats" ON area_stats;
CREATE POLICY "Authenticated users can view area_stats" ON area_stats 
FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view voting_results" ON voting_results;
CREATE POLICY "Authenticated users can view voting_results" ON voting_results 
FOR SELECT USING (auth.uid() IS NOT NULL);
