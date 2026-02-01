-- Migration: Enhanced Row Level Security (RLS) Policies
-- Purpose: Restrict direct database access to authorized users only
-- Run this in Supabase SQL Editor

-- ===== ENABLE RLS ON ALL CONTENT TABLES =====

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

ALTER TABLE section_access ENABLE ROW LEVEL SECURITY;

-- ===== DROP EXISTING POLICIES (if any) =====

DROP POLICY IF EXISTS "videos_admin_all" ON videos;

DROP POLICY IF EXISTS "videos_user_read" ON videos;

DROP POLICY IF EXISTS "quizzes_admin_all" ON quizzes;

DROP POLICY IF EXISTS "quizzes_user_read" ON quizzes;

DROP POLICY IF EXISTS "files_admin_all" ON files;

DROP POLICY IF EXISTS "files_user_read" ON files;

DROP POLICY IF EXISTS "section_access_admin_all" ON section_access;

DROP POLICY IF EXISTS "section_access_user_read" ON section_access;

-- ===== VIDEOS TABLE POLICIES =====

-- Admins can do everything
CREATE POLICY "videos_admin_all" ON videos FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE
            profiles.id = auth.uid ()
            AND profiles.role = 'admin'
    )
);

-- Users can only read videos from sections they have access to
CREATE POLICY "videos_user_read" ON videos FOR
SELECT TO authenticated USING (
        -- Check if user has access to the section
        EXISTS (
            SELECT 1
            FROM section_access
            WHERE
                section_access.user_id = auth.uid ()
                AND section_access.section_id = videos.section_id
        )
    );

-- ===== QUIZZES TABLE POLICIES =====

-- Admins can do everything
CREATE POLICY "quizzes_admin_all" ON quizzes FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE
            profiles.id = auth.uid ()
            AND profiles.role = 'admin'
    )
);

-- Users can only read quizzes from sections they have access to
CREATE POLICY "quizzes_user_read" ON quizzes FOR
SELECT TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM section_access
            WHERE
                section_access.user_id = auth.uid ()
                AND section_access.section_id = quizzes.section_id
        )
    );

-- ===== FILES TABLE POLICIES =====

-- Admins can do everything
CREATE POLICY "files_admin_all" ON files FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE
            profiles.id = auth.uid ()
            AND profiles.role = 'admin'
    )
);

-- Users can only read files from sections they have access to
CREATE POLICY "files_user_read" ON files FOR
SELECT TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM section_access
            WHERE
                section_access.user_id = auth.uid ()
                AND section_access.section_id = files.section_id
        )
    );

-- ===== SECTION_ACCESS TABLE POLICIES =====

-- Admins can do everything
CREATE POLICY "section_access_admin_all" ON section_access FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE
            profiles.id = auth.uid ()
            AND profiles.role = 'admin'
    )
);

-- Users can only read their own access records
CREATE POLICY "section_access_user_read" ON section_access FOR
SELECT TO authenticated USING (
        section_access.user_id = auth.uid ()
    );

-- ===== VERIFICATION QUERIES =====

-- Test 1: Check if RLS is enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('videos', 'quizzes', 'files', 'section_access');

-- Test 2: View all policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('videos', 'quizzes', 'files', 'section_access')
-- ORDER BY tablename, policyname;