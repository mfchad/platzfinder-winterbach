import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CalendarCheck, Trash2, Edit, AlertTriangle, RefreshCw } from "lucide-react";
import { de } from "date-fns/locale";
import { format, addDays, isBefore, isEqual, getDay } from "date-fns";
import { formatDateISO } from "@/lib/types";
import type { Booking } from "@/lib/types";

const COURTS = [1, 2, 3, 4, 5, 6];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8-21
const WEEKDAYS = [
  { label: "Mo", iso: 1 },
  { label: "Di", iso: 2 },
  { label: "Mi", iso: 3 },
  { label: "Do", iso: 4 },
  { label: "Fr", iso: 5 },
  { label: "Sa", iso: 6 },
  { label: "So", iso: 0 },
];

interface ConflictInfo {
  booking: Booking;
  date: string;
  court: number;
  hour: number;
}

interface SeriesGroup {
  parentId: string;
  label: string;
  count: number;
  minDate: string;
  maxDate: string;
  bookings: Booking[];
  recurrenceType: string;
}

export default function SpecialBookingsTab() {
  const [mode, setMode] = useState<"einmalig" | "woechentlich">("einmalig");
  // Einmalig fields
  const [einmaligDate, setEinmaligDate] = useState<Date | undefined>(undefined);
  const [einmaligCourts, setEinmaligCourts] = useState<number[]>([]);
  const [einmaligStartHour, setEinmaligStartHour] = useState("8");
  const [einmaligEndHour, setEinmaligEndHour] = useState("9");
  const [einmaligLabel, setEinmaligLabel] = useState("Abo");

  // Wöchentlich fields
  const [weeklyStartDate, setWeeklyStartDate] = useState<Date | undefined>(undefined);
  const [weeklyEndDate, setWeeklyEndDate] = useState<Date | undefined>(undefined);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [weeklyCourts, setWeeklyCourts] = useState<number[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<number[]>([]);
  const [weeklyLabel, setWeeklyLabel] = useState("Abo");

  // Confirmation / conflict
  const [showSummary, setShowSummary] = useState(false);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Series management
  const [seriesGroups, setSeriesGroups] = useState<SeriesGroup[]>([]);
  const [deleteSeriesId, setDeleteSeriesId] = useState<string | null>(null);

  // Edit mode
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  const { toast } = useToast();

  const loadSeries = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_type", "special")
      .not("recurrence_parent_id", "is", null)
      .order("date");

    const bookings = (data || []) as Booking[];
    const groups: Record<string, Booking[]> = {};
    for (const b of bookings) {
      const key = b.recurrence_parent_id || b.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    }

    const result: SeriesGroup[] = Object.entries(groups).map(([parentId, bks]) => ({
      parentId,
      label: bks[0].special_label || "Sonderbuchung",
      count: bks.length,
      minDate: bks.reduce((min, b) => (b.date < min ? b.date : min), bks[0].date),
      maxDate: bks.reduce((max, b) => (b.date > max ? b.date : max), bks[0].date),
      bookings: bks,
      recurrenceType: bks[0].recurrence_type || "weekly",
    }));

    result.sort((a, b) => a.minDate.localeCompare(b.minDate));
    setSeriesGroups(result);
  }, []);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  // Toggle helpers
  const toggleInArray = (arr: number[], val: number) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  // Generate bookings for Einmalig mode
  function generateEinmaligBookings(): any[] {
    if (!einmaligDate || einmaligCourts.length === 0) return [];
    const start = parseInt(einmaligStartHour);
    const end = parseInt(einmaligEndHour);
    if (start >= end) return [];

    const parentId = crypto.randomUUID();
    const dateStr = formatDateISO(einmaligDate);
    const bookings: any[] = [];

    for (const court of einmaligCourts) {
      for (let h = start; h < end; h++) {
        bookings.push({
          court_number: court,
          date: dateStr,
          start_hour: h,
          booking_type: "special",
          special_label: einmaligLabel,
          booker_vorname: "Admin",
          booker_nachname: "System",
          booker_geburtsjahr: 2000,
          recurrence_parent_id: parentId,
          recurrence_type: "einmalig",
          created_by_admin: true,
          is_joined: false,
        });
      }
    }
    return bookings;
  }

  // Generate bookings for Wöchentlich mode
  function generateWeeklyBookings(): any[] {
    if (!weeklyStartDate || !weeklyEndDate || weeklyDays.length === 0 || weeklyCourts.length === 0 || weeklyHours.length === 0) return [];

    const parentId = crypto.randomUUID();
    const bookings: any[] = [];
    let current = new Date(weeklyStartDate);
    const end = new Date(weeklyEndDate);

    while (isBefore(current, end) || isEqual(current, end)) {
      const jsDay = getDay(current); // 0=Sun
      if (weeklyDays.includes(jsDay)) {
        const dateStr = formatDateISO(current);
        for (const court of weeklyCourts) {
          for (const h of weeklyHours) {
            bookings.push({
              court_number: court,
              date: dateStr,
              start_hour: h,
              booking_type: "special",
              special_label: weeklyLabel,
              booker_vorname: "Admin",
              booker_nachname: "System",
              booker_geburtsjahr: 2000,
              recurrence_parent_id: parentId,
              recurrence_type: "weekly",
              created_by_admin: true,
              is_joined: false,
            });
          }
        }
      }
      current = addDays(current, 1);
    }
    return bookings;
  }

  const handlePreview = () => {
    const bookings = mode === "einmalig" ? generateEinmaligBookings() : generateWeeklyBookings();
    if (bookings.length === 0) {
      toast({ title: "Fehler", description: "Bitte alle Pflichtfelder ausfüllen.", variant: "destructive" });
      return;
    }
    setPendingBookings(bookings);

    // If editing, show edit-specific confirmation first
    if (editingParentId) {
      setShowEditConfirm(true);
    } else {
      setShowSummary(true);
    }
  };

  const handleEditConfirmProceed = () => {
    setShowEditConfirm(false);
    setShowSummary(true);
  };

  const handleConfirmAndCheckConflicts = async () => {
    setShowSummary(false);
    setIsSaving(true);

    // If editing, delete old series bookings first
    let deleteOldIds: string[] = [];
    if (editingParentId) {
      const { data: oldBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("recurrence_parent_id", editingParentId);
      deleteOldIds = (oldBookings || []).map((b: any) => b.id);
    }

    // Check for conflicts (exclude special bookings AND the old series being edited)
    const dateSet = [...new Set(pendingBookings.map((b) => b.date))];
    const query = supabase
      .from("bookings")
      .select("*")
      .in("date", dateSet)
      .neq("booking_type", "special");

    const { data: existing } = await query;

    const existingBookings = (existing || []) as Booking[];
    // Also exclude old series bookings from conflict check
    const filteredExisting = editingParentId
      ? existingBookings.filter((eb) => !deleteOldIds.includes(eb.id))
      : existingBookings;

    const found: ConflictInfo[] = [];
    for (const pb of pendingBookings) {
      const conflict = filteredExisting.find(
        (eb) => eb.date === pb.date && eb.court_number === pb.court_number && eb.start_hour === pb.start_hour
      );
      if (conflict) {
        found.push({ booking: conflict, date: pb.date, court: pb.court_number, hour: pb.start_hour });
      }
    }

    if (found.length > 0) {
      setConflicts(found);
      setShowConflicts(true);
      setIsSaving(false);
    } else {
      // Delete old series + save new
      await saveBookings(pendingBookings, deleteOldIds);
    }
  };

  const handleOverwrite = async () => {
    setShowConflicts(false);
    const conflictIds = conflicts.map((c) => c.booking.id);

    // Also include old series bookings for deletion if editing
    let allDeleteIds = [...conflictIds];
    if (editingParentId) {
      const { data: oldBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("recurrence_parent_id", editingParentId);
      const oldIds = (oldBookings || []).map((b: any) => b.id);
      allDeleteIds = [...new Set([...allDeleteIds, ...oldIds])];
    }

    await saveBookings(pendingBookings, allDeleteIds);
  };

  const saveBookings = async (bookings: any[], deleteIds: string[]) => {
    setIsSaving(true);
    try {
      if (deleteIds.length > 0) {
        const { error: delErr } = await supabase.from("bookings").delete().in("id", deleteIds);
        if (delErr) {
          toast({ title: "Fehler", description: delErr.message, variant: "destructive" });
          return;
        }
      }

      // Remove the placeholder recurrence_parent_id — we'll use the first booking's real id
      const bookingsToInsert = bookings.map(({ recurrence_parent_id, ...rest }) => rest);

      // Insert the first booking to get its ID
      const [first, ...rest] = bookingsToInsert;
      const { data: firstData, error: firstErr } = await supabase
        .from("bookings")
        .insert(first)
        .select("id")
        .single();

      if (firstErr || !firstData) {
        toast({ title: "Fehler", description: firstErr?.message || "Erste Buchung fehlgeschlagen.", variant: "destructive" });
        return;
      }

      const parentId = firstData.id;

      // Update the first booking to set its own recurrence_parent_id
      await supabase.from("bookings").update({ recurrence_parent_id: parentId }).eq("id", parentId);

      // Insert remaining bookings with the real parent ID
      if (rest.length > 0) {
        const remaining = rest.map((b) => ({ ...b, recurrence_parent_id: parentId }));
        const { error } = await supabase.from("bookings").insert(remaining);
        if (error) {
          toast({ title: "Fehler", description: error.message, variant: "destructive" });
          return;
        }
      }

      toast({
        title: "Erfolg",
        description: editingParentId
          ? `Serie aktualisiert: ${bookings.length} Buchung(en).`
          : `${bookings.length} Sonderbuchung(en) erstellt.`,
      });
      resetForm();
      loadSeries();
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEinmaligDate(undefined);
    setEinmaligCourts([]);
    setEinmaligStartHour("8");
    setEinmaligEndHour("9");
    setEinmaligLabel("Abo");
    setWeeklyStartDate(undefined);
    setWeeklyEndDate(undefined);
    setWeeklyDays([]);
    setWeeklyCourts([]);
    setWeeklyHours([]);
    setWeeklyLabel("Abo");
    setPendingBookings([]);
    setConflicts([]);
    setEditingParentId(null);
  };

  const handleDeleteSeries = async () => {
    if (!deleteSeriesId) return;
    const { error } = await supabase.from("bookings").delete().eq("recurrence_parent_id", deleteSeriesId);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Erfolg", description: "Serie gelöscht." });
      loadSeries();
    }
    setDeleteSeriesId(null);
  };

  const handleEditSeries = (sg: SeriesGroup) => {
    // Populate form from series bookings
    const bks = sg.bookings;
    const isEinmalig = sg.recurrenceType === "einmalig";

    setEditingParentId(sg.parentId);

    if (isEinmalig) {
      setMode("einmalig");
      // All bookings share same date
      setEinmaligDate(new Date(bks[0].date + "T00:00:00"));
      const courts = [...new Set(bks.map((b) => b.court_number))].sort();
      setEinmaligCourts(courts);
      const hours = bks.map((b) => b.start_hour).sort((a, b) => a - b);
      setEinmaligStartHour(String(Math.min(...hours)));
      setEinmaligEndHour(String(Math.max(...hours) + 1));
      setEinmaligLabel(bks[0].special_label || "Abo");
    } else {
      setMode("woechentlich");
      setWeeklyStartDate(new Date(sg.minDate + "T00:00:00"));
      setWeeklyEndDate(new Date(sg.maxDate + "T00:00:00"));
      const courts = [...new Set(bks.map((b) => b.court_number))].sort();
      setWeeklyCourts(courts);
      const hours = [...new Set(bks.map((b) => b.start_hour))].sort((a, b) => a - b);
      setWeeklyHours(hours);
      // Derive weekdays from bookings
      const days = [...new Set(bks.map((b) => getDay(new Date(b.date + "T00:00:00"))))];
      setWeeklyDays(days);
      setWeeklyLabel(bks[0].special_label || "Abo");
    }

    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast({ title: "Bearbeiten", description: "Serie-Parameter wurden in das Formular geladen." });
  };

  return (
    <div className="space-y-6">
      {/* ===== Batch Booking Form ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center justify-between">
            {editingParentId ? "Serie bearbeiten" : "Sonderbuchung erstellen"}
            {editingParentId && (
              <Button variant="outline" size="sm" onClick={resetForm}>
                Abbrechen
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingParentId && (
            <div className="bg-muted border border-border rounded-md p-3 text-sm text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Sie bearbeiten eine bestehende Serie. Änderungen überschreiben alle Termine dieser Serie.
            </div>
          )}

          {/* Mode selector */}
          <div>
            <Label>Buchungstyp</Label>
            <Select value={mode} onValueChange={(v) => { setMode(v as any); resetForm(); }}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="einmalig">Einmalig (Zeitraum an einem Tag)</SelectItem>
                <SelectItem value="woechentlich">Wöchentlich (Serie)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "einmalig" ? (
            <EinmaligForm
              date={einmaligDate} setDate={setEinmaligDate}
              courts={einmaligCourts} setCourts={setEinmaligCourts}
              startHour={einmaligStartHour} setStartHour={setEinmaligStartHour}
              endHour={einmaligEndHour} setEndHour={setEinmaligEndHour}
              label={einmaligLabel} setLabel={setEinmaligLabel}
              toggleInArray={toggleInArray}
            />
          ) : (
            <WeeklyForm
              startDate={weeklyStartDate} setStartDate={setWeeklyStartDate}
              endDate={weeklyEndDate} setEndDate={setWeeklyEndDate}
              days={weeklyDays} setDays={setWeeklyDays}
              courts={weeklyCourts} setCourts={setWeeklyCourts}
              hours={weeklyHours} setHours={setWeeklyHours}
              label={weeklyLabel} setLabel={setWeeklyLabel}
              toggleInArray={toggleInArray}
            />
          )}

          <Button onClick={handlePreview} disabled={isSaving}>
            {editingParentId ? "Änderungen prüfen" : "Vorschau & Erstellen"}
          </Button>
        </CardContent>
      </Card>

      {/* ===== Series Management List ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Serien-Übersicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground italic">
            Um einzelne Termine einer Serie zu ändern, gehen Sie bitte auf die &apos;Buchungen&apos; Seite.
          </p>

          {seriesGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Serien vorhanden.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>Zeitraum</TableHead>
                    <TableHead>Termine</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seriesGroups.map((sg) => (
                    <TableRow key={sg.parentId}>
                      <TableCell>
                        <span title={sg.recurrenceType === "einmalig" ? "Einmalig" : "Wöchentlich"}>
                          {sg.recurrenceType === "einmalig" ? (
                            <CalendarCheck className="h-4 w-4 text-primary" />
                          ) : (
                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{sg.label}</TableCell>
                      <TableCell className="text-sm">
                        {sg.minDate === sg.maxDate
                          ? format(new Date(sg.minDate + "T00:00:00"), "dd.MM.yyyy")
                          : `${format(new Date(sg.minDate + "T00:00:00"), "dd.MM.yyyy")} – ${format(new Date(sg.maxDate + "T00:00:00"), "dd.MM.yyyy")}`}
                      </TableCell>
                      <TableCell>{sg.count}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditSeries(sg)}
                          title="Bearbeiten"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteSeriesId(sg.parentId)}
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Edit Confirmation Dialog ===== */}
      <Dialog open={showEditConfirm} onOpenChange={setShowEditConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Serie bearbeiten
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Sie bearbeiten eine Serie. Dies wird <strong>alle bestehenden Termine</strong> dieser Serie
            (einschließlich manueller Änderungen) überschreiben. Fortfahren?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowEditConfirm(false)}>Abbrechen</Button>
            <Button onClick={handleEditConfirmProceed}>
              Fortfahren
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Summary Dialog ===== */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Zusammenfassung</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>{pendingBookings.length}</strong> Buchung(en) werden {editingParentId ? "aktualisiert" : "erstellt"}.</p>
            {pendingBookings.length > 0 && (
              <>
                <p>Typ: <strong>{mode === "einmalig" ? "Einmalig" : "Wöchentlich"}</strong></p>
                <p>Bezeichnung: <strong>{pendingBookings[0]?.special_label}</strong></p>
                <p>
                  Plätze:{" "}
                  <strong>
                    {[...new Set(pendingBookings.map((b) => b.court_number))].sort().join(", ")}
                  </strong>
                </p>
                <p>
                  Zeitraum:{" "}
                  <strong>
                    {pendingBookings[0]?.date}
                    {pendingBookings[pendingBookings.length - 1]?.date !== pendingBookings[0]?.date &&
                      ` – ${pendingBookings[pendingBookings.length - 1]?.date}`}
                  </strong>
                </p>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowSummary(false)}>Abbrechen</Button>
            <Button onClick={handleConfirmAndCheckConflicts} disabled={isSaving}>
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Conflict Dialog ===== */}
      <Dialog open={showConflicts} onOpenChange={setShowConflicts}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Konflikte gefunden
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-semibold">
              Es gibt Konflikte mit bestehenden Buchungen. Sollen diese überschrieben und gelöscht werden?
            </p>
            <div className="max-h-48 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Platz</TableHead>
                    <TableHead>Uhrzeit</TableHead>
                    <TableHead>Bucher</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflicts.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell>{c.date}</TableCell>
                      <TableCell>Platz {c.court}</TableCell>
                      <TableCell>{String(c.hour).padStart(2, "0")}:00</TableCell>
                      <TableCell>
                        {c.booking.booker_vorname} {c.booking.booker_nachname}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConflicts(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleOverwrite} disabled={isSaving}>
              Überschreiben & Löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Series Confirmation ===== */}
      <Dialog open={!!deleteSeriesId} onOpenChange={() => setDeleteSeriesId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Serie löschen</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Möchten Sie die gesamte Serie wirklich löschen? Dies kann nicht rückgängig gemacht werden.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteSeriesId(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDeleteSeries}>Löschen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Einmalig Form =====
function EinmaligForm({
  date, setDate, courts, setCourts, startHour, setStartHour, endHour, setEndHour, label, setLabel, toggleInArray,
}: {
  date: Date | undefined; setDate: (d: Date | undefined) => void;
  courts: number[]; setCourts: (c: number[]) => void;
  startHour: string; setStartHour: (h: string) => void;
  endHour: string; setEndHour: (h: string) => void;
  label: string; setLabel: (l: string) => void;
  toggleInArray: (arr: number[], val: number) => number[];
}) {
  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label>Datum</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <Calendar className="mr-2 h-4 w-4" />
              {date ? format(date, "dd.MM.yyyy") : <span className="text-muted-foreground">Datum wählen</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker mode="single" selected={date} onSelect={setDate} locale={de} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label>Plätze</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {COURTS.map((c) => (
            <label key={c} className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox checked={courts.includes(c)} onCheckedChange={() => setCourts(toggleInArray(courts, c))} />
              <span className="text-sm">Platz {c}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Startzeit</Label>
          <Select value={startHour} onValueChange={setStartHour}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Endzeit</Label>
          <Select value={endHour} onValueChange={setEndHour}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h + 1} value={String(h + 1)}>{String(h + 1).padStart(2, "0")}:00</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Bezeichnung</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z.B. Abo, Platz Gesperrt" className="max-w-xs" />
      </div>
    </div>
  );
}

// ===== Weekly Form =====
function WeeklyForm({
  startDate, setStartDate, endDate, setEndDate, days, setDays, courts, setCourts, hours, setHours, label, setLabel, toggleInArray,
}: {
  startDate: Date | undefined; setStartDate: (d: Date | undefined) => void;
  endDate: Date | undefined; setEndDate: (d: Date | undefined) => void;
  days: number[]; setDays: (d: number[]) => void;
  courts: number[]; setCourts: (c: number[]) => void;
  hours: number[]; setHours: (h: number[]) => void;
  label: string; setLabel: (l: string) => void;
  toggleInArray: (arr: number[], val: number) => number[];
}) {
  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Startdatum</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <Calendar className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "dd.MM.yyyy") : <span className="text-muted-foreground">Startdatum</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker mode="single" selected={startDate} onSelect={setStartDate} locale={de} className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label>Enddatum</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <Calendar className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "dd.MM.yyyy") : <span className="text-muted-foreground">Enddatum</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker mode="single" selected={endDate} onSelect={setEndDate} locale={de} className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div>
        <Label>Wochentage</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {WEEKDAYS.map((wd) => (
            <label key={wd.iso} className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox checked={days.includes(wd.iso)} onCheckedChange={() => setDays(toggleInArray(days, wd.iso))} />
              <span className="text-sm">{wd.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>Plätze</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {COURTS.map((c) => (
            <label key={c} className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox checked={courts.includes(c)} onCheckedChange={() => setCourts(toggleInArray(courts, c))} />
              <span className="text-sm">Platz {c}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>Zeitblöcke</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {HOURS.map((h) => (
            <label key={h} className="flex items-center gap-1 cursor-pointer">
              <Checkbox checked={hours.includes(h)} onCheckedChange={() => setHours(toggleInArray(hours, h))} />
              <span className="text-sm">{String(h).padStart(2, "0")}:00</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>Bezeichnung</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z.B. Abo, Platz Gesperrt" className="max-w-xs" />
      </div>
    </div>
  );
}
