
-- Add coordinator_name to classes table so each teacher can define their coordinator per class
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS coordinator_name text;

-- Add active_school_year to school_info so admin can set the current academic year
ALTER TABLE public.school_info ADD COLUMN IF NOT EXISTS active_school_year integer DEFAULT (EXTRACT(year FROM now()))::integer;
