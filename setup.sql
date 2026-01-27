-- --- MIGRATIONS TẠI ĐÂY ---
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Đảm bảo cột neighborhood_id tồn tại
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS neighborhood_id TEXT;

-- MIGRATION: Cho phép trùng CCCD (Xóa constraint UNIQUE)
DO $$ 
BEGIN
    ALTER TABLE public.voters DROP CONSTRAINT IF EXISTS voters_cccd_key;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- MIGRATION: Sửa lỗi 400 System Logs (Thêm cột status) & Refresh Schema
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';
NOTIFY pgrst, 'reload config';

-- MIGRATION: Sửa lỗi 403 Force Add và VIEW (Cấp quyền Admin cho Nhập liệu)
DROP POLICY IF EXISTS "Scope-based voter insert" ON voters;
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'ban_chi_dao', 'admin_phuong', 'nhap_lieu') -- Thêm nhap_lieu
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sửa lại policy insert để dùng is_admin nếu cần, hoặc giữ nguyên policy global logic
CREATE POLICY "Scope-based voter insert" ON voters 
FOR INSERT WITH CHECK (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'to_bau_cu' 
    AND (profiles.area_id = voters.area_id OR profiles.unit_id = voters.unit_id)
    AND profiles.status = 'active'
  )
);

-- MIGRATION: Master Reset - Xóa tất cả policy và function cũ của hệ thống để tránh lỗi "already exists"
DO $$ 
DECLARE
    pol RECORD;
    func_id OID;
BEGIN
    -- 1. Xóa tất cả policies trong public (Dùng định danh đầy đủ)
    FOR pol IN (SELECT policyname, tablename, schemaname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
    
    -- 2. Xóa tất cả các phiên bản của các functions chính (Dùng OID để xóa mọi overloads)
    FOR func_id IN (
        SELECT oid FROM pg_proc 
        WHERE proname IN ('create_system_user', 'update_system_user', 'delete_system_user', 'is_admin') 
        AND pronamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE format('DROP FUNCTION %s(%s)', func_id::regproc, pg_get_function_identity_arguments(func_id));
    END LOOP;
END $$;
-- ------------------------

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. BẢNG VOTERS
CREATE TABLE IF NOT EXISTS voters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  dob TEXT,
  gender TEXT,
  ethnic TEXT DEFAULT 'Kinh',
  cccd TEXT,
  voter_card_number TEXT,
  address TEXT,
  neighborhood_id TEXT,
  unit_id TEXT,
  area_id TEXT,
  group_name TEXT,
  residence_status TEXT DEFAULT 'thuong-tru',
  voting_status TEXT DEFAULT 'chua-bau',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. BẢNG CANDIDATES
CREATE TABLE IF NOT EXISTS candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT CHECK (level IN ('phuong', 'thanh-pho', 'quoc-hoi')),
  unit_id TEXT,
  neighborhood_id TEXT,
  dob TEXT,
  gender TEXT,
  title TEXT,
  hometown TEXT,
  areas TEXT[],
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. BẢNG AREA_STATS
CREATE TABLE IF NOT EXISTS area_stats (
  area_id TEXT PRIMARY KEY,
  total_voters INTEGER DEFAULT 0,
  issued_votes INTEGER DEFAULT 0,
  received_votes INTEGER DEFAULT 0,
  valid_votes INTEGER DEFAULT 0,
  invalid_votes INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. BẢNG VOTING_RESULTS
CREATE TABLE IF NOT EXISTS voting_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id TEXT NOT NULL,
  candidate_id UUID NOT NULL,
  votes INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_area_candidate UNIQUE (area_id, candidate_id)
);

-- 6. BẢNG PROFILES
-- Cập nhật ràng buộc Role và Status chuẩn
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  role TEXT CHECK (role IN ('super_admin', 'ban_chi_dao', 'to_bau_cu', 'nhap_lieu', 'giam_sat', 'khach', 'admin_phuong')),
  unit_id TEXT,
  area_id TEXT,
  neighborhood_id TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'active',
  permissions JSONB,
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrations: Cập nhật Check Constraint cho status
DO $$ BEGIN
    -- Xóa constraint cũ nếu có để tránh lỗi conflict
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
    -- Thêm constraint mới bao gồm 'deleted'
    ALTER TABLE profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'locked', 'pending', 'deleted'));
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 7. BẢNG SYSTEM_LOGS
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT,
  action TEXT,
  details TEXT,
  ip_address TEXT,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. DATABASE FUNCTION: Tạo User (Auth + Profile)
