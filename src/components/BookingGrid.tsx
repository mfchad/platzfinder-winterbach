import { useMemo } from "react";
import { User, Users, UserPlus, UserCheck } from "lucide-react";
import type { Booking } from "@/lib/types";
import { anonymizeName } from "@/lib/types";

interface BookingGridProps {
  date: string;
  bookings: Booking[];
  startHour: number;
  endHour: number;
  courtsCount: number;
  onSlotClick: (court: number, hour: number, booking?: Booking) => void;
}

export default function BookingGrid({ date, bookings, startHour, endHour, courtsCount, onSlotClick }: BookingGridProps) {
  const hours = useMemo(() => {
    const h: number[] = [];
    for (let i = startHour; i < endHour; i++) h.push(i);
    return h;
  }, [startHour, endHour]);

  const courts = useMemo(() => Array.from({ length: courtsCount }, (_, i) => i + 1), [courtsCount]);

  const bookingMap = useMemo(() => {
    const map: Record<string, Booking> = {};
    bookings.forEach(b => { map[`${b.court_number}-${b.start_hour}`] = b; });
    return map;
  }, [bookings]);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  function isPast(hour: number): boolean {
    if (date < todayStr) return true;
    if (date > todayStr) return false;
    return hour < now.getHours();
  }

  const colWidth = courtsCount <= 4 ? 'minmax(100px, 1fr)' : 'minmax(85px, 1fr)';

  return (
    <div className="overflow-auto max-h-[75vh] rounded-md border border-border relative">
      <div
        className="grid gap-px bg-border"
        style={{
          gridTemplateColumns: `60px repeat(${courtsCount}, ${colWidth})`,
          minWidth: `${60 + courtsCount * 85}px`,
        }}
      >
        {/* Top-left corner cell (sticky both ways) */}
        <div
          className="sticky left-0 top-0 z-30 bg-background text-xs font-semibold text-muted-foreground p-2 flex items-center justify-center border-r border-b border-border shadow-[2px_2px_4px_-2px_hsl(var(--border))]"
        >
          Zeit
        </div>
        {/* Header row (sticky top) */}
        {courts.map(c => (
          <div
            key={c}
            className="sticky top-0 z-20 text-center font-display font-semibold text-xs sm:text-sm p-2 bg-court-header text-primary-foreground border-b border-border shadow-[0_2px_4px_-2px_hsl(var(--border))]"
          >
            Platz {c}
          </div>
        ))}

        {/* Data rows */}
        {hours.map(hour => (
          <>
            {/* Time label (sticky left) */}
            <div
              key={`t-${hour}`}
              className="sticky left-0 z-10 bg-background text-xs font-medium text-muted-foreground p-2 flex items-center justify-center border-r border-border shadow-[2px_0_4px_-2px_hsl(var(--border))]"
            >
              {String(hour).padStart(2, '0')}:00
            </div>
            {/* Court cells */}
            {courts.map(court => {
              const booking = bookingMap[`${court}-${hour}`];
              const past = isPast(hour);
              return (
                <SlotCell
                  key={`${court}-${hour}`}
                  booking={booking}
                  isPast={past}
                  onClick={() => {
                    if (past) return;
                    if (booking?.booking_type === 'special') return;
                    onSlotClick(court, hour, booking);
                  }}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

function SlotCell({ booking, isPast, onClick }: { booking?: Booking; isPast: boolean; onClick: () => void }) {
  if (isPast && !booking) {
    return <div className="court-cell court-cell-past" />;
  }
  if (isPast && booking) {
    return (
      <div className="court-cell court-cell-past opacity-50">
        <CellContent booking={booking} />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="court-cell court-cell-empty hover:shadow-md" onClick={onClick}>
        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
          Frei
        </div>
      </div>
    );
  }

  if (booking.booking_type === 'special') {
    return (
      <div className="court-cell court-cell-special">
        <div className="h-full flex items-center justify-center text-xs font-semibold">
          {booking.special_label || 'Belegt'}
        </div>
      </div>
    );
  }

  if (booking.booking_type === 'half' && !booking.is_joined) {
    return (
      <div className="court-cell overflow-hidden cursor-pointer hover:shadow-md" onClick={onClick}>
        <div className="h-full flex">
          {/* Left half - booked */}
          <div className="w-1/2 bg-court-half flex flex-col items-center justify-center p-1">
            <User className="w-4 h-4 text-foreground" />
            <span className="text-[10px] font-medium mt-0.5 text-foreground">{anonymizeName(booking.booker_vorname)}</span>
          </div>
          {/* Right half - open */}
          <div className="w-1/2 bg-card flex flex-col items-center justify-center p-1 border-l border-dashed border-border">
            <UserPlus className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground mt-0.5">+</span>
          </div>
        </div>
      </div>
    );
  }

  // Full or joined half booking
  const isDouble = booking.booking_type === 'double';
  const PlayerIcon = isDouble ? Users : UserCheck;

  return (
    <div className="court-cell court-cell-full overflow-hidden cursor-pointer hover:shadow-md" onClick={onClick}>
      <div className="h-full flex">
        <div className="w-1/2 flex flex-col items-center justify-center p-1">
          <PlayerIcon className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">{anonymizeName(booking.booker_vorname)}</span>
        </div>
        <div className="w-1/2 flex flex-col items-center justify-center p-1 border-l border-primary-foreground/20">
          <PlayerIcon className="w-4 h-4" />
          {booking.is_joined && booking.partner_vorname && (
            <span className="text-[10px] font-medium mt-0.5">{anonymizeName(booking.partner_vorname)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CellContent({ booking }: { booking: Booking }) {
  if (booking.booking_type === 'special') {
    return (
      <div className="h-full flex items-center justify-center text-xs font-semibold">
        {booking.special_label || 'Belegt'}
      </div>
    );
  }
  return (
    <div className="h-full flex items-center justify-center text-xs">
      <User className="w-3 h-3 mr-1" />
      {anonymizeName(booking.booker_vorname)}
    </div>
  );
}
