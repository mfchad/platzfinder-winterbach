

# Root Cause Analysis: Google Auth 404 on `/auth/v1/callback`

## The Core Finding

Your code in `AdminLogin.tsx` is correct -- it sets `redirectTo` to `window.location.origin + '/callback'`. However, **this is not what controls where the browser lands after Google login.**

## How Supabase OAuth Actually Works

Here is the critical flow that explains the disconnect:

1. Your code calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://platzfinder-winterbach.vercel.app/callback" } })`
2. The Supabase SDK redirects the browser to **Google's consent screen**
3. After the user approves, Google redirects to **Supabase's own callback endpoint**: `https://rvdlyufaeljvmnboucmr.supabase.co/auth/v1/callback`
4. Supabase processes the tokens, then redirects the user to **your `redirectTo` URL** -- but it appends the tokens as a hash fragment

The `redirectTo` parameter tells Supabase where to send the user **after Supabase finishes processing**. It does NOT change the intermediate callback URL that Google uses.

## Why You See `/auth/v1/callback` in Your Bundle

The string `auth/v1/callback` is **hardcoded inside the `@supabase/supabase-js` SDK itself**. It's the path Supabase uses on its own server (`rvdlyufaeljvmnboucmr.supabase.co/auth/v1/callback`) to receive the OAuth code from Google. This is expected and correct -- it is NOT a path on your Vercel domain.

## The Real Problem

If the browser is landing on `https://platzfinder-winterbach.vercel.app/auth/v1/callback`, it means **Supabase is redirecting to the wrong final URL**. This happens when:

- The **Site URL** in the Supabase/Lovable Cloud auth settings is set to `https://platzfinder-winterbach.vercel.app` AND
- The `redirectTo` parameter is either not reaching Supabase correctly, OR Supabase is falling back to appending `/auth/v1/callback` to the Site URL instead of using your `redirectTo`

This is a **backend configuration issue**, not a frontend code issue. Your code is already correct.

## The Fix (2 Steps)

### Step 1: Simplify the redirectTo (code change)

Change the `redirectTo` to just `window.location.origin` (no path). After Supabase processes the OAuth tokens, it will redirect the user to your app's root URL with the session tokens in the URL hash. The `onAuthStateChange` listener in `AdminLogin.tsx` will automatically detect the new session and navigate to `/admin/dashboard`.

In `src/pages/AdminLogin.tsx`, line 44:
```
// Change from:
redirectTo: window.location.origin + '/callback',
// Change to:
redirectTo: window.location.origin,
```

### Step 2: Verify backend auth settings

In the Lovable Cloud dashboard (Users > Auth Settings), confirm:
- **Site URL** is set to `https://platzfinder-winterbach.vercel.app`
- **Redirect URLs whitelist** includes `https://platzfinder-winterbach.vercel.app/**`

### Why This Works

- The user lands on `https://platzfinder-winterbach.vercel.app/#access_token=...` (your root URL)
- React Router matches the `/` route and renders the `Index` page
- The Supabase client automatically picks up the access token from the URL hash
- The `onAuthStateChange` listener in `AdminLogin` (or wherever the user navigates to `/admin`) detects the session and redirects to `/admin/dashboard`

### Optional Cleanup

The `/callback` route and `AuthCallback.tsx` component can be kept as a fallback, but they are no longer strictly needed with this approach.

## Summary

| Aspect | Current State | Root Cause |
|---|---|---|
| Code (`redirectTo`) | Points to `/callback` | Correct but unnecessary path |
| Route in App.tsx | `/callback` defined | Never reached because Supabase redirects to `/auth/v1/callback` instead |
| `/auth/v1/callback` string in bundle | From Supabase SDK internals | Expected, refers to Supabase server, not your domain |
| Actual browser redirect | Lands on `/auth/v1/callback` on your domain | Backend Site URL config causing Supabase to construct wrong redirect |

The fix is: set `redirectTo` to just `window.location.origin` and let the existing auth state listener handle navigation.

