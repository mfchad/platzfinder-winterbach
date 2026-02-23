import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Booking } from "@/lib/types";
import TurnstileWidget from "@/components/TurnstileWidget";

interface ExistingBookingDialogProps {
  open: boolean;
  onClose: () => void;
  booking: Booking;
  onSuccess: () => void;
}

type Action = null | 'cancel' | 'edit' | 'join' | 'info';

export default function ExistingBookingDialog({ open, onClose, booking, onSuccess }: ExistingBookingDialogProps) {
  const [action, setAction] = useState<Action>(null);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [geburtsjahr, setGeburtsjahr] = useState("");
  const [comment, setComment] = useState("");
  const [editComment, setEditComment] = useState(booking.booker_comment || "");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [verified, setVerified] = useState(false);
  const [infoData, setInfoData] = useState<{ names: string[]; comments: string[] } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const { toast } = useToast();

  const handleTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(null), []);

  const isHalf = booking.booking_type === 'half' && !booking.is_joined;
  const isFull = (booking.booking_type === 'full' || booking.booking_type === 'double') || booking.is_joined;

  const resetAction = () => {
    setAction(null);
    setVorname(""); setNachname(""); setGeburtsjahr("");
    setComment(""); setShowConfirm(false); setInfoData(null);
    setVerified(false); setTurnstileToken(null);
  };

  const handleClose = () => {
    resetAction();
    onClose();
  };

  const verifyBooker = async (): Promise<boolean> => {
    const gj = parseInt(geburtsjahr, 10);
    if (!vorname.trim() || !nachname.trim() || isNaN(gj)) {
      toast({ title: "Fehler", description: "Bitte alle Felder ausfüllen.", variant: "destructive" });
      return false;
    }
    if (
      vorname.trim().toLowerCase() !== booking.booker_vorname.toLowerCase() ||
      nachname.trim().toLowerCase() !== booking.booker_nachname.toLowerCase() ||
      gj !== booking.booker_geburtsjahr
    ) {
      toast({ title: "Fehler", description: "Die Angaben stimmen nicht mit dem Bucher überein.", variant: "destructive" });
      return false;
    }
    return true;
  };

  // Verify as either booker or partner
  const verifyParticipant = async (): Promise<'booker' | 'partner' | false> => {
    const gj = parseInt(geburtsjahr, 10);
    if (!vorname.trim() || !nachname.trim() || isNaN(gj)) {
      toast({ title: "Fehler", description: "Bitte alle Felder ausfüllen.", variant: "destructive" });
      return false;
    }
    // Check booker
    if (
      vorname.trim().toLowerCase() === booking.booker_vorname.toLowerCase() &&
      nachname.trim().toLowerCase() === booking.booker_nachname.toLowerCase() &&
      gj === booking.booker_geburtsjahr
    ) {
      return 'booker';
    }
    // Check partner (if joined)
    if (
      booking.is_joined &&
      booking.partner_vorname &&
      booking.partner_nachname &&
      booking.partner_geburtsjahr &&
      vorname.trim().toLowerCase() === booking.partner_vorname.toLowerCase() &&
      nachname.trim().toLowerCase() === booking.partner_nachname.toLowerCase() &&
      gj === booking.partner_geburtsjahr
    ) {
      return 'partner';
    }
    toast({ title: "Fehler", description: "Die Angaben stimmen nicht mit einem Teilnehmer überein.", variant: "destructive" });
    return false;
  };

  const handleCancel = async () => {
    if (!await verifyBooker()) return;
    if (booking.is_joined && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-booking', {
        body: {
          bookingId: booking.id,
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          geburtsjahr: parseInt(geburtsjahr, 10),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Erfolg", description: "Buchung wurde storniert." });
      onSuccess();
      handleClose();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleVerifyForEdit = async () => {
    if (!await verifyBooker()) return;
    setVerified(true);
    setEditComment(booking.booker_comment || "");
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-booking', {
        body: {
          bookingId: booking.id,
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          geburtsjahr: parseInt(geburtsjahr, 10),
          bookerComment: editComment,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Erfolg", description: "Buchung wurde aktualisiert." });
      onSuccess();
      handleClose();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleJoin = async () => {
    const gj = parseInt(geburtsjahr, 10);
    if (!vorname.trim() || !nachname.trim() || isNaN(gj)) {
      toast({ title: "Fehler", description: "Bitte alle Felder ausfüllen.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-booking', {
        body: {
          bookingId: booking.id,
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          geburtsjahr: gj,
          comment: comment || null,
          turnstileToken: turnstileToken,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Trigger email notification to the initial booker (fire-and-forget)
      try {
        await supabase.functions.invoke('notify-join', {
          body: {
            bookingId: booking.id,
            partnerVorname: vorname.trim(),
            partnerNachname: nachname.trim(),
            partnerComment: comment || null,
          },
        });
      } catch (notifyErr) {
        console.warn('Join notification failed (non-blocking):', notifyErr);
      }

      toast({ title: "Erfolg", description: "Sie haben sich erfolgreich angemeldet!" });
      onSuccess();
      handleClose();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleShowInfo = async () => {
    const role = await verifyParticipant();
    if (!role) return;

    const names: string[] = [`${booking.booker_vorname} ${booking.booker_nachname}`];
    const comments: string[] = [];
    if (booking.booker_comment) comments.push(`Bucher: ${booking.booker_comment}`);

    if (booking.is_joined && booking.partner_vorname) {
      names.push(`${booking.partner_vorname} ${booking.partner_nachname}`);
      if (booking.partner_comment) comments.push(`Mitspieler: ${booking.partner_comment}`);
    }
    if (booking.double_match_names) {
      comments.push(`Mitspieler: ${booking.double_match_names}`);
    }

    setInfoData({
      names,
      comments: comments.length > 0 ? comments : ['Keine Kommentare hinterlassen.'],
    });
  };

  // Half booking view
  if (isHalf && action === null) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Halbbuchung — Platz {booking.court_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm"><strong>Bucher:</strong> {booking.booker_vorname} {booking.booker_nachname}</p>
            {booking.booker_comment && (
              <p className="text-sm bg-muted p-2 rounded-md">"{booking.booker_comment}"</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" onClick={() => setAction('cancel')}>Absagen</Button>
              <Button variant="outline" size="sm" onClick={() => setAction('edit')}>Bearbeiten</Button>
              <Button size="sm" onClick={() => setAction('join')}>Teilnehmen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Full booking view
  if (isFull && action === null) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Buchung — Platz {booking.court_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Dieser Platz ist vollständig gebucht.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" onClick={() => setAction('cancel')}>Absagen</Button>
              <Button variant="outline" size="sm" onClick={() => setAction('info')}>Zeigt Information</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Cancel action
  if (action === 'cancel') {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Buchung stornieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Bitte bestätigen Sie Ihre Identität:</p>
            <IdentityForm vorname={vorname} nachname={nachname} geburtsjahr={geburtsjahr}
              setVorname={setVorname} setNachname={setNachname} setGeburtsjahr={setGeburtsjahr} />
            {showConfirm && (
              <p className="text-sm text-destructive font-medium">
                ⚠️ Diese Buchung wurde von einem Mitspieler vervollständigt. Bitte informieren Sie den Mitspieler über die Stornierung.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetAction}>Zurück</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={loading}>
                {showConfirm ? "Trotzdem stornieren" : "Stornieren"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Edit action (half booking) — fixed: use verified flag instead of checking vorname
  if (action === 'edit') {
    if (!verified) {
      return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Buchung bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm">Bitte bestätigen Sie Ihre Identität:</p>
              <IdentityForm vorname={vorname} nachname={nachname} geburtsjahr={geburtsjahr}
                setVorname={setVorname} setNachname={setNachname} setGeburtsjahr={setGeburtsjahr} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetAction}>Zurück</Button>
                <Button onClick={handleVerifyForEdit} disabled={loading}>Weiter</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    }
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Buchung bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Kommentar</Label>
              <Textarea value={editComment} onChange={e => setEditComment(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetAction}>Zurück</Button>
              <Button onClick={handleSaveEdit} disabled={loading}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Join action
  if (action === 'join') {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Halbbuchung beitreten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Treten Sie der Buchung von <strong>{booking.booker_vorname}</strong> bei:</p>
            <IdentityForm vorname={vorname} nachname={nachname} geburtsjahr={geburtsjahr}
              setVorname={setVorname} setNachname={setNachname} setGeburtsjahr={setGeburtsjahr} />
            <div>
              <Label>Kommentar (optional)</Label>
              <Textarea value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Wird nur dem Bucher und dem Administrator angezeigt"
                rows={2} />
            </div>
            <TurnstileWidget onVerify={handleTurnstileVerify} onExpire={handleTurnstileExpire} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetAction}>Zurück</Button>
              <Button onClick={handleJoin} disabled={loading || !turnstileToken}>Teilnehmen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Info action — available for all completed bookings, verifies booker OR partner
  if (action === 'info') {
    if (!infoData) {
      return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Buchungsinformation</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm">Bitte bestätigen Sie Ihre Identität als Teilnehmer:</p>
              <IdentityForm vorname={vorname} nachname={nachname} geburtsjahr={geburtsjahr}
                setVorname={setVorname} setNachname={setNachname} setGeburtsjahr={setGeburtsjahr} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetAction}>Zurück</Button>
                <Button onClick={handleShowInfo} disabled={loading}>Anzeigen</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    }
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Buchungsinformation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Teilnehmer:</p>
              {infoData.names.map((name, i) => (
                <p key={i} className="text-sm">• {name}</p>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Kommentare:</p>
              {infoData.comments.map((c, i) => (
                <p key={i} className="text-sm bg-muted p-2 rounded-md">{c}</p>
              ))}
            </div>
            <Button variant="outline" onClick={handleClose}>Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

function IdentityForm({ vorname, nachname, geburtsjahr, setVorname, setNachname, setGeburtsjahr }: {
  vorname: string; nachname: string; geburtsjahr: string;
  setVorname: (v: string) => void; setNachname: (v: string) => void; setGeburtsjahr: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Vorname</Label>
          <Input value={vorname} onChange={e => setVorname(e.target.value)} />
        </div>
        <div>
          <Label>Nachname</Label>
          <Input value={nachname} onChange={e => setNachname(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Geburtsjahr</Label>
        <Input value={geburtsjahr} onChange={e => setGeburtsjahr(e.target.value)} type="number" placeholder="1984" />
      </div>
    </>
  );
}
