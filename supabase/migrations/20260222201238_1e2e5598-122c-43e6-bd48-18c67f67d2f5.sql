
-- Auto-assign admin role to whitelisted emails on user creation
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IN (
    'mfchad@gmail.com',
    'tinaschwan86@gmail.com',
    'dieterschwan111@gmail.com',
    'welter.wnd@gmail.com'
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_admin_role();

-- Also insert admin roles for any existing users with these emails
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email IN (
  'mfchad@gmail.com',
  'tinaschwan86@gmail.com',
  'dieterschwan111@gmail.com',
  'welter.wnd@gmail.com'
)
ON CONFLICT DO NOTHING;
