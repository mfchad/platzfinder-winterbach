import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";
import type { Booking } from "@/lib/types";

interface TrainerCancelDialogProps {
  open: boolean;
  onClose: () => void;
  booking: Booking;
  onSuccess: () => void;
}

export default function TrainerCancelDialog({ open, onClose, booking, onSuccess }: TrainerCancelDialogProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!pin.trim()) {
      toast({ title: "Fehler", description: "Bitte PIN eingeben.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-trainer-booking', {
        body: { bookingId: booking.id, pin: pin.trim() },
      });
      if (error) {
        let errorMsg = "Absage fehlgeschlagen.";
        try { const body = await error.context?.json(); errorMsg = body?.error || errorMsg; } catch { errorMsg = data?.error || error.message || errorMsg; }
        throw new Error(errorMsg);
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: "Erfolg", description: "Termin wurde abgesagt." });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPin(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Termin absagen (Trainer)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Geben Sie den Absage-PIN ein, um diesen einzelnen Termin abzusagen. Die restliche Serie bleibt bestehen.
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {booking.special_label || 'Sonderbuchung'} — Platz {booking.court_number}, {String(booking.start_hour).padStart(2, '0')}:00
            </p>
          </div>
          <div>
            <Label>Absage-PIN</Label>
            <Input
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="PIN eingeben"
              maxLength={6}
              className="text-center text-lg tracking-widest font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setPin(""); onClose(); }} className="flex-1">
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={loading || !pin.trim()} className="flex-1">
              Absagen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
