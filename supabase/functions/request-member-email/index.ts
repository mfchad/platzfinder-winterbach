import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function genToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { vorname, nachname, email } = await req.json();

    if (!vorname || !nachname || !email || !isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Ungültige Eingabe." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Find member by name
    const { data: members, error: mErr } = await supabase
      .from("members")
      .select("id, email")
      .ilike("vorname", vorname.trim())
      .ilike("nachname", nachname.trim())
      .limit(2);

    if (mErr) throw mErr;
    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: "Mitglied nicht gefunden." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (members.length > 1) {
      return new Response(JSON.stringify({ error: "Mehrere Mitglieder gefunden — bitte Verwaltung kontaktieren." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const member = members[0];

    // 2. Check if email already taken by another member
    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("email", email.toLowerCase())
      .neq("id", member.id)
      .limit(1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Diese E-Mail-Adresse ist bereits einem anderen Mitglied zugeordnet." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Rate limit: max 3 requests per member per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("email_verification_requests")
      .select("*", { count: "exact", head: true })
      .eq("member_id", member.id)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte später erneut versuchen." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create verification token
    const token = genToken();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const { error: insErr } = await supabase
      .from("email_verification_requests")
      .insert({
        member_id: member.id,
        proposed_email: email.toLowerCase(),
        token,
        created_by_ip: ip,
      });
    if (insErr) throw insErr;

    // 5. Send verification email
    const origin = req.headers.get("origin") ?? "https://platzbuchung.tc-winterbach.de";
    const verifyUrl = `${origin}/verify-email?token=${token}`;

    const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "email-verification",
        recipientEmail: email.toLowerCase(),
        idempotencyKey: `email-verify-${token}`,
        templateData: {
          vorname: vorname.trim(),
          verifyUrl,
        },
      },
    });

    if (mailErr) {
      console.error("Email send failed:", mailErr);
      // Still return success — admin can re-trigger; user will see no email
      return new Response(JSON.stringify({
        ok: true,
        warning: "Bestätigungslink konnte momentan nicht versendet werden. Bitte später erneut versuchen.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), {
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
