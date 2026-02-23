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

    // --- Server-side core time limit enforcement ---
    // Fetch all rules
    const { data: rulesData } = await supabase.from("booking_rules").select("rule_key, rule_value");
    const rules: Record<string, string> = {};
    (rulesData || []).forEach((r: any) => { rules[r.rule_key] = r.rule_value; });

    const getRuleNum = (key: string, fallback: number) => {
      const v = rules[key];
      return v ? parseInt(v, 10) : fallback;
    };

    // Check if slot is core time
    const coreStart = getRuleNum("core_time_start", 17);
    const coreEnd = getRuleNum("core_time_end", 20);
    const coreDaysStr = rules["core_time_days"] || "1,2,3,4,5";
    const coreDays = coreDaysStr.split(",").map((d: string) => parseInt(d.trim(), 10));
    const slotDate = new Date(date);
    const jsDay = slotDate.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    const isCoreTime = coreDays.includes(isoDay) && start_hour >= coreStart && start_hour < coreEnd;

    if (isCoreTime) {
      // Get week bounds (Mon-Sun)
      const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
      const monday = new Date(slotDate);
      monday.setDate(slotDate.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const mondayStr = monday.toISOString().split("T")[0];
      const sundayStr = sunday.toISOString().split("T")[0];

      // Query existing bookings for this member in this week
      const { data: weekBookings } = await supabase
        .from("bookings")
        .select("date, start_hour, booking_type")
        .ilike("booker_vorname", booker_vorname.trim())
        .ilike("booker_nachname", booker_nachname.trim())
        .eq("booker_geburtsjahr", booker_geburtsjahr)
        .gte("date", mondayStr)
        .lte("date", sundayStr)
        .neq("booking_type", "special");

      const allBookings = weekBookings || [];

      // Filter to core-time bookings only
      const coreBookings = allBookings.filter((b: any) => {
        const bd = new Date(b.date);
        const bJsDay = bd.getDay();
        const bIsoDay = bJsDay === 0 ? 7 : bJsDay;
        return coreDays.includes(bIsoDay) && b.start_hour >= coreStart && b.start_hour < coreEnd;
      });

      const todayCoreBookings = coreBookings.filter((b: any) => b.date === date);
      const isDouble = booking_type === "double";

      if (isDouble) {
        const maxDayDouble = getRuleNum("double_max_per_day", 2);
        const maxWeekDouble = getRuleNum("double_max_per_week", 6);
        const todayDoubles = todayCoreBookings.filter((b: any) => b.booking_type === "double").length;
        const weekDoubles = coreBookings.filter((b: any) => b.booking_type === "double").length;

        if (todayDoubles >= maxDayDouble) {
          return new Response(
            JSON.stringify({ error: `Kernzeit-Limit erreicht: max. ${maxDayDouble} Doppel-Buchung(en) pro Tag erlaubt.` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (weekDoubles >= maxWeekDouble) {
          return new Response(
            JSON.stringify({ error: `Kernzeit-Limit erreicht: max. ${maxWeekDouble} Doppel-Buchung(en) pro Woche erlaubt.` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        const maxDaySingle = getRuleNum("single_max_per_day", 1);
        const maxWeekSingle = getRuleNum("single_max_per_week", 3);
        const todaySingles = todayCoreBookings.filter((b: any) => b.booking_type !== "double").length;
        const weekSingles = coreBookings.filter((b: any) => b.booking_type !== "double").length;

        if (todaySingles >= maxDaySingle) {
          return new Response(
            JSON.stringify({ error: `Kernzeit-Limit erreicht: max. ${maxDaySingle} Einzel-Buchung(en) pro Tag erlaubt.` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (weekSingles >= maxWeekSingle) {
          return new Response(
            JSON.stringify({ error: `Kernzeit-Limit erreicht: max. ${maxWeekSingle} Einzel-Buchung(en) pro Woche erlaubt.` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
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
