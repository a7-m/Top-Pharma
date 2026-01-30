-- ==========================================
-- Migration: Discount Codes System
-- Purpose: Add discount code functionality with expiration and usage limits
-- ==========================================

-- ==========================================
-- 1. Create discount_codes table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    discount_percentage INTEGER NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
    max_uses INTEGER DEFAULT NULL,  -- NULL means unlimited uses
    used_count INTEGER DEFAULT 0,
   expires_at TIMESTAMPTZ DEFAULT NULL,  -- NULL means no expiration
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

-- Ensure code is uppercase and has no spaces
CONSTRAINT code_format CHECK (code = UPPER(code) AND code !~ '\s') );

-- ==========================================
-- 2. Create user_discount_codes table
-- Link users to discount codes they received
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_discount_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.subject_sections(id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ DEFAULT NOW(),

-- Ensure unique combination: one discount code per user per section
UNIQUE(user_id, section_id) );

-- ==========================================
-- 3. Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_discount_codes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. Create RLS Policies - discount_codes
-- ==========================================

-- Policy: All authenticated users can view active, non-expired discount codes
CREATE POLICY "Users can view active discount codes" ON public.discount_codes FOR
SELECT USING (
        is_active = TRUE
        AND (
            expires_at IS NULL
            OR expires_at > NOW()
        )
        AND auth.role () = 'authenticated'
    );

-- Policy: Only admins can insert discount codes
CREATE POLICY "Admins can insert discount codes" ON public.discount_codes FOR
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

-- Policy: Only admins can update discount codes
CREATE POLICY "Admins can update discount codes" ON public.discount_codes FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE
            id = auth.uid ()
            AND role = 'admin'
    )
);

-- Policy: Only admins can delete discount codes
CREATE POLICY "Admins can delete discount codes" ON public.discount_codes FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE
            id = auth.uid ()
            AND role = 'admin'
    )
);

-- ==========================================
-- 5. Create RLS Policies - user_discount_codes
-- ==========================================

-- Policy: Users can view their own discount codes
CREATE POLICY "Users can view their discount codes" ON public.user_discount_codes FOR
SELECT USING (auth.uid () = user_id);

-- Policy: Admins can view all user discount codes
CREATE POLICY "Admins can view all user discount codes" ON public.user_discount_codes FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE
                id = auth.uid ()
                AND role = 'admin'
        )
    );

-- Policy: System can insert user discount codes (via function)
CREATE POLICY "System can insert user discount codes" ON public.user_discount_codes FOR
INSERT
WITH
    CHECK (true);

-- ==========================================
-- 6. Create Indexes for Performance
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes (code);

CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON public.discount_codes (is_active)
WHERE
    is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_discount_codes_expires_at ON public.discount_codes (expires_at)
WHERE
    expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_discount_codes_user_id ON public.user_discount_codes (user_id);

CREATE INDEX IF NOT EXISTS idx_user_discount_codes_section_id ON public.user_discount_codes (section_id);

-- ==========================================
-- 7. Create Trigger for Updated At Timestamp
-- ==========================================
CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE
ON public.discount_codes
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- ==========================================
-- 8. Create Function to Generate Discount Code for User
-- This function is called when a user activates a section
-- ==========================================
CREATE OR REPLACE FUNCTION generate_discount_code_for_user(
    p_user_id UUID,
    p_section_id UUID
)
RETURNS TABLE (
    discount_code TEXT,
    discount_percentage INTEGER,
    expires_at TIMESTAMPTZ
) AS $$
DECLARE
    v_discount_code_id UUID;
    v_code TEXT;
    v_percentage INTEGER;
    v_expires TIMESTAMPTZ;
BEGIN
    -- Check if user already has a discount code for this section
    IF EXISTS (
        SELECT 1 FROM public.user_discount_codes
        WHERE user_id = p_user_id AND section_id = p_section_id
    ) THEN
        -- Return existing discount code
        SELECT dc.code, dc.discount_percentage, dc.expires_at
        INTO v_code, v_percentage, v_expires
        FROM public.user_discount_codes udc
        JOIN public.discount_codes dc ON udc.discount_code_id = dc.id
        WHERE udc.user_id = p_user_id AND udc.section_id = p_section_id;
        
        RETURN QUERY SELECT v_code, v_percentage, v_expires;
        RETURN;
    END IF;

    -- Find an available discount code (active, not expired, under max_uses)
    SELECT id, code, discount_percentage, expires_at
    INTO v_discount_code_id, v_code, v_percentage, v_expires
    FROM public.discount_codes
    WHERE is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_uses IS NULL OR used_count < max_uses)
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no discount code found, return NULL
    IF v_discount_code_id IS NULL THEN
        RETURN;
    END IF;

    -- Create user discount code record
    INSERT INTO public.user_discount_codes (user_id, discount_code_id, section_id)
    VALUES (p_user_id, v_discount_code_id, p_section_id);

    -- Increment used_count
    UPDATE public.discount_codes
    SET used_count = used_count + 1
    WHERE id = v_discount_code_id;

    RETURN QUERY SELECT v_code, v_percentage, v_expires;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 9. Create Function to Validate and Apply Discount Code
-- ==========================================
CREATE OR REPLACE FUNCTION validate_discount_code(
    p_code TEXT,
    p_section_id UUID
)
RETURNS TABLE (
    is_valid BOOLEAN,
    discount_percentage INTEGER,
    message TEXT
) AS $$
DECLARE
    v_discount_code RECORD;
BEGIN
    -- Find the discount code
    SELECT * INTO v_discount_code
    FROM public.discount_codes
    WHERE code = UPPER(p_code)
    LIMIT 1;

    -- Check if code exists
    IF v_discount_code IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'كود الخصم غير صحيح'::TEXT;
        RETURN;
    END IF;

    -- Check if code is active
    IF NOT v_discount_code.is_active THEN
        RETURN QUERY SELECT FALSE, 0, 'كود الخصم غير نشط'::TEXT;
        RETURN;
    END IF;

    -- Check if code is expired
    IF v_discount_code.expires_at IS NOT NULL AND v_discount_code.expires_at < NOW() THEN
        RETURN QUERY SELECT FALSE, 0, 'كود الخصم منتهي الصلاحية'::TEXT;
        RETURN;
    END IF;

    -- Check if code has reached max uses
    IF v_discount_code.max_uses IS NOT NULL AND v_discount_code.used_count >= v_discount_code.max_uses THEN
        RETURN QUERY SELECT FALSE, 0, 'كود الخصم وصل للحد الأقصى من الاستخدامات'::TEXT;
        RETURN;
    END IF;

    -- Code is valid
    RETURN QUERY SELECT TRUE, v_discount_code.discount_percentage, 'كود الخصم صالح'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 10. Insert Sample Discount Codes (Optional)
-- ==========================================
-- Uncomment to add sample data
/*
INSERT INTO public.discount_codes (code, discount_percentage, max_uses, expires_at, is_active)
VALUES 
('WELCOME20', 20, 100, NOW() + INTERVAL '30 days', true),
('STUDENT15', 15, NULL, NULL, true),
('NEWYEAR25', 25, 50, NOW() + INTERVAL '7 days', true);
*/