

# Restrict Admin Login to Authorized Users Only

## What Changes

Right now, anyone with a Google account can log in and see the admin dashboard (even though they can't access data due to database security). We'll fix this so that unauthorized users are immediately signed out with a clear error message.

## How It Works

1. **Automatic role assignment**: When one of the authorized emails logs in for the first time, the system automatically grants them admin access via a database trigger.

2. **Post-login check**: After Google login, the app checks whether the user has admin privileges. If not, they are immediately signed out and shown an error message ("Kein Zugriff -- Ihr Konto ist nicht als Administrator registriert.").

3. **Authorized emails**: tinaschwan86@gmail.com, dieterschwan111@gmail.com, weltera.wnd@gmail.com, and the existing mfchad@gmail.com.

## Technical Details

### 1. Database: Auto-assign admin role trigger (migration)

Create a trigger function on `auth.users` that fires after a new user is created. If the email matches the whitelist, it inserts a row into `user_roles` with role `admin`.

```sql
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
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_admin_role();
```

### 2. `src/pages/AdminLogin.tsx` -- add post-login role check

After `onAuthStateChange` detects a `SIGNED_IN` event:
- Query `user_roles` to check if user has admin role
- If not admin, call `supabase.auth.signOut()` and show a toast error
- If admin, navigate to `/admin/dashboard`

### 3. `src/pages/AdminDashboard.tsx` -- add role guard

On mount, after confirming session exists:
- Query `user_roles` for the current user
- If no admin role found, sign out and redirect to `/admin` with an error

### 4. `src/App.tsx` -- update `AuthRedirectHandler`

Update the redirect handler to also verify admin role before redirecting to `/admin/dashboard`, preventing a flash of the dashboard for unauthorized users.

## What the User Sees

- **Authorized user**: Logs in with Google, lands on the admin dashboard as before.
- **Unauthorized user**: Logs in with Google, sees a brief loading state, then gets signed out with a German-language error message: "Kein Zugriff -- Ihr Konto ist nicht als Administrator registriert."

