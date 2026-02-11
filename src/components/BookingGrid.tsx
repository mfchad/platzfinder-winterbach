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

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `80px repeat(${courtsCount}, 1fr)` }}>
          <div className="text-sm font-semibold text-muted-foreground p-2">Zeit</div>
          {courts.map(c => (
            <div key={c} className="text-center font-display font-semibold text-sm p-2 rounded-t-md bg-court-header text-primary-foreground">
              Platz {c}
            </div>
          ))}
        </div>

        {/* Rows */}
        {hours.map(hour => (
          <div key={hour} className="grid gap-1 mb-1" style={{ gridTemplateColumns: `80px repeat(${courtsCount}, 1fr)` }}>
            <div className="text-sm font-medium text-muted-foreground p-2 flex items-center">
              {String(hour).padStart(2, '0')}:00
            </div>
            {courts.map(court => {
              const booking = bookingMap[`${court}-${hour}`];
              const past = isPast(hour);
              return (
                <SlotCell
                  key={court}
                  booking={booking}
                  isPast={past}
                  onClick={() => {
                    if (past) return;
                    if (booking?.booking_type === 'special' && !booking.created_by_admin) return;
                    if (booking?.booking_type === 'special') return;
                    onSlotClick(court, hour, booking);
                  }}
                />
              );
            })}
          </div>
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
