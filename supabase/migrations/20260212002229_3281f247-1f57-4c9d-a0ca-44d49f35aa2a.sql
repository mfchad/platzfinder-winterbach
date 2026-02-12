
-- 1. Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can manage roles; authenticated users can read their own
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. Create has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. Create verify_member security definer function (public can call, but cannot browse members)
CREATE OR REPLACE FUNCTION public.verify_member(_vorname text, _nachname text, _geburtsjahr integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE lower(vorname) = lower(trim(_vorname))
      AND lower(nachname) = lower(trim(_nachname))
      AND geburtsjahr = _geburtsjahr
  )
$$;

-- 4. Drop all existing policies on members
DROP POLICY IF EXISTS "Admin can delete members" ON public.members;
DROP POLICY IF EXISTS "Admin can insert members" ON public.members;
DROP POLICY IF EXISTS "Admin can update members" ON public.members;
DROP POLICY IF EXISTS "Anyone can read members for verification" ON public.members;

-- New members policies: admin-only
CREATE POLICY "Admins can select members"
  ON public.members FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert members"
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update members"
  ON public.members FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete members"
  ON public.members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Drop all existing policies on bookings
DROP POLICY IF EXISTS "Anyone can delete bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can update bookings" ON public.bookings;

-- New bookings policies
CREATE POLICY "Anyone can view bookings"
  ON public.bookings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update bookings"
  ON public.bookings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bookings"
  ON public.bookings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Drop all existing policies on booking_rules
DROP POLICY IF EXISTS "Admin can manage rules" ON public.booking_rules;
DROP POLICY IF EXISTS "Anyone can read rules" ON public.booking_rules;

-- New booking_rules policies
CREATE POLICY "Anyone can read rules"
  ON public.booking_rules FOR SELECT
  USING (true);

CREATE POLICY "Admins can update rules"
  ON public.booking_rules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert rules"
  ON public.booking_rules FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete rules"
  ON public.booking_rules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
