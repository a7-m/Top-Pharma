-- ==========================================
-- Migration: Restructure to Section-Based System
-- Purpose: Replace subject-level activation with section-level activation
-- ==========================================

-- ==========================================
-- 1. Clean up old subjects (keep only Pharmacognosy)
-- ==========================================

-- Delete subjects we don't need
DELETE FROM public.subjects WHERE name_en NOT IN('Pharmacognosy');

-- Update Pharmacognosy if it exists, otherwise insert it
INSERT INTO public.subjects (name_en, name_ar, description, icon, "order")
VALUES (
    'Pharmacognosy',
    'علم العقاقير',
    'علم دراسة الأدوية المستخرجة من مصادر طبيعية',
    '💊',
    1
) ON CONFLICT (name_en) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    "order" = EXCLUDED."order";

-- Add Organic 2 subject
INSERT INTO
    public.subjects (
        name_en,
        name_ar,
        description,
        icon,
        "order"
    )
VALUES (
        'Organic 2',
        'عضوية 2',
        'الكيمياء العضوية المتقدمة - المستوى الثاني',
        '🧪',
        2
    ) ON CONFLICT (name_en) DO NOTHING;

-- ==========================================
-- 2. Create subject_sections table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.subject_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    subject_id UUID NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description TEXT,
    section_order INTEGER NOT NULL,
    price_egp INTEGER NOT NULL DEFAULT 0 CHECK (price_egp >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (subject_id, section_order)
);

-- ==========================================
-- 3. Add section_id to content tables
-- ==========================================

ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.subject_sections (id) ON DELETE SET NULL;

ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.subject_sections (id) ON DELETE SET NULL;

ALTER TABLE public.files
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.subject_sections (id) ON DELETE SET NULL;

-- ==========================================
-- 4. Create section_access table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.section_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.subject_sections (id) ON DELETE CASCADE,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, section_id)
);

-- ==========================================
-- 5. Create section_activation_codes table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.section_activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    section_id UUID NOT NULL REFERENCES public.subject_sections (id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. Create indexes for performance
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_subject_sections_subject_id ON public.subject_sections (subject_id);

CREATE INDEX IF NOT EXISTS idx_subject_sections_order ON public.subject_sections (section_order);

CREATE INDEX IF NOT EXISTS idx_videos_section_id ON public.videos (section_id);

CREATE INDEX IF NOT EXISTS idx_quizzes_section_id ON public.quizzes (section_id);

CREATE INDEX IF NOT EXISTS idx_files_section_id ON public.files (section_id);

CREATE INDEX IF NOT EXISTS idx_section_access_user_id ON public.section_access (user_id);

CREATE INDEX IF NOT EXISTS idx_section_access_section_id ON public.section_access (section_id);

CREATE INDEX IF NOT EXISTS idx_section_activation_codes_section_id ON public.section_activation_codes (section_id);

CREATE INDEX IF NOT EXISTS idx_section_activation_codes_code ON public.section_activation_codes (code);

-- ==========================================
-- 7. Enable RLS on new tables
-- ==========================================

ALTER TABLE public.subject_sections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.section_access ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.section_activation_codes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 8. RLS Policies for subject_sections
-- ==========================================

CREATE POLICY "Authenticated users can view sections" ON public.subject_sections FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Admins can manage sections" ON public.subject_sections FOR ALL USING (public.is_admin ())
WITH
    CHECK (public.is_admin ());

-- ==========================================
-- 9. RLS Policies for section_access
-- ==========================================

CREATE POLICY "Users can view their section access" ON public.section_access FOR
SELECT USING (auth.uid () = user_id);

CREATE POLICY "Users can insert their section access" ON public.section_access FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Admins can manage section access" ON public.section_access FOR ALL USING (public.is_admin ())
WITH
    CHECK (public.is_admin ());

-- ==========================================
-- 10. RLS Policies for section_activation_codes
-- ==========================================

CREATE POLICY "Admins can manage activation codes" ON public.section_activation_codes FOR ALL USING (public.is_admin ())
WITH
    CHECK (public.is_admin ());

-- ==========================================
-- 11. Update content RLS policies to use sections
-- ==========================================

-- Drop old subject-based policies
DROP POLICY IF EXISTS "Users can view videos for accessible subjects" ON public.videos;

DROP POLICY IF EXISTS "Users can view quizzes for accessible subjects" ON public.quizzes;

DROP POLICY IF EXISTS "Users can view questions for accessible subjects" ON public.questions;

DROP POLICY IF EXISTS "Users can view files for accessible subjects" ON public.files;

-- Create new section-based policies
CREATE POLICY "Users can view videos for accessible sections" ON public.videos FOR
SELECT USING (
        public.is_admin ()
        OR section_id IS NULL
        OR subject_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.section_access sa
            WHERE
                sa.user_id = auth.uid ()
                AND sa.section_id = videos.section_id
        )
    );

CREATE POLICY "Users can view quizzes for accessible sections" ON public.quizzes FOR
SELECT USING (
        public.is_admin ()
        OR section_id IS NULL
        OR subject_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.section_access sa
            WHERE
                sa.user_id = auth.uid ()
                AND sa.section_id = quizzes.section_id
        )
    );

