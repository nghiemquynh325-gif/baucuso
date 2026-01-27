
-- NUCLEAR FIX: DROP ALL POLICIES DYNAMICALLY & RESET
-- This script deletes ALL existing policies for the tables regardless of their names,
-- to ensure no "hidden" policy is blocking access.

DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    -- 1. DROP ALL POLICIES ON area_stats
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'area_stats') LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON area_stats', pol.policyname); 
    END LOOP;

    -- 2. DROP ALL POLICIES ON voting_results
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'voting_results') LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON voting_results', pol.policyname); 
    END LOOP;

    -- 3. DROP ALL POLICIES ON profiles (to ensure visibility)
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname); 
    END LOOP;
END $$;

-- 4. RE-ENABLE RLS & ADD SIMPLE "ALLOW ALL AUTHENTICATED" POLICIES

-- AREA_STATS
ALTER TABLE area_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All Auth Users Manage Stats" ON area_stats 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- VOTING_RESULTS
ALTER TABLE voting_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All Auth Users Manage Results" ON voting_results 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All Auth Users View Profiles" ON profiles 
FOR SELECT USING (auth.role() = 'authenticated');

-- 5. ENSURE PROFILE EXISTS (Recovery for manual users)
INSERT INTO public.profiles (id, email, username, role, status, full_name, created_at, updated_at)
SELECT 
  id, 
  email, 
  split_part(email, '@', 1),
  'nhap_lieu', -- Default role
  'active',
  'User ' || split_part(email, '@', 1),
  now(),
  now()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
