import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error("Turnstile verification error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, vorname, nachname, geburtsjahr, comment, turnstileToken } = await req.json();

    // Turnstile verification
    if (turnstileToken) {
      const valid = await verifyTurnstile(turnstileToken);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Bot-Überprüfung fehlgeschlagen." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (Deno.env.get("TURNSTILE_SECRET_KEY")) {
      return new Response(
        JSON.stringify({ error: "Bot-Überprüfung erforderlich." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bookingId || !vorname?.trim() || !nachname?.trim() || !geburtsjahr) {
      return new Response(
        JSON.stringify({ error: "Alle Felder sind erforderlich." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify membership
    const { data: isMember, error: memberError } = await supabase.rpc("verify_member", {
      _vorname: vorname.trim(),
      _nachname: nachname.trim(),
      _geburtsjahr: parseInt(geburtsjahr, 10),
    });

    if (memberError || !isMember) {
      return new Response(
        JSON.stringify({ error: "Mitglied nicht gefunden." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch booking
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, booking_type, is_joined, booker_vorname, booker_nachname, booker_geburtsjahr")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return new Response(
        JSON.stringify({ error: "Buchung nicht gefunden." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Must be a half booking that isn't joined yet
    if (booking.booking_type !== "half" || booking.is_joined) {
      return new Response(
        JSON.stringify({ error: "Diese Buchung kann nicht beigetreten werden." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent booker from joining their own booking
    const gj = parseInt(geburtsjahr, 10);
    if (
      vorname.trim().toLowerCase() === booking.booker_vorname.toLowerCase() &&
      nachname.trim().toLowerCase() === booking.booker_nachname.toLowerCase() &&
      gj === booking.booker_geburtsjahr
    ) {
      return new Response(
        JSON.stringify({ error: "Sie können nicht Ihrer eigenen Buchung beitreten." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update booking
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        is_joined: true,
        partner_vorname: vorname.trim(),
        partner_nachname: nachname.trim(),
        partner_geburtsjahr: gj,
        partner_comment: comment || null,
        booking_type: "full",
      })
      .eq("id", bookingId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Join booking error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
