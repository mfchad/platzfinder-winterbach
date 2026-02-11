import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import type { Booking } from "@/lib/types";

interface AdminBookingsListProps {
  bookings: Booking[];
  onDelete: (id: string) => void;
}

const PAGE_SIZE = 20;

export default function AdminBookingsList({ bookings, onDelete }: AdminBookingsListProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.toLowerCase();
    return bookings.filter(b =>
      `${b.booker_vorname} ${b.booker_nachname} ${b.booking_type} ${b.special_label || ""} ${b.partner_vorname || ""} ${b.partner_nachname || ""} ${b.double_match_names || ""}`
        .toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Suchen (Name, Typ...)"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
        className="max-w-xs"
      />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Zeit</TableHead>
              <TableHead>Platz</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Bucher</TableHead>
              <TableHead>Partner / Mitspieler</TableHead>
              <TableHead>Kommentar</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map(b => (
              <TableRow key={b.id} className={b.booking_type === "double" ? "bg-wimbledon-gold/10" : ""}>
                <TableCell className="whitespace-nowrap">{formatDate(b.date)}</TableCell>
                <TableCell>{String(b.start_hour).padStart(2, "0")}:00</TableCell>
                <TableCell>Platz {b.court_number}</TableCell>
                <TableCell>{typeLabel(b)}</TableCell>
                <TableCell className="whitespace-nowrap">{b.booker_vorname} {b.booker_nachname}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {b.partner_vorname ? `${b.partner_vorname} ${b.partner_nachname}` : b.double_match_names || "-"}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">{b.booker_comment || b.partner_comment || "-"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(b)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Keine Buchungen gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length} Buchung{filtered.length !== 1 ? "en" : ""} — Seite {currentPage + 1}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buchung löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Buchung wirklich löschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(deleteTarget?.recurrence_parent_id || deleteTarget?.recurrence_type) && (
            <div className="bg-accent border border-border rounded-md p-3 text-sm">
              <strong>Hinweis: Dieser Termin gehört zu einer Serie.</strong>{" "}
              Änderungen hier betreffen nur diesen Termin. Um die gesamte Serie zu ändern, nutzen Sie bitte die Seite <em>Sonderbuchungen</em>.
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteTarget) { onDelete(deleteTarget.id); setDeleteTarget(null); } }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function typeLabel(b: Booking): string {
  if (b.booking_type === "special") return b.special_label || "Sonderbuchung";
  if (b.booking_type === "half") return b.is_joined ? "Halb → Voll" : "Halbbuchung";
  if (b.booking_type === "double") return "🎾 Doppel";
  return "Einzel";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}
