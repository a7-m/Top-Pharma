-- Add hosting ID columns to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS cloudinary_id TEXT;

ALTER TABLE files ADD COLUMN IF NOT EXISTS google_drive_id TEXT;

-- Just in case file_url needs higher capacity or changing type (optional/safe)
-- ALTER TABLE files ALTER COLUMN file_url TYPE TEXT;