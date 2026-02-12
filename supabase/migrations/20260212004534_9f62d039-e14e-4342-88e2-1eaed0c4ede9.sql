
-- Drop the existing restrictive policies
DROP POLICY "Admins can select members" ON public.members;
DROP POLICY "Admins can insert members" ON public.members;
DROP POLICY "Admins can update members" ON public.members;
DROP POLICY "Admins can delete members" ON public.members;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Admins can select members"
ON public.members FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert members"
ON public.members FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update members"
ON public.members FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete members"
ON public.members FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
