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

    // Get the expiry hours from booking_rules (default 12)
    const { data: ruleData } = await supabase
      .from("booking_rules")
      .select("rule_value")
      .eq("rule_key", "half_booking_expiry_hours")
      .single();

    const expiryHours = ruleData ? parseInt(ruleData.rule_value, 10) : 12;

    // Check if email notifications are enabled
    const { data: emailRule } = await supabase
      .from("booking_rules")
      .select("rule_value")
      .eq("rule_key", "email_notifications_enabled")
      .single();

    const emailEnabled = emailRule?.rule_value === "true";

    // Get current time in Europe/Berlin
    const nowUtc = Date.now();

    // Helper: get the UTC offset in ms for Europe/Berlin at a given UTC timestamp
    function getBerlinOffsetMs(utcMs: number): number {
      // Format a date in Europe/Berlin to extract the offset
      const dt = new Date(utcMs);
      const berlinStr = dt.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
      const berlinDate = new Date(berlinStr);
      return berlinDate.getTime() - dt.getTime();
    }

    // Find all unjoined half-bookings
    const { data: halfBookings, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_type", "half")
      .eq("is_joined", false);

    if (fetchError) throw fetchError;

    const toDelete: string[] = [];
    const toNotify: Array<{ email: string; vorname: string; date: string; hour: number }> = [];

    for (const booking of halfBookings || []) {
      // Interpret booking.date + booking.start_hour as Europe/Berlin local time
      // Create a UTC timestamp that represents that Berlin local time
      const localIso = `${booking.date}T${String(booking.start_hour).padStart(2, "0")}:00:00`;
      // Parse as UTC first, then subtract the Berlin offset to get the true UTC moment
      const naiveUtcMs = new Date(localIso + "Z").getTime();
      const berlinOffset = getBerlinOffsetMs(naiveUtcMs);
      const bookingStartUtcMs = naiveUtcMs - berlinOffset;
      const hoursUntilStart = (bookingStartUtcMs - nowUtc) / (1000 * 60 * 60);

      if (hoursUntilStart < expiryHours) {
        toDelete.push(booking.id);

        // Collect for email notification if enabled and email exists
        if (emailEnabled && booking.booker_email) {
          toNotify.push({
            email: booking.booker_email,
            vorname: booking.booker_vorname,
            date: booking.date,
            hour: booking.start_hour,
          });
        }
      }
    }

    // Delete expired half-bookings
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("bookings")
        .delete()
        .in("id", toDelete);

      if (deleteError) throw deleteError;
    }

    // TODO: Send email notifications when email service is configured
    // For now, we log the notifications that would be sent
    if (toNotify.length > 0) {
      console.log("Would notify:", JSON.stringify(toNotify));
    }

    return new Response(
      JSON.stringify({
        deleted: toDelete.length,
        notifications: toNotify.length,
        message: `Deleted ${toDelete.length} expired half-booking(s).`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Cleanup error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
