import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import clubBadge from "@/assets/Wappen_TCW.png";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Kein Token in der URL gefunden.");
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke("verify-member-email", {
        body: { token },
      });
      if (error || (data as any)?.error) {
        setStatus("error");
        setMessage((data as any)?.error || error?.message || "Verifizierung fehlgeschlagen.");
      } else {
        setStatus("ok");
        setMessage((data as any)?.message || "Deine E-Mail-Adresse wurde erfolgreich bestätigt!");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <img src={clubBadge} alt="TC Winterbach" className="w-16 h-16 mx-auto" />
          <h1 className="font-display text-xl font-bold" style={{ color: "hsl(var(--club-navy))" }}>
            E-Mail-Bestätigung
          </h1>
          {status === "loading" && (
            <div className="space-y-2">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Wird geprüft...</p>
            </div>
          )}
          {status === "ok" && (
            <div className="space-y-2">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <p>{message}</p>
            </div>
          )}
          {status === "error" && (
            <div className="space-y-2">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-destructive">{message}</p>
              <p className="text-xs text-muted-foreground">
                Der Link ist möglicherweise abgelaufen oder wurde bereits verwendet.
              </p>
            </div>
          )}
          <Button asChild className="w-full">
            <Link to="/">Zur Platzbuchung</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
