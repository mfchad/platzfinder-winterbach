
-- Fix: recreate view with security_invoker to respect RLS of the querying user
DROP VIEW IF EXISTS public.bookings_public;

CREATE VIEW public.bookings_public
WITH (security_invoker=on) AS
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

-- Since security_invoker=on, the view respects RLS of the querying role.
-- Anon users need a SELECT policy to read through the view, but only safe columns are in the view.
-- We need to add back a permissive SELECT for anon that allows reading (the view filters columns).
-- Drop the admin-only policy we just created and replace with a broader one:
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;

-- Allow anyone to SELECT from the table (the view filters sensitive columns)
-- Admin dashboard queries the table directly (authenticated admin)
CREATE POLICY "Public can view bookings"
ON public.bookings FOR SELECT
USING (true);
