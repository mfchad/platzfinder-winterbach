
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS absage_pin text;

DROP VIEW IF EXISTS public.bookings_public;

CREATE VIEW public.bookings_public AS
SELECT
  id,
  court_number,
  date,
  start_hour,
  booking_type,
  booker_vorname,
  booker_nachname,
  booker_geburtsjahr,
  booker_comment,
  partner_vorname,
  partner_nachname,
  partner_geburtsjahr,
  partner_comment,
  double_match_names,
  special_label,
  recurrence_type,
  recurrence_parent_id,
  recurrence_end_date,
  is_joined,
  created_by_admin,
  created_at,
  (absage_pin IS NOT NULL AND absage_pin <> '') AS has_absage_pin
FROM public.bookings;

GRANT SELECT ON public.bookings_public TO anon, authenticated;
