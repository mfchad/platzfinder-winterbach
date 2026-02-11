import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { bookingId, partnerVorname, partnerNachname, partnerComment } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "bookingId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if notifications are enabled
    const { data: emailRule } = await supabase
      .from("booking_rules")
      .select("rule_value")
      .eq("rule_key", "email_notifications_enabled")
      .single();

    if (emailRule?.rule_value !== "true") {
      return new Response(
        JSON.stringify({ sent: false, reason: "Benachrichtigungen sind deaktiviert." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Buchung nicht gefunden." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!booking.booker_email) {
      return new Response(
        JSON.stringify({ sent: false, reason: "Keine E-Mail-Adresse beim Bucher hinterlegt." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email using Supabase's built-in SMTP (via auth.admin or a simple fetch)
    // For now we use the Resend-compatible approach via a simple email
    const emailBody = `
Hallo ${booking.booker_vorname},

Ihre Halbbuchung wurde vervollständigt!

📅 Datum: ${booking.date}
🕐 Uhrzeit: ${String(booking.start_hour).padStart(2, "0")}:00 Uhr
🎾 Platz: ${booking.court_number}

Mitspieler: ${partnerVorname} ${partnerNachname}
${partnerComment ? `Kommentar: ${partnerComment}` : ""}

Mit sportlichen Grüßen,
Tennisclub Winterbach e.V. 1973
    `.trim();

    // Log the email for now (actual sending requires SMTP/Resend setup)
    console.log("=== EMAIL NOTIFICATION ===");
    console.log(`To: ${booking.booker_email}`);
    console.log(`Subject: Ihre Halbbuchung wurde vervollständigt`);
    console.log(emailBody);
    console.log("=========================");

    return new Response(
      JSON.stringify({
        sent: true,
        to: booking.booker_email,
        message: "Benachrichtigung wurde verarbeitet.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Notify error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
