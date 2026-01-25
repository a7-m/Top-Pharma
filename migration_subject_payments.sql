-- ==========================================
-- Migration: Subject Payments & Activation Codes
-- Purpose: Add pricing, activation codes, and subject access gating
-- ==========================================

-- 1. Add price to subjects
ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS price_egp INTEGER NOT NULL DEFAULT 20 CHECK (price_egp >= 0);

UPDATE public.subjects
SET price_egp = 20
WHERE price_egp IS NULL;

-- 2. Create subject access table
CREATE TABLE IF NOT EXISTS public.subject_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, subject_id)
);

-- 3. Create activation codes table
CREATE TABLE IF NOT EXISTS public.subject_activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    subject_id UUID NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subject_access_user_id ON public.subject_access (user_id);
CREATE INDEX IF NOT EXISTS idx_subject_access_subject_id ON public.subject_access (subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_activation_codes_subject_id ON public.subject_activation_codes (subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_activation_codes_code ON public.subject_activation_codes (code);

-- 5. Enable RLS
ALTER TABLE public.subject_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_activation_codes ENABLE ROW LEVEL SECURITY;

-- 6. Policies
-- Subjects: allow admins to update pricing
CREATE POLICY "Admins can update subjects" ON public.subjects FOR
UPDATE USING (
    auth.uid () IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
);

-- Subject access: users can view their access
CREATE POLICY "Users can view their subject access" ON public.subject_access FOR
SELECT USING (auth.uid () = user_id);

-- Subject access: admins can manage access
CREATE POLICY "Admins can manage subject access" ON public.subject_access FOR ALL
USING (
    auth.uid () IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
)
WITH CHECK (
    auth.uid () IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
);

-- Activation codes: admins only
CREATE POLICY "Admins can manage activation codes" ON public.subject_activation_codes FOR ALL
USING (
    auth.uid () IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
)
WITH CHECK (
    auth.uid () IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
);

-- 7. Secure activation function
CREATE OR REPLACE FUNCTION public.activate_subject_access(
    p_subject_id UUID,
    p_code TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
DECLARE
    v_code_record RECORD;
BEGIN
    IF auth.uid () IS NULL THEN
        RETURN QUERY SELECT FALSE, 'يجب تسجيل الدخول أولاً';
        RETURN;
    END IF;

    SELECT *
    INTO v_code_record
    FROM public.subject_activation_codes
    WHERE subject_id = p_subject_id
      AND code = p_code
      AND is_used = FALSE
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'كود التفعيل غير صالح أو مستخدم';
        RETURN;
    END IF;

    UPDATE public.subject_activation_codes
    SET is_used = TRUE,
        used_by = auth.uid (),
        used_at = NOW()
    WHERE id = v_code_record.id;

    INSERT INTO public.subject_access (user_id, subject_id, activated_at)
    VALUES (auth.uid (), p_subject_id, NOW())
    ON CONFLICT (user_id, subject_id)
    DO UPDATE SET activated_at = EXCLUDED.activated_at;

    RETURN QUERY SELECT TRUE, 'تم تفعيل المادة بنجاح';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.activate_subject_access(UUID, TEXT) TO authenticated;

-- 8. Update RLS for videos/quizzes/files/questions to require subject access
DROP POLICY IF EXISTS "Authenticated users can view videos" ON public.videos;
DROP POLICY IF EXISTS "Authenticated users can view quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Authenticated users can view questions" ON public.questions;
DROP POLICY IF EXISTS "Authenticated users can view files" ON public.files;

CREATE POLICY "Users can view videos for accessible subjects" ON public.videos FOR
SELECT USING (
    auth.uid () IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR subject_id IS NULL
    OR EXISTS (
        SELECT 1
        FROM public.subject_access sa
        WHERE sa.user_id = auth.uid ()
          AND sa.subject_id = subject_id
    )
);

CREATE POLICY "Users can view quizzes for accessible subjects" ON public.quizzes FOR
SELECT USING (
    auth.uid () IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR subject_id IS NULL
    OR EXISTS (
        SELECT 1
        FROM public.subject_access sa
        WHERE sa.user_id = auth.uid ()
          AND sa.subject_id = subject_id
    )
);

CREATE POLICY "Users can view questions for accessible subjects" ON public.questions FOR
SELECT USING (
    auth.uid () IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR EXISTS (
        SELECT 1
        FROM public.quizzes q
        WHERE q.id = quiz_id
          AND (
              q.subject_id IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM public.subject_access sa
                  WHERE sa.user_id = auth.uid ()
                    AND sa.subject_id = q.subject_id
              )
          )
    )
);

CREATE POLICY "Users can view files for accessible subjects" ON public.files FOR
SELECT USING (
    auth.uid () IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR subject_id IS NULL
    OR EXISTS (
        SELECT 1
        FROM public.subject_access sa
        WHERE sa.user_id = auth.uid ()
          AND sa.subject_id = subject_id
    )
);

-- ==========================================
-- Migration Complete!
-- Next steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Add activation codes in table subject_activation_codes
-- 3. Set subject prices in subjects.price_egp
-- ==========================================
