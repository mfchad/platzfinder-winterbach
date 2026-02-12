import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
