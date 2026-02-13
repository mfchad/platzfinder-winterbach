

# Fix Google Login for Lovable Preview

## Problem
Google OAuth returns a 403 because the Lovable preview domain is not registered as an authorized redirect URI. The current code calls `supabase.auth.signInWithOAuth()` directly, which only works for domains you've manually whitelisted (like your Vercel domain).

## Solution
Switch to Lovable Cloud's managed OAuth (`lovable.auth.signInWithOAuth`), which automatically handles redirect URIs for all Lovable preview domains.

## Changes

### File: `src/pages/AdminLogin.tsx`

1. Add import for the Lovable auth module
2. Replace the `handleGoogleLogin` function body:
   - **Before:** `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })`
   - **After:** `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`

That is the only change needed. The rest of the login page (email/password login, UI) stays the same.

## Why This Works
The `lovable.auth.signInWithOAuth` function uses Lovable Cloud's managed Google OAuth credentials, which already have the Lovable preview domains whitelisted. After Google authenticates the user, the managed flow automatically sets the Supabase session, so the existing `onAuthStateChange` listener will still detect the login and redirect to `/admin/dashboard`.

## Impact on Vercel Deployment
The managed OAuth also works for your Vercel domain -- Lovable Cloud handles both environments. No changes needed in your Vercel or Google Cloud configuration.

