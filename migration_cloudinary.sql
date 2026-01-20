-- Add cloudinary_id column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS cloudinary_id TEXT;

-- Ensure video_url can store long URLs (TEXT is already standard, but good to be safe)
-- ALTER TABLE videos ALTER COLUMN video_url TYPE TEXT;