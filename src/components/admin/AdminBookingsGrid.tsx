import { useMemo, useState } from "react";
import { User, Users, UserPlus, UserCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { format, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import type { Booking } from "@/lib/types";
import { formatDateISO } from "@/lib/types";

interface AdminBookingsGridProps {
  bookings: Booking[];
  date: Date;
  timeScale: "day" | "week" | "month" | "year";
  startHour: number;
  endHour: number;
  courtsCount: number;
  onDelete: (id: string) => void;
  onDrillDown?: (date: Date, scale: "day" | "week" | "month") => void;
}

export default function AdminBookingsGrid({
  bookings, date, timeScale, startHour, endHour, courtsCount, onDelete, onDrillDown,
}: AdminBookingsGridProps) {
  if (timeScale === "month") return <MonthGrid bookings={bookings} date={date} onDrillDown={(d) => onDrillDown?.(d, "day")} />;
  if (timeScale === "year") return <YearGrid bookings={bookings} date={date} onDrillDown={onDrillDown} />;
  if (timeScale === "week") return <WeekGrid bookings={bookings} date={date} startHour={startHour} endHour={endHour} courtsCount={courtsCount} onDelete={onDelete} onDrillDown={(d) => onDrillDown?.(d, "day")} />;
  return <DayGrid bookings={bookings} date={date} startHour={startHour} endHour={endHour} courtsCount={courtsCount} onDelete={onDelete} />;
}

// ===== Day Grid =====
function DayGrid({ bookings, date, startHour, endHour, courtsCount, onDelete }: {
  bookings: Booking[]; date: Date; startHour: number; endHour: number; courtsCount: number; onDelete: (id: string) => void;
}) {
  const hours = useMemo(() => Array.from({ length: endHour - startHour }, (_, i) => i + startHour), [startHour, endHour]);
  const courts = useMemo(() => Array.from({ length: courtsCount }, (_, i) => i + 1), [courtsCount]);
  const dateStr = formatDateISO(date);

  const bookingMap = useMemo(() => {
    const map: Record<string, Booking> = {};
    bookings.filter(b => b.date === dateStr).forEach(b => { map[`${b.court_number}-${b.start_hour}`] = b; });
    return map;
  }, [bookings, dateStr]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `80px repeat(${courtsCount}, 1fr)` }}>
          <div className="text-sm font-semibold text-muted-foreground p-2">Zeit</div>
          {courts.map(c => (
            <div key={c} className="text-center font-display font-semibold text-sm p-2 rounded-t-md bg-court-header text-primary-foreground">
              Platz {c}
            </div>
          ))}
        </div>
        {hours.map(hour => (
          <div key={hour} className="grid gap-1 mb-1" style={{ gridTemplateColumns: `80px repeat(${courtsCount}, 1fr)` }}>
            <div className="text-sm font-medium text-muted-foreground p-2 flex items-center">
              {String(hour).padStart(2, "0")}:00
            </div>
            {courts.map(court => {
              const booking = bookingMap[`${court}-${hour}`];
              return (
                <AdminSlotCell key={court} booking={booking} onDelete={onDelete} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Week Grid =====
function WeekGrid({ bookings, date, startHour, endHour, courtsCount, onDelete, onDrillDown }: {
  bookings: Booking[]; date: Date; startHour: number; endHour: number; courtsCount: number; onDelete: (id: string) => void;
  onDrillDown?: (date: Date) => void;
}) {
  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  }), [date]);

  const hours = useMemo(() => Array.from({ length: endHour - startHour }, (_, i) => i + startHour), [startHour, endHour]);

  const bookingMap = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach(b => {
      const key = `${b.date}-${b.start_hour}`;
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [bookings]);

  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

  return (
    <div className="overflow-x-auto" onMouseLeave={() => setHoveredDay(null)}>
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}>
          <div className="text-xs font-semibold text-muted-foreground p-1" />
           {days.map((d, i) => (
            <div
              key={d.toISOString()}
              className={`text-center text-xs font-display font-semibold p-2 rounded-t-md bg-court-header text-primary-foreground cursor-pointer transition-all ${
                hoveredDay === i ? "ring-2 ring-primary brightness-125" : ""
              }`}
              onClick={() => onDrillDown?.(d)}
              onMouseEnter={() => setHoveredDay(i)}
            >
              {format(d, "EEE dd.MM", { locale: de })}
            </div>
          ))}
        </div>
        {/* Rows */}
        {hours.map(hour => (
          <div key={hour} className="grid gap-1 mb-0.5" style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}>
            <div className="text-xs font-medium text-muted-foreground p-1 flex items-center">
              {String(hour).padStart(2, "0")}:00
            </div>
            {days.map((d, i) => {
              const dayStr = formatDateISO(d);
              const dayBookings = bookingMap[`${dayStr}-${hour}`] || [];
              const count = dayBookings.length;
              const isHovered = hoveredDay === i;
              return (
                <Tooltip key={dayStr}>
                  <TooltipTrigger asChild>
                    <div
                      className={`border rounded-sm min-h-[2rem] flex items-center justify-center text-xs cursor-pointer transition-all ${
                        count === 0
                          ? `bg-court-empty ${isHovered ? "bg-muted/70 border-primary/30 ring-1 ring-primary/20" : "border-border"}`
                          : count >= courtsCount
                          ? `bg-court-full text-primary-foreground ${isHovered ? "ring-1 ring-primary/40 brightness-110" : "border-border"}`
                          : `bg-court-half ${isHovered ? "ring-1 ring-primary/40 brightness-110" : "border-border"}`
                      }`}
                      onClick={() => onDrillDown?.(d)}
                      onMouseEnter={() => setHoveredDay(i)}>
                      {count > 0 ? `${count}/${courtsCount}` : ""}
                    </div>
                  </TooltipTrigger>
                  {count > 0 && (
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1 text-xs">
                        {dayBookings.map(b => (
                          <div key={b.id} className="flex items-center justify-between gap-2">
                            <span>P{b.court_number}: {b.booker_vorname} {b.booker_nachname} ({typeLabel(b)})</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); }}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buchung löschen</DialogTitle>
            <DialogDescription>
              Möchten Sie diese Buchung wirklich löschen?
            </DialogDescription>
          </DialogHeader>
          {(deleteTarget?.recurrence_parent_id || deleteTarget?.recurrence_type) && (
            <p className="text-sm font-bold text-foreground">
              Hinweis: Dieser Termin gehört zu einer Serie. Änderungen hier betreffen nur diesen Termin. Um die gesamte Serie zu ändern, nutzen Sie bitte die Seite Sonderbuchungen.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={() => { onDelete(deleteTarget!.id); setDeleteTarget(null); }}>Bestätigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Month Grid =====
function MonthGrid({ bookings, date, onDrillDown }: { bookings: Booking[]; date: Date; onDrillDown?: (date: Date) => void }) {
  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach(b => { map[b.date] = (map[b.date] || 0) + 1; });
    return map;
  }, [bookings]);

  // Build 6-week calendar grid
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const startDay = startOfWeek(firstDay, { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  let current = new Date(startDay);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground p-1">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
            {week.map(d => {
              const ds = formatDateISO(d);
              const count = countByDate[ds] || 0;
              const isCurrentMonth = d.getMonth() === date.getMonth();
              return (
                <div
                  key={ds}
                  className={`border border-border rounded-sm p-2 min-h-[3rem] cursor-pointer hover:ring-1 hover:ring-primary hover:bg-muted/50 transition-all ${
                    !isCurrentMonth ? "opacity-30" : count > 0 ? "bg-court-half/30" : ""
                  }`}
                  onClick={() => isCurrentMonth && onDrillDown?.(d)}
                >
                  <div className="text-xs font-medium">{d.getDate()}</div>
                  {count > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">{count} Buchung{count !== 1 ? "en" : ""}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Year Grid =====
function YearGrid({ bookings, date, onDrillDown }: { bookings: Booking[]; date: Date; onDrillDown?: (date: Date, scale: "day" | "week" | "month") => void }) {
  const countByMonth = useMemo(() => {
    const map: Record<number, number> = {};
    bookings.forEach(b => {
      const m = new Date(b.date).getMonth();
      map[m] = (map[m] || 0) + 1;
    });
    return map;
  }, [bookings]);

  const months = Array.from({ length: 12 }, (_, i) => i);
  const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {months.map(m => {
        const count = countByMonth[m] || 0;
        const isCurrent = m === date.getMonth();
        return (
          <div key={m} className={`border border-border rounded-md p-4 text-center cursor-pointer hover:ring-1 hover:ring-primary transition-all ${
            isCurrent ? "ring-2 ring-primary" : ""
          } ${count > 0 ? "bg-court-half/20" : ""}`}
            onClick={() => onDrillDown?.(new Date(date.getFullYear(), m, 1), "month")}
          >
            <div className="font-display font-semibold text-sm">{monthNames[m]}</div>
            <div className="text-2xl font-bold text-foreground mt-1">{count}</div>
            <div className="text-xs text-muted-foreground">Buchungen</div>
          </div>
        );
      })}
    </div>
  );
}

// ===== Shared components =====
function AdminSlotCell({ booking, onDelete }: { booking?: Booking; onDelete: (id: string) => void }) {
  if (!booking) {
    return (
      <div className="court-cell court-cell-empty cursor-default">
        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Frei</div>
      </div>
    );
  }

  const isSpecial = booking.booking_type === "special";
  const isHalf = booking.booking_type === "half" && !booking.is_joined;
  const isDouble = booking.booking_type === "double";

  const cellClass = isSpecial
    ? "court-cell court-cell-special"
    : isHalf
    ? "court-cell bg-court-half"
    : "court-cell court-cell-full";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`${cellClass} cursor-pointer`}>
          <div className="h-full flex items-center justify-center text-xs font-medium gap-1 px-1">
            {isSpecial ? (
              <span>{booking.special_label || "Belegt"}</span>
            ) : isDouble ? (
              <><Users className="w-3 h-3 shrink-0" /><span className="truncate">{booking.booker_vorname}</span></>
            ) : isHalf ? (
              <><UserPlus className="w-3 h-3 shrink-0" /><span className="truncate">{booking.booker_vorname}</span></>
            ) : (
              <><UserCheck className="w-3 h-3 shrink-0" /><span className="truncate">{booking.booker_vorname}</span></>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1 text-xs">
          <p className="font-semibold">{typeLabel(booking)}</p>
          <p>Bucher: {booking.booker_vorname} {booking.booker_nachname} ({booking.booker_geburtsjahr})</p>
          {booking.partner_vorname && (
            <p>Partner: {booking.partner_vorname} {booking.partner_nachname}</p>
          )}
          {booking.double_match_names && <p>Mitspieler: {booking.double_match_names}</p>}
          {booking.booker_comment && <p>Kommentar: {booking.booker_comment}</p>}
          {booking.booker_email && <p>E-Mail: {booking.booker_email}</p>}
          <p className="text-muted-foreground">Erstellt: {new Date(booking.created_at).toLocaleString("de-DE")}</p>
          <Button
            variant="destructive"
            size="sm"
            className="w-full mt-1 h-6 text-xs"
            onClick={(e) => { e.stopPropagation(); onDelete(booking.id); }}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Löschen
          </Button>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function typeLabel(b: Booking): string {
  if (b.booking_type === "special") return b.special_label || "Sonderbuchung";
  if (b.booking_type === "half") return b.is_joined ? "Halb → Voll" : "Halbbuchung";
  if (b.booking_type === "double") return "🎾 Doppel";
  return "Einzel";
}
