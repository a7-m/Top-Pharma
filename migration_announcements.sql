-- ==========================================
-- Migration: Announcements System
-- Purpose: Add announcements banner feature
-- ==========================================

-- ==========================================
-- 1. Create announcements table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    title_ar TEXT NOT NULL,
    content_ar TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (
        type IN (
            'info',
            'warning',
            'success',
            'error'
        )
    ),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. Create RLS Policies
-- ==========================================

-- Policy: All authenticated users can view active announcements
CREATE POLICY "Users can view active announcements" ON public.announcements FOR
SELECT USING (
        is_active = TRUE
        AND auth.role () = 'authenticated'
    );

-- Policy: Only admins can insert announcements
CREATE POLICY "Admins can insert announcements" ON public.announcements FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE
                id = auth.uid ()
                AND role = 'admin'
        )
    );

-- Policy: Only admins can update announcements
CREATE POLICY "Admins can update announcements" ON public.announcements FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE
            id = auth.uid ()
            AND role = 'admin'
    )
);

-- Policy: Only admins can delete announcements
CREATE POLICY "Admins can delete announcements" ON public.announcements FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE
            id = auth.uid ()
            AND role = 'admin'
    )
);

-- ==========================================
-- 4. Create Indexes for Performance
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements (is_active)
WHERE
    is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements (created_at DESC);

-- ==========================================
-- 5. Create Trigger for Updated At Timestamp
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE
ON public.announcements
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- ==========================================
-- 6. Insert Sample Announcements (Optional)
-- ==========================================
-- Uncomment to add sample data
/*
INSERT INTO public.announcements (title_ar, content_ar, type, is_active)
VALUES 
('مرحباً بكم في منصة Top Pharma', 'نسعد بانضمامكم إلى منصتنا التعليمية. استمتعوا بمحتوى تعليمي عالي الجودة!', 'success', true),
('صيانة مجدولة', 'ستكون المنصة في وضع الصيانة يوم الجمعة من الساعة 12 ص إلى 2 ص', 'warning', false);
*/