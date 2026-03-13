
-- Add total count tracking for series
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS recurrence_total_count integer;

-- Change FK to SET NULL to prevent cascade deletion of entire series
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_recurrence_parent_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_recurrence_parent_id_fkey 
  FOREIGN KEY (recurrence_parent_id) REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Update the bookings_public view to include the new column
CREATE OR REPLACE VIEW public.bookings_public AS
SELECT 
  id, court_number, date, start_hour, booking_type,
  booker_vorname, booker_nachname, booker_geburtsjahr, booker_comment,
  partner_vorname, partner_nachname, partner_geburtsjahr, partner_comment,
  double_match_names, special_label,
  recurrence_type, recurrence_parent_id, recurrence_end_date,
  is_joined, created_by_admin, created_at,
  (absage_pin IS NOT NULL AND absage_pin != '') AS has_absage_pin
FROM public.bookings;
