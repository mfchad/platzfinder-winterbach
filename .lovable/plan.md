

# Redirect Authenticated Users to Admin Dashboard After Google Login

## Problem

After the OAuth redirect change, users land on `/` (the root/Index page) after Google login. The `onAuthStateChange` listener that navigates to `/admin/dashboard` only exists in `AdminLogin.tsx`, which is mounted at `/admin`. Since the user is no longer on that page, the redirect never fires.

## Solution

Add an auth session check in `App.tsx` at the router level. When the app detects a session from an OAuth callback (indicated by an access token in the URL hash), it redirects to `/admin/dashboard`.

## Changes

### 1. `src/App.tsx` -- Add a root-level auth redirect component

Create a small wrapper component inside `App.tsx` (or a separate file) that:
- Listens for `onAuthStateChange` events
- On `SIGNED_IN` event, checks if the current URL contains an access token hash fragment (indicating an OAuth callback)
- If so, navigates to `/admin/dashboard`

```typescript
function AuthRedirectHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && window.location.hash.includes('access_token')) {
        navigate('/admin/dashboard', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
}
```

Place `<AuthRedirectHandler />` inside the `<BrowserRouter>` in `App.tsx` so it has access to the router context and runs on every page.

### 2. No other files need changes

The existing listener in `AdminLogin.tsx` can stay as-is -- it serves as a secondary check if someone navigates directly to `/admin` while already logged in.

## Technical Details

- The `event === 'SIGNED_IN'` check ensures we only redirect on fresh logins, not on page refreshes with an existing session.
- The `window.location.hash.includes('access_token')` check ensures we only redirect when coming from an OAuth callback, not on normal session restoration.
- `{ replace: true }` prevents the OAuth callback URL from staying in browser history.

