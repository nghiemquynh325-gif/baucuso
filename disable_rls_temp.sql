-- DISABLE RLS TEMPORARILY FOR IMPORT
ALTER TABLE candidates DISABLE ROW LEVEL SECURITY;

-- Reload config
NOTIFY pgrst, 'reload config';

-- ---------------------------------------------------------
-- AFTER IMPORT, RUN THIS TO RE-ENABLE:
-- ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
-- ---------------------------------------------------------