CREATE POLICY "Users can view questions for accessible sections" ON public.questions FOR
SELECT USING (
        public.is_admin ()
        OR EXISTS (
            SELECT 1
            FROM public.quizzes q
            WHERE
                q.id = questions.quiz_id
                AND (
                    q.section_id IS NULL
                    OR q.subject_id IS NULL
                    OR EXISTS (
                        SELECT 1
                        FROM public.section_access sa
                        WHERE
                            sa.user_id = auth.uid ()
                            AND sa.section_id = q.section_id
                    )
                )
        )
    );

CREATE POLICY "Users can view files for accessible sections" ON public.files FOR
SELECT USING (
        public.is_admin ()
        OR section_id IS NULL
        OR subject_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.section_access sa
            WHERE
                sa.user_id = auth.uid ()
                AND sa.section_id = files.section_id
        )
    );

-- ==========================================
-- 12. Create section activation function
-- ==========================================

CREATE OR REPLACE FUNCTION public.activate_section_access(
    p_section_id UUID,
    p_code TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
DECLARE
    v_code_record RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT FALSE, 'يجب تسجيل الدخول أولاً';
        RETURN;
    END IF;

    SELECT *
    INTO v_code_record
    FROM public.section_activation_codes
    WHERE section_id = p_section_id
      AND code = p_code
      AND is_used = FALSE
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'كود التفعيل غير صالح أو مستخدم';
        RETURN;
    END IF;

    UPDATE public.section_activation_codes
    SET is_used = TRUE,
        used_by = auth.uid(),
        used_at = NOW()
    WHERE id = v_code_record.id;

    INSERT INTO public.section_access (user_id, section_id, activated_at)
    VALUES (auth.uid(), p_section_id, NOW())
    ON CONFLICT (user_id, section_id)
    DO UPDATE SET activated_at = EXCLUDED.activated_at;

    RETURN QUERY SELECT TRUE, 'تم تفعيل القسم بنجاح';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT
EXECUTE ON FUNCTION public.activate_section_access (UUID, TEXT) TO authenticated;

-- ==========================================
-- 13. Insert sections for both subjects
-- ==========================================

DO $$
DECLARE
    v_pharmacognosy_id UUID;
    v_organic2_id UUID;
BEGIN
    -- Get subject IDs
    SELECT id INTO v_pharmacognosy_id FROM public.subjects WHERE name_en = 'Pharmacognosy' LIMIT 1;
    SELECT id INTO v_organic2_id FROM public.subjects WHERE name_en = 'Organic 2' LIMIT 1;

    -- Insert sections for Pharmacognosy
    IF v_pharmacognosy_id IS NOT NULL THEN
        INSERT INTO public.subject_sections (subject_id, name_ar, name_en, description, section_order, price_egp)
        VALUES
            (v_pharmacognosy_id, 'الشهر الأول', 'Month 1', 'محتوى الشهر الأول', 1, 50),
            (v_pharmacognosy_id, 'الشهر الثاني + مراجعة الميد', 'Month 2 + Midterm Review', 'محتوى الشهر الثاني ومراجعة اختبار المنتصف', 2, 50),
            (v_pharmacognosy_id, 'الشهر الثالث', 'Month 3', 'محتوى الشهر الثالث', 3, 50),
            (v_pharmacognosy_id, 'مراجعة الفاينال', 'Final Review', 'مراجعة شاملة للاختبار النهائي', 4, 50)
        ON CONFLICT (subject_id, section_order) DO NOTHING;
    END IF;

    -- Insert sections for Organic 2
    IF v_organic2_id IS NOT NULL THEN
        INSERT INTO public.subject_sections (subject_id, name_ar, name_en, description, section_order, price_egp)
        VALUES
            (v_organic2_id, 'الشهر الأول', 'Month 1', 'محتوى الشهر الأول', 1, 50),
            (v_organic2_id, 'الشهر الثاني + مراجعة الميد', 'Month 2 + Midterm Review', 'محتوى الشهر الثاني ومراجعة اختبار المنتصف', 2, 50),
            (v_organic2_id, 'الشهر الثالث', 'Month 3', 'محتوى الشهر الثالث', 3, 50),
            (v_organic2_id, 'مراجعة الفاينال', 'Final Review', 'مراجعة شاملة للاختبار النهائي', 4, 50)
        ON CONFLICT (subject_id, section_order) DO NOTHING;
    END IF;
END $$;

-- ==========================================
-- 14. Drop old subject-level access tables
-- ==========================================

-- Note: We're keeping the old tables for now in case of rollback
-- To fully remove, uncomment these lines:
-- DROP TABLE IF EXISTS public.subject_activation_codes CASCADE;
-- DROP TABLE IF EXISTS public.subject_access CASCADE;

-- Remove price from subjects table
ALTER TABLE public.subjects DROP COLUMN IF EXISTS price_egp;

-- ==========================================
-- 15. Add trigger for updated_at on sections
-- ==========================================

CREATE TRIGGER update_subject_sections_updated_at
    BEFORE UPDATE ON public.subject_sections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Migration Complete!
-- ==========================================

-- Next steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Verify sections are created (8 sections total: 4 per subject)
-- 3. Generate activation codes for each section
-- 4. Update frontend to use section-based access