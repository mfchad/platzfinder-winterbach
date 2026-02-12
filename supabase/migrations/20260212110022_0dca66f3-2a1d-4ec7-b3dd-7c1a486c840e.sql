
-- 1. Create a public view that excludes sensitive fields (email, IP)
CREATE OR REPLACE VIEW public.bookings_public AS
SELECT 
  id, court_number, date, start_hour, booking_type,
  booker_vorname, booker_nachname, booker_geburtsjahr,
  booker_comment, is_joined,
  partner_vorname, partner_nachname, partner_geburtsjahr, partner_comment,
  double_match_names, special_label,
  recurrence_type, recurrence_parent_id, recurrence_end_date,
  created_by_admin, created_at
FROM public.bookings;

-- Grant SELECT on view to anon and authenticated roles
GRANT SELECT ON public.bookings_public TO anon, authenticated;

-- 2. Remove the open SELECT policy (view bypasses RLS, so public reads go through view)
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.bookings;

-- Add admin-only SELECT on the actual table
CREATE POLICY "Admins can view all bookings"
ON public.bookings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Remove the open INSERT policy (edge function uses service_role, bypasses RLS)
DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;

-- Add admin-only INSERT on the actual table
CREATE POLICY "Admins can insert bookings"
ON public.bookings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
