import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { verifyMember, isWithinBookingWindow, isHalfBookingAllowed, isCoreTime, checkCoreTimeLimits } from "@/lib/booking-validation";
import { useToast } from "@/hooks/use-toast";

interface NewBookingDialogProps {
  open: boolean;
  onClose: () => void;
  court: number;
  hour: number;
  date: string;
  rules: Record<string, string>;
  onSuccess: () => void;
}

export default function NewBookingDialog({ open, onClose, court, hour, date, rules, onSuccess }: NewBookingDialogProps) {
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [geburtsjahr, setGeburtsjahr] = useState("");
  const [bookingType, setBookingType] = useState<"full" | "half" | "double">("full");
  const [comment, setComment] = useState("");
  const [doubleNames, setDoubleNames] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const halfAllowed = isHalfBookingAllowed(date, hour, rules);
  const withinWindow = isWithinBookingWindow(date, hour, rules);
  const coreTime = isCoreTime(date, hour, rules);

  // Determine if the slot is bookable based on the selected type:
  // Half-bookings bypass the global booking window and use their own time window.
  const isSlotBookable = bookingType === 'half' ? halfAllowed : withinWindow;

  const handleSubmit = async () => {
    if (!vorname.trim() || !nachname.trim() || !geburtsjahr.trim()) {
      toast({ title: "Fehler", description: "Bitte alle Felder ausfüllen.", variant: "destructive" });
      return;
    }
    const gj = parseInt(geburtsjahr, 10);
    if (isNaN(gj) || gj < 1920 || gj > 2020) {
      toast({ title: "Fehler", description: "Bitte ein gültiges Geburtsjahr eingeben.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Verify member
      const isMember = await verifyMember(vorname, nachname, gj);
      if (!isMember) {
        toast({ title: "Fehler", description: "Mitglied nicht gefunden. Bitte prüfen Sie Ihre Angaben.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // For half-bookings, only check half_booking time window (bypass global booking_window_hours).
      // For other types, check the global booking window.
      if (bookingType === 'half') {
        if (!halfAllowed) {
          toast({ title: "Fehler", description: "Halbbuchungen sind nur im definierten Zeitfenster möglich.", variant: "destructive" });
          setLoading(false);
          return;
        }
      } else {
        if (!withinWindow) {
          toast({ title: "Fehler", description: "Buchungen sind nur innerhalb des Buchungsvorlaufs möglich.", variant: "destructive" });
          setLoading(false);
          return;
        }
      }

      // Check core time limits
      if (coreTime) {
        const limitError = await checkCoreTimeLimits(vorname, nachname, gj, date, bookingType, rules);
        if (limitError) {
          toast({ title: "Kernzeit-Limit", description: limitError, variant: "destructive" });
          setLoading(false);
          return;
        }
      }

      // Check for existing booking
      const { data: existing } = await supabase
        .from('bookings_public' as any)
        .select('id')
        .eq('court_number', court)
        .eq('date', date)
        .eq('start_hour', hour);
      if (existing && existing.length > 0) {
        toast({ title: "Fehler", description: "Dieser Platz ist bereits belegt.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-booking', {
        body: {
          court_number: court,
          date,
          start_hour: hour,
          booking_type: bookingType,
          booker_vorname: vorname.trim(),
          booker_nachname: nachname.trim(),
          booker_geburtsjahr: gj,
          booker_comment: bookingType === 'half' ? comment : undefined,
          double_match_names: bookingType === 'double' ? doubleNames : undefined,
          website: honeypot,
        },
      });

      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      toast({ title: "Erfolg", description: "Buchung wurde erstellt!" });
      onSuccess();
      onClose();
      resetForm();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message || "Buchung fehlgeschlagen.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setVorname(""); setNachname(""); setGeburtsjahr("");
    setBookingType("full"); setComment(""); setDoubleNames(""); setHoneypot("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Platz {court} buchen — {String(hour).padStart(2, '0')}:00
          </DialogTitle>
        </DialogHeader>

        {!isSlotBookable && (
          <p className="text-sm text-destructive">
            {bookingType === 'half'
              ? "Halbbuchungen sind in diesem Zeitfenster nicht möglich."
              : "Buchungen sind nur innerhalb des Buchungsvorlaufs möglich."}
          </p>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vorname</Label>
              <Input value={vorname} onChange={e => setVorname(e.target.value)} placeholder="Max" />
            </div>
            <div>
              <Label>Nachname</Label>
              <Input value={nachname} onChange={e => setNachname(e.target.value)} placeholder="Mustermann" />
            </div>
          </div>
          <div>
            <Label>Geburtsjahr</Label>
            <Input value={geburtsjahr} onChange={e => setGeburtsjahr(e.target.value)} placeholder="1984" type="number" />
          </div>

          <div>
            <Label className="mb-2 block">Buchungsart</Label>
            <RadioGroup value={bookingType} onValueChange={(v) => setBookingType(v as any)} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full">Einzelmatch (2 Spieler)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="half" id="half" disabled={!halfAllowed} />
                <Label htmlFor="half" className={!halfAllowed ? "text-muted-foreground" : ""}>
                  Halbbuchung (Partner gesucht)
                </Label>
                {!halfAllowed && <span className="text-xs text-muted-foreground">(nicht verfügbar)</span>}
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="double" id="double" />
                <Label htmlFor="double">Doppelmatch (4 Spieler) {coreTime && "— erlaubt zusätzliche Kernzeit-Stunde"}</Label>
              </div>
            </RadioGroup>
          </div>

          {bookingType === 'half' && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Kommentar</Label>
                <Popover>
                  <PopoverTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent className="text-xs max-w-xs">
                    Dieser Kommentar ist öffentlich sichtbar. Wenn Sie möchten, können Sie Ihre Kontaktdaten hinterlassen, damit potenzielle Mitspieler Sie erreichen können.
                  </PopoverContent>
                </Popover>
              </div>
              <Textarea 
                value={comment} 
                onChange={e => setComment(e.target.value)} 
                placeholder="z.B. Suche Partner für lockeres Spiel. Kontakt: max@email.de"
                rows={2}
              />
            </div>
          )}

          {bookingType === 'double' && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Mitspieler-Namen</Label>
                <Popover>
                  <PopoverTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent className="text-xs max-w-xs">
                    Die Mitspieler-Namen sind nur für den Administrator sichtbar. Gastmitspieler sind erlaubt.
                  </PopoverContent>
                </Popover>
              </div>
              <Textarea 
                value={doubleNames} 
                onChange={e => setDoubleNames(e.target.value)} 
                placeholder="Namen der anderen 3 Spieler"
                rows={2}
              />
            </div>
          )}

          {/* Honeypot field - invisible to humans, catches bots */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={e => setHoneypot(e.target.value)}
            />
          </div>

          <Button onClick={handleSubmit} disabled={loading || !isSlotBookable} className="w-full">
            {loading ? "Wird gebucht..." : "Buchen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