DROP FUNCTION IF EXISTS create_system_user;

CREATE OR REPLACE FUNCTION create_system_user(
    p_email TEXT,
    p_password TEXT,
    p_username TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_unit_id TEXT DEFAULT NULL,
    p_area_id TEXT DEFAULT NULL,
    p_neighborhood_id TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_permissions JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pw TEXT;
    v_instance_id UUID;
BEGIN
    -- Lấy instance_id tự động từ database hiện tại
    SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
    IF v_instance_id IS NULL THEN
        -- Fallback về ID mặc định nếu chưa có user nào (hiếm gặp)
        v_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    -- Kiểm tra trùng username trong profiles
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username AND status != 'deleted') THEN
        RAISE EXCEPTION 'Tên đăng nhập "%" đã tồn tại', p_username;
    END IF;

    -- Kiểm tra trùng email trong auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'Email "%" đã được sử dụng', p_email;
    END IF;

    v_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- 1. Insert vào auth.users (Đảm bảo đầy đủ các cột bắt buộc của GoTrue)
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at, confirmation_token, recovery_token, 
        email_change_token_new, email_change, is_super_admin,
        last_sign_in_at, is_sso_user
    ) VALUES (
        v_instance_id,
        v_user_id,
        'authenticated',
        'authenticated',
        p_email,
        v_encrypted_pw,
        NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', p_full_name, 'role', p_role),
        NOW(),
        NOW(),
        '', '', '', '', false,
        NOW(), false
    );

    -- 2. Insert vào auth.identities (Bắt buộc cho các phiên bản Supabase mới để login được)
    -- Sử dụng email làm provider_id
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at,
        provider_id
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id, 'email', p_email),
        'email',
        NOW(),
        NOW(),
        NOW(),
        p_email
    );

    -- 3. Insert vào public.profiles (Tạo hồ sơ quản lý)
    INSERT INTO public.profiles (
        id, username, email, full_name, role, 
        unit_id, area_id, neighborhood_id, phone, permissions, 
        status, created_at
    ) VALUES (
        v_user_id, p_username, p_email, p_full_name, p_role, 
        p_unit_id, p_area_id, p_neighborhood_id, p_phone, p_permissions, 
        'active', NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        unit_id = EXCLUDED.unit_id,
        area_id = EXCLUDED.area_id,
        neighborhood_id = EXCLUDED.neighborhood_id,
        phone = EXCLUDED.phone,
        permissions = EXCLUDED.permissions,
        status = 'active';

    RETURN v_user_id;
END;
$$;

-- 9. DATABASE FUNCTION: Cập nhật User (Bao gồm Password)
DROP FUNCTION IF EXISTS update_system_user;

CREATE OR REPLACE FUNCTION update_system_user(
    p_user_id UUID,
    p_full_name TEXT,
    p_role TEXT,
    p_password TEXT DEFAULT NULL,
    p_unit_id TEXT DEFAULT NULL,
    p_area_id TEXT DEFAULT NULL,
    p_neighborhood_id TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_permissions JSONB DEFAULT NULL,
    p_status TEXT DEFAULT 'active'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    -- 1. Cập nhật bảng profiles
    UPDATE public.profiles
    SET 
        full_name = p_full_name,
        role = p_role,
        unit_id = p_unit_id,
        area_id = p_area_id,
        neighborhood_id = p_neighborhood_id,
        phone = p_phone,
        permissions = p_permissions,
        status = p_status
    WHERE id = p_user_id;

    -- 2. Cập nhật metadata trong auth.users (để đồng bộ role/tên)
    UPDATE auth.users
    SET 
        raw_user_meta_data = jsonb_build_object('full_name', p_full_name, 'role', p_role),
        updated_at = NOW(),
        banned_until = CASE WHEN p_status = 'locked' OR p_status = 'deleted' THEN '2099-12-31 00:00:00'::timestamp ELSE NULL END
    WHERE id = p_user_id;

    -- 3. Cập nhật mật khẩu NẾU có nhập (không rỗng)
    IF p_password IS NOT NULL AND p_password <> '' THEN
        UPDATE auth.users
        SET encrypted_password = crypt(p_password, gen_salt('bf'))
        WHERE id = p_user_id;
    END IF;
END;
$$;

-- 10. DATABASE FUNCTION: Xóa Mềm User (Soft Delete)
DROP FUNCTION IF EXISTS delete_system_user;

CREATE OR REPLACE FUNCTION delete_system_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_role TEXT;
    v_count INTEGER;
BEGIN
    -- Lấy role của user cần xóa
    SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;

    -- Kiểm tra nếu là Super Admin
    IF v_role = 'super_admin' THEN
        SELECT COUNT(*) INTO v_count FROM public.profiles WHERE role = 'super_admin' AND status != 'deleted';
        IF v_count <= 1 THEN
            RAISE EXCEPTION 'Không thể xóa tài khoản Super Admin cuối cùng của hệ thống.';
        END IF;
    END IF;

    -- SOFT DELETE: Update trạng thái profile
    UPDATE public.profiles 
    SET status = 'deleted', username = username || '_deleted_' || floor(extract(epoch from now()))
    WHERE id = p_user_id;

    -- SOFT DELETE: Ban user bên Auth (để không login được nữa)
    UPDATE auth.users 
    SET banned_until = '2099-12-31 00:00:00'::timestamp, 
        email = email || '_deleted_' || floor(extract(epoch from now()))
    WHERE id = p_user_id;
END;
$$;

-- --- SECURITY & PERMISSIONS CONFIGURATION ---

-- 1. Bật RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;


-- 2. Reset & Implement Specific Policies

-- MIGRATION: Master Reset Policies - Xóa tất cả policy cũ để tránh lỗi "already exists"
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Helper function to check if user is admin/management
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

-- --- PROFILES ---
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow all profiles" ON profiles;

CREATE POLICY "Admins can manage all profiles" ON profiles 
FOR ALL USING (is_admin());

CREATE POLICY "Users can view all profiles" ON profiles 
FOR SELECT USING (auth.uid() IS NOT NULL);

-- --- VOTERS ---
DROP POLICY IF EXISTS "Admins can manage all voters" ON voters;
DROP POLICY IF EXISTS "Scope-based voter access" ON voters;
DROP POLICY IF EXISTS "Scope-based voter update" ON voters;
DROP POLICY IF EXISTS "Allow all voters" ON voters;

CREATE POLICY "Admins can manage all voters" ON voters 
FOR ALL USING (is_admin());

CREATE POLICY "Scope-based voter access" ON voters 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      profiles.area_id = voters.area_id OR 
      profiles.unit_id = voters.unit_id OR
      profiles.neighborhood_id = voters.neighborhood_id
    )
    AND profiles.status = 'active'
  )
);

