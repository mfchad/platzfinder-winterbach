import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token fehlt." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: req_row, error } = await supabase
      .from("email_verification_requests")
      .select("id, member_id, proposed_email, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (error) throw error;
    if (!req_row) {
      return new Response(JSON.stringify({ error: "Ungültiger Bestätigungslink." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (req_row.used_at) {
      return new Response(JSON.stringify({ error: "Dieser Link wurde bereits verwendet." }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(req_row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Der Link ist abgelaufen. Bitte fordere einen neuen an." }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check email not taken by other member
    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("email", req_row.proposed_email)
      .neq("id", req_row.member_id)
      .limit(1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Diese E-Mail wird bereits von einem anderen Mitglied verwendet." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update member email + verified timestamp
    const { error: upErr } = await supabase
      .from("members")
      .update({
        email: req_row.proposed_email,
        email_verified_at: new Date().toISOString(),
      })
      .eq("id", req_row.member_id);
    if (upErr) throw upErr;

    // Mark token used
    await supabase
      .from("email_verification_requests")
      .update({ used_at: new Date().toISOString() })
      .eq("id", req_row.id);

    return new Response(JSON.stringify({
      ok: true,
      message: "Deine E-Mail-Adresse wurde erfolgreich bestätigt!",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
