import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Step = "identity" | "email" | "sent";

interface LookupResult {
  found: boolean;
  has_email?: boolean;
  verified?: boolean;
  masked_email?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function MemberEmailDialog({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("identity");
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const reset = () => {
    setStep("identity");
    setVorname(""); setNachname(""); setEmail("");
    setLookup(null); setLoading(false);
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const handleLookup = async () => {
    if (!vorname.trim() || !nachname.trim()) {
      toast({ title: "Fehler", description: "Bitte Vor- und Nachname eingeben.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("lookup_member_for_email", {
      _vorname: vorname.trim(),
      _nachname: nachname.trim(),
    });
    setLoading(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as unknown as LookupResult;
    setLookup(result);
    if (!result.found) {
      toast({
        title: "Nicht gefunden",
        description: "Wir konnten dich nicht in der Mitgliederliste finden. Bitte wende dich an die Verwaltung.",
        variant: "destructive",
      });
      return;
    }
    setStep("email");
  };

  const handleSubmitEmail = async () => {
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Fehler", description: "Bitte eine gültige E-Mail-Adresse eingeben.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("request-member-email", {
      body: {
        vorname: vorname.trim(),
        nachname: nachname.trim(),
        email: email.trim().toLowerCase(),
      },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Fehler",
        description: (data as any)?.error || error?.message || "Etwas ist schief gelaufen.",
        variant: "destructive",
      });
      return;
    }
    setStep("sent");
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" style={{ color: "hsl(var(--club-navy))" }} />
            E-Mail-Adresse hinterlegen
          </DialogTitle>
          <DialogDescription>
            Damit wir dich z.B. bei Buchungs-Updates erreichen können.
          </DialogDescription>
        </DialogHeader>

        {step === "identity" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="vn">Vorname</Label>
              <Input id="vn" value={vorname} onChange={(e) => setVorname(e.target.value)} autoFocus />
            </div>
            <div>
              <Label htmlFor="nn">Nachname</Label>
              <Input id="nn" value={nachname} onChange={(e) => setNachname(e.target.value)} />
            </div>
            <Button onClick={handleLookup} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Weiter"}
            </Button>
          </div>
        )}

        {step === "email" && lookup && (
          <div className="space-y-3">
            {lookup.has_email && lookup.verified && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
                  <div>
                    <p>Deine hinterlegte E-Mail ist:</p>
                    <p className="font-mono font-semibold mt-1">{lookup.masked_email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Möchtest du sie aktualisieren? Gib unten eine neue ein.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {lookup.has_email && !lookup.verified && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p>Deine bisherige E-Mail ({lookup.masked_email}) ist noch <strong>nicht bestätigt</strong>. Bitte gib sie erneut ein, um sie zu aktivieren.</p>
                  </div>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="em">E-Mail-Adresse</Label>
              <Input
                id="em"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vorname@beispiel.de"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Wir senden dir einen Bestätigungslink. Erst nach dem Klick wird deine Adresse aktiviert.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("identity")} className="flex-1">
                Zurück
              </Button>
              <Button onClick={handleSubmitEmail} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bestätigungs-Link senden"}
              </Button>
            </div>
          </div>
        )}

        {step === "sent" && (
          <div className="space-y-3 text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <p className="font-medium">Wir haben dir einen Bestätigungslink gesendet.</p>
            <p className="text-sm text-muted-foreground">
              Bitte prüfe dein Postfach (auch den Spam-Ordner) und klicke auf den Link, um deine
              E-Mail-Adresse zu aktivieren.
            </p>
            <Button onClick={handleClose} className="w-full">Schließen</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
