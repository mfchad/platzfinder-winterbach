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
    const { bookingId, pin } = await req.json();

    if (!bookingId || !pin?.trim()) {
      return new Response(
        JSON.stringify({ error: "Buchungs-ID und PIN sind erforderlich." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the booking
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, booking_type, recurrence_parent_id, absage_pin")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return new Response(
        JSON.stringify({ error: "Buchung nicht gefunden." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (booking.booking_type !== "special") {
      return new Response(
        JSON.stringify({ error: "Nur Sonderbuchungen können mit PIN abgesagt werden." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check PIN: booking itself may not have PIN, check via the series parent
    let correctPin = booking.absage_pin;
    if (!correctPin && booking.recurrence_parent_id) {
      // Get PIN from any sibling in the series (they all share the same parent)
      const { data: sibling } = await supabase
        .from("bookings")
        .select("absage_pin")
        .eq("recurrence_parent_id", booking.recurrence_parent_id)
        .not("absage_pin", "is", null)
        .limit(1)
        .single();
      correctPin = sibling?.absage_pin;
    }

    if (!correctPin) {
      return new Response(
        JSON.stringify({ error: "Für diese Buchung ist kein Absage-PIN hinterlegt." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pin.trim() !== correctPin) {
      return new Response(
        JSON.stringify({ error: "Falscher PIN." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete only this single occurrence
    const { error: deleteError } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Cancel trainer booking error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
