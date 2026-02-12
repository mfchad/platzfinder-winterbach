
-- Add IP tracking column (nullable, not exposed to public)
ALTER TABLE public.bookings ADD COLUMN created_by_ip text;
