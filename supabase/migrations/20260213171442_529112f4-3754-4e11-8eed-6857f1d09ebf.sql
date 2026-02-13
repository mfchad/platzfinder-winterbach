-- Remove the permissive public SELECT policy that exposes sensitive fields
DROP POLICY IF EXISTS "Anyone can read bookings" ON public.bookings;
