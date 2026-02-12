
-- Recreate as security definer view (default) - intentionally bypasses RLS to filter columns
DROP VIEW IF EXISTS public.bookings_public;

CREATE VIEW public.bookings_public AS
SELECT 
  id, court_number, date, start_hour, booking_type,
  booker_vorname, booker_nachname, booker_geburtsjahr,
  booker_comment, is_joined,
  partner_vorname, partner_nachname, partner_geburtsjahr, partner_comment,
  double_match_names, special_label,
  recurrence_type, recurrence_parent_id, recurrence_end_date,
  created_by_admin, created_at
FROM public.bookings;

GRANT SELECT ON public.bookings_public TO anon, authenticated;

-- Remove the public SELECT on the base table - only admins can query it directly
DROP POLICY IF EXISTS "Public can view bookings" ON public.bookings;

CREATE POLICY "Admins can view all bookings"
ON public.bookings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
