import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.warn("TURNSTILE_SECRET_KEY not set, skipping verification");
    return true;
  }
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
    const body = await req.json();

    // Honeypot check — if the hidden "website" field has a value, it's a bot
    if (body.website && body.website.trim() !== "") {
      // Silently reject but return success to not tip off bots
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Turnstile verification
    if (body.turnstileToken) {
      const valid = await verifyTurnstile(body.turnstileToken);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Bot-Überprüfung fehlgeschlagen. Bitte versuchen Sie es erneut." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (Deno.env.get("TURNSTILE_SECRET_KEY")) {
      // If Turnstile is configured but no token provided, reject
      return new Response(
        JSON.stringify({ error: "Bot-Überprüfung erforderlich." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      court_number,
      date,
      start_hour,
      booking_type,
      booker_vorname,
      booker_nachname,
      booker_geburtsjahr,
      booker_comment,
      double_match_names,
    } = body;

    // Basic input validation
    if (
      typeof court_number !== "number" ||
      typeof start_hour !== "number" ||
      typeof booker_geburtsjahr !== "number" ||
      !date || !booker_vorname || !booker_nachname || !booking_type
    ) {
      return new Response(
        JSON.stringify({ error: "Ungültige Eingabedaten." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Rate limiting: max 3 bookings per 10 minutes from same IP
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("created_by_ip", clientIp)
      .gte("created_at", tenMinutesAgo);

    if (countError) {
      console.error("Rate limit check error:", countError);
    }

    if (count !== null && count >= 3) {
      return new Response(
        JSON.stringify({
          error: "Zu viele Anfragen. Bitte warten Sie kurz.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side member verification
    const { data: isMember, error: memberError } = await supabase.rpc('verify_member', {
      _vorname: booker_vorname.trim(),
      _nachname: booker_nachname.trim(),
      _geburtsjahr: booker_geburtsjahr,
    });

    if (memberError) {
      console.error("Member verification error:", memberError);
      return new Response(
        JSON.stringify({ error: "Mitgliederprüfung fehlgeschlagen." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isMember) {
      return new Response(
        JSON.stringify({ error: "Mitglied nicht gefunden. Bitte prüfen Sie Ihre Angaben." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert booking (the BEFORE INSERT trigger handles window validation)
    const { data, error } = await supabase.from("bookings").insert({
      court_number,
      date,
      start_hour,
      booking_type,
      booker_vorname: booker_vorname.trim(),
      booker_nachname: booker_nachname.trim(),
      booker_geburtsjahr,
      booker_comment: booking_type === "half" ? booker_comment : null,
      double_match_names: booking_type === "double" ? double_match_names : null,
      is_joined: false,
      created_by_admin: false,
      created_by_ip: clientIp,
    }).select("id").single();

    if (error) {
      console.error("Insert error:", error);
      const isDuplicate = error.code === "23505" || error.message?.includes("duplicate key") || error.message?.includes("uq_bookings_court_date_hour");
      const isRaisedException = error.code === "P0001";
      const userMessage = isDuplicate
        ? "Dieser Platz wurde gerade eben von jemand anderem gebucht."
        : isRaisedException
          ? error.message
          : "Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.";
      return new Response(
        JSON.stringify({ error: userMessage }),
        { status: isDuplicate ? 409 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "Ein unerwarteter Fehler ist aufgetreten." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
