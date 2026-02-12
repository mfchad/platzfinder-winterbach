

# Fix Join and Edit Operations for Public Users

## Problem

The same silent RLS failure that affected cancellation also affects two other operations on half-bookings:

1. **Join** (`handleJoin`): Calls `supabase.from('bookings').update(...)` to mark a half-booking as joined with partner details
2. **Edit** (`handleSaveEdit`): Calls `supabase.from('bookings').update(...)` to update the booker's comment

Both silently fail for unauthenticated users because the `bookings` table only allows admin updates via RLS.

## Solution

Create two new edge functions that use the `service_role` key to bypass RLS, with server-side identity verification.

### 1. New Edge Function: `join-booking`

**File:** `supabase/functions/join-booking/index.ts`

- Accepts: `bookingId`, `vorname`, `nachname`, `geburtsjahr`, `comment` (optional)
- Verifies the joiner is a valid member (via `verify_member` RPC)
- Verifies the booking exists, is a half-booking, and is not already joined
- Prevents the booker from joining their own booking
- Updates the booking with partner details and sets `is_joined = true`, `booking_type = 'full'`

### 2. New Edge Function: `update-booking`

**File:** `supabase/functions/update-booking/index.ts`

- Accepts: `bookingId`, `vorname`, `nachname`, `geburtsjahr`, `bookerComment`
- Verifies the caller's identity matches the booker
- Updates only the `booker_comment` field

### 3. Frontend Changes: `src/components/ExistingBookingDialog.tsx`

- **`handleJoin`**: Replace the direct `supabase.from('bookings').update(...)` with `supabase.functions.invoke('join-booking', { body: { ... } })`. Remove the client-side `verifyMember` call since the edge function handles it server-side.
- **`handleSaveEdit`**: Replace the direct `supabase.from('bookings').update(...)` with `supabase.functions.invoke('update-booking', { body: { ... } })`.

### 4. Config: `supabase/config.toml`

Add entries for both new functions with `verify_jwt = false`.

## Technical Details

- Both edge functions follow the same pattern as the existing `cancel-booking` function: CORS headers, input validation, identity verification, and `service_role` client
- The `join-booking` function calls the existing `verify_member` RPC to validate membership server-side, which is more secure than the current client-side check
- The existing `notify-join` call in the frontend stays as-is (it's already an edge function call and works fine)

