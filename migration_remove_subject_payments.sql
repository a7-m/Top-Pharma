-- ==========================================
-- Migration: Remove Subject-Level Payment System
-- Purpose: Remove subject activation/payment, keep only section-level payments
-- ==========================================

-- ==========================================
-- 1. Drop subject-level activation tables
-- ==========================================

-- Drop subject activation codes table
DROP TABLE IF EXISTS public.subject_activation_codes CASCADE;

-- Drop subject access table
DROP TABLE IF EXISTS public.subject_access CASCADE;

-- ==========================================
-- 2. Drop subject activation function (if exists)
-- ==========================================

DROP FUNCTION IF EXISTS public.activate_subject_access (UUID, TEXT) CASCADE;

-- ==========================================
-- 3. Remove price column from subjects table
-- ==========================================

ALTER TABLE public.subjects DROP COLUMN IF EXISTS price_egp CASCADE;

-- ==========================================
-- 4. Update RLS policies for subjects
-- ==========================================

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view accessible subjects" ON public.subjects;

DROP POLICY IF EXISTS "Users can view subjects they have access to" ON public.subjects;

-- Create new policy: all authenticated users can view all subjects
DROP POLICY IF EXISTS "All authenticated users can view subjects" ON public.subjects;

CREATE POLICY "All authenticated users can view subjects" ON public.subjects FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

-- Admins can manage subjects (keep this policy)
DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;

CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL USING (public.is_admin ())
WITH
    CHECK (public.is_admin ());

-- ==========================================
-- 5. Verify section-level payment system is intact
-- ==========================================

-- The following tables should still exist:
-- - subject_sections (sections for each subject)
-- - section_access (user access to sections)
-- - section_activation_codes (activation codes for sections)

-- Verify section activation function still exists
-- This function should still work: public.activate_section_access(UUID, TEXT)

-- ==========================================
-- Migration Complete!
-- ==========================================

-- Next steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Verify that subjects are now visible to all authenticated users
-- 3. Verify that section-level payment system still works
-- 4. Update frontend to remove subject payment references