CREATE POLICY "Scope-based voter update" ON voters 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('nhap_lieu', 'to_bau_cu')
    AND (profiles.area_id = voters.area_id OR profiles.unit_id = voters.unit_id)
    AND profiles.status = 'active'
  )
);

CREATE POLICY "Scope-based voter insert" ON voters 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      profiles.role IN ('super_admin', 'ban_chi_dao', 'admin_phuong', 'nhap_lieu') -- Relaxed for Data Entry
      OR (profiles.role = 'to_bau_cu' AND (profiles.area_id = voters.area_id OR profiles.unit_id = voters.unit_id))
    )
    AND profiles.status = 'active'
  )
);

-- --- CANDIDATES ---
DROP POLICY IF EXISTS "Admins can manage candidates" ON candidates;
DROP POLICY IF EXISTS "Authenticated users can view candidates" ON candidates;
DROP POLICY IF EXISTS "Data entry can update candidates" ON candidates;
DROP POLICY IF EXISTS "Data entry can insert candidates" ON candidates;
DROP POLICY IF EXISTS "Allow all candidates" ON candidates;

CREATE POLICY "Admins can manage candidates" ON candidates 
FOR ALL USING (is_admin());

CREATE POLICY "Authenticated users can view candidates" ON candidates 
FOR SELECT USING (auth.uid() IS NOT NULL);

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

