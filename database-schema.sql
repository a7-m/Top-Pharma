-- Top Pharma Platform Database Schema
-- Run this SQL in your Supabase SQL Editor

-- ==========================================
-- 1. Enable necessary extensions
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. Create profiles table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. Create videos table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN (
            'lecture',
            'review',
            'application'
        )
    ),
    duration INTEGER, -- in seconds
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. Create quizzes table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    title TEXT NOT NULL,
    description TEXT,
    passing_score INTEGER DEFAULT 50,
    time_limit INTEGER, -- in minutes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. Create questions table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    quiz_id UUID NOT NULL REFERENCES public.quizzes (id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of answer options
    correct_answer INTEGER NOT NULL, -- Index of correct answer (0-based)
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. Create quiz_attempts table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES public.quizzes (id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    answers JSONB NOT NULL, -- User's answers
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. Create files table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT, -- in bytes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 8. Create indexes for better performance
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_videos_category ON public.videos (category);

CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions (quiz_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts (user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts (quiz_id);

CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files (created_at DESC);

-- ==========================================
-- 9. Row Level Security (RLS) Policies
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR
SELECT USING (auth.uid () = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR
INSERT
WITH
    CHECK (auth.uid () = id);

CREATE POLICY "Users can update their own profile" ON public.profiles FOR
UPDATE USING (auth.uid () = id);

-- Videos policies (read-only for authenticated users)
CREATE POLICY "Authenticated users can view videos" ON public.videos FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

-- Quizzes policies (read-only for authenticated users)
CREATE POLICY "Authenticated users can view quizzes" ON public.quizzes FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

-- Questions policies (read-only for authenticated users)
CREATE POLICY "Authenticated users can view questions" ON public.questions FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

-- Quiz attempts policies
CREATE POLICY "Users can view their own quiz attempts" ON public.quiz_attempts FOR
SELECT USING (auth.uid () = user_id);

CREATE POLICY "Users can insert their own quiz attempts" ON public.quiz_attempts FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

-- Files policies (read-only for authenticated users)
CREATE POLICY "Authenticated users can view files" ON public.files FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

-- ==========================================
-- 10. Trigger for automatic profile creation
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name', 
            NEW.raw_user_meta_data->>'name',
            ''
        ),
        NEW.email,
        NULLIF(NEW.raw_user_meta_data->>'phone', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 11. Sample data (for testing)
-- ==========================================

-- Insert sample videos
INSERT INTO
    public.videos (
        title,
        description,
        video_url,
        category,
        duration,
        thumbnail_url
    )
VALUES (
        'مقدمة في علم الصيدلة',
        'محاضرة تعريفية شاملة عن علم الصيدلة وأهميته',
        'sample-videos/intro-pharmacy.mp4',
        'lecture',
        3600,
        NULL
    ),
    (
        'مراجعة الأدوية المضادة للالتهابات',
        'مراجعة شاملة للأدوية المضادة للالتهاب وآليات عملها',
        'sample-videos/anti-inflammatory-review.mp4',
        'review',
        2400,
        NULL
    ),
    (
        'تطبيق عملي: تحضير المحاليل الدوائية',
        'تطبيق عملي على تحضير المحاليل الدوائية في المختبر',
        'sample-videos/solutions-practical.mp4',
        'application',
        1800,
        NULL
    );

-- Insert sample quiz
INSERT INTO
    public.quizzes (
        title,
        description,
        passing_score,
        time_limit
    )
VALUES (
        'اختبار أساسيات علم الصيدلة',
        'اختبار شامل لقياس فهمك لأساسيات علم الصيدلة',
        70,
        30
    );

-- Get the quiz ID
DO $$
DECLARE
    quiz_id UUID;
BEGIN
    SELECT id INTO quiz_id FROM public.quizzes WHERE title = 'اختبار أساسيات علم الصيدلة' LIMIT 1;
    
    -- Insert sample questions
    INSERT INTO public.questions (quiz_id, question_text, options, correct_answer, "order") VALUES
    (quiz_id, 'ما هو تعريف علم الصيدلة؟', 
     '["علم يدرس الأدوية وتأثيرها على الجسم", "علم يدرس النباتات الطبية فقط", "علم يدرس الكيمياء العضوية", "علم يدرس الأمراض"]'::jsonb, 
     0, 1),
    (quiz_id, 'أي من الأدوية التالية يعتبر مضاداً حيوياً؟', 
     '["الباراسيتامول", "الأسبرين", "الأموكسيسيلين", "الإيبوبروفين"]'::jsonb, 
     2, 2),
    (quiz_id, 'ما هي الوحدة الأساسية لقياس جرعة الدواء؟', 
     '["الجرام (g)", "الملليجرام (mg)", "كلاهما صحيح", "لا شيء مما سبق"]'::jsonb, 
     2, 3);
END $$;

-- Insert sample files
INSERT INTO
    public.files (
        title,
        description,
        file_url,
        file_type,
        file_size
    )
VALUES (
        'كتاب أساسيات علم الصيدلة',
        'كتاب شامل عن أساسيات علم الصيدلة للمبتدئين',
        'sample-files/pharmacy-basics.pdf',
        'pdf',
        2048000
    ),
    (
        'ملخص الأدوية الشائعة',
        'ملخص شامل للأدوية الشائعة واستخداماتها',
        'sample-files/common-drugs-summary.pdf',
        'pdf',
        1024000
    ),
    (
        'جداول التصنيف الدوائي',
        'جداول مفصلة لتصنيف الأدوية حسب الفئات',
        'sample-files/drug-classification-tables.pdf',
        'pdf',
        512000
    );

-- ==========================================
-- Migration complete!
-- ==========================================

-- Next steps:
-- 1. Create two storage buckets in Supabase:
--    - 'videos' (for video files)
--    - 'files' (for PDF and other documents)
-- 2. Configure bucket policies to allow authenticated users to read
-- 3. Upload sample content if desired