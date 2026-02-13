

# Fix Google Login for Both Environments

## Problem
Lovable Cloud's managed OAuth (`lovable.auth.signInWithOAuth`) uses a `/~oauth` callback path that only works on Lovable's preview infrastructure. On Vercel, this path has no handler, causing a 404.

## Solution
Detect the runtime environment and use the correct OAuth method:
- **Lovable preview** (`*.lovable.app`): Use `lovable.auth.signInWithOAuth` (managed OAuth)
- **Vercel / other domains**: Use `supabase.auth.signInWithOAuth` (direct OAuth, which was working before)

## Changes

### File: `src/pages/AdminLogin.tsx`

Update `handleGoogleLogin` to branch based on hostname:

```typescript
const handleGoogleLogin = async () => {
  setGoogleLoading(true);
  try {
    const isLovablePreview = window.location.hostname.endsWith('.lovable.app');
    
    if (isLovablePreview) {
      // Managed OAuth for Lovable preview
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } else {
      // Direct Supabase OAuth for Vercel/production
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    }
  } catch (e: any) {
    toast({ title: "Anmeldefehler", description: e.message || "Google-Anmeldung fehlgeschlagen.", variant: "destructive" });
  } finally { setGoogleLoading(false); }
};
```

No other files need changes. Both `supabase` and `lovable` imports are already present in the file.

## Why This Works
- On Lovable preview: the managed flow handles `/~oauth` correctly
- On Vercel: the direct Supabase OAuth redirects back to the origin with tokens in the URL hash, which your existing `AuthRedirectHandler` in `App.tsx` already handles

