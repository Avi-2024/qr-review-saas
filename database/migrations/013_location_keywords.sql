-- Add keywords column to locations for product and service SEO review generation
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS keywords TEXT NOT NULL DEFAULT '';