CREATE POLICY "Data entry can insert candidates" ON candidates 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('nhap_lieu', 'to_bau_cu', 'ban_chi_dao', 'admin_phuong')
    AND profiles.status = 'active'
  )
);

-- --- AREA_STATS ---
DROP POLICY IF EXISTS "Admins can manage area_stats" ON area_stats;
DROP POLICY IF EXISTS "Scope-based area_stats access" ON area_stats;
DROP POLICY IF EXISTS "Scope-based area_stats update" ON area_stats;
DROP POLICY IF EXISTS "Allow all area_stats" ON area_stats;

CREATE POLICY "Admins can manage area_stats" ON area_stats 
FOR ALL USING (is_admin());

CREATE POLICY "Scope-based area_stats access" ON area_stats 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.area_id = area_stats.area_id OR is_admin())
    AND profiles.status = 'active'
  )
);

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

-- --- VOTING_RESULTS ---
DROP POLICY IF EXISTS "Admins can manage voting_results" ON voting_results;
DROP POLICY IF EXISTS "Scope-based voting_results access" ON voting_results;
DROP POLICY IF EXISTS "Scope-based voting_results update" ON voting_results;
DROP POLICY IF EXISTS "Allow all voting_results" ON voting_results;

CREATE POLICY "Admins can manage voting_results" ON voting_results 
FOR ALL USING (is_admin());

CREATE POLICY "Scope-based voting_results access" ON voting_results 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.area_id = voting_results.area_id OR is_admin())
    AND profiles.status = 'active'
  )
);

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

-- --- SYSTEM_LOGS ---
DROP POLICY IF EXISTS "Admins can view all logs" ON system_logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON system_logs;
DROP POLICY IF EXISTS "Allow all system_logs" ON system_logs;

CREATE POLICY "Admins can view all logs" ON system_logs 
FOR SELECT USING (is_admin());

CREATE POLICY "Users can insert own logs" ON system_logs 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. CẤP QUYỀN TRUY CẬP RÕ RÀNG (VÁ LỖI SCHEMA LOGIN)
-- Cấp quyền Usage trên các schema cần thiết cho TẤT CẢ các role hệ thống
GRANT USAGE ON SCHEMA public TO anon, authenticated, authenticator, service_role, postgres;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, authenticator, service_role, postgres;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, authenticator, service_role, postgres;

-- Cấp toàn quyền trên các bảng, sequences và routines trong public
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, authenticator, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, authenticator, service_role, postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, authenticator, service_role, postgres;

-- Cấp quyền SELECT trên auth.users cho authenticator để login
GRANT SELECT ON auth.users TO authenticator, service_role;

-- 4. THIẾT LẬP SEARCH_PATH (QUAN TRỌNG ĐỂ VÁ LỖI "querying schema")
-- Đảm bảo authenticator và các role khác tìm thấy bảng profiles và auth.users
ALTER ROLE anon SET search_path = public, auth, extensions;
ALTER ROLE authenticated SET search_path = public, auth, extensions;
ALTER ROLE authenticator SET search_path = public, auth, extensions;
ALTER ROLE service_role SET search_path = public, auth, extensions;

-- Force refresh schema cache
NOTIFY pgrst, 'reload config';
