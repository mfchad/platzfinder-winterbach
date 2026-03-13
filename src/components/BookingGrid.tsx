import React, { useMemo } from "react";
import { User, Users, UserPlus, UserCheck } from "lucide-react";
import type { Booking } from "@/lib/types";
import { formatInitials } from "@/lib/types";

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
    <div
      className="booking-grid-area overflow-auto rounded-xl shadow-lg"
      style={{
        maxHeight: 'calc(100vh - 180px)',
        position: 'relative',
        isolation: 'isolate',
      }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `52px repeat(${courtsCount}, ${colWidth})`,
          minWidth: `${52 + courtsCount * 85}px`,
          gap: '4px',
        }}
      >
        {/* Top-left corner shield */}
        <div
          className="sticky left-0 top-0"
          style={{
            width: 52,
            zIndex: 50,
            background: '#FFFFFF',
            boxShadow: '2px 2px 4px rgba(0,0,0,0.06)',
          }}
        />
        {/* Court headers */}
        {courts.map(c => (
          <div
            key={c}
            className="sticky top-0 text-center font-display font-semibold text-xs sm:text-sm text-white"
            style={{
              background: 'hsl(var(--club-navy-muted))',
              padding: '9px 6px',
              borderRadius: 8,
              letterSpacing: '0.05em',
              zIndex: 30,
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            }}
          >
            Platz {c}
          </div>
        ))}

        {/* Data rows */}
        {hours.map(hour => (
          <React.Fragment key={hour}>
            {/* Time label */}
            <div
              className="sticky left-0 text-xs font-normal flex items-center justify-end pr-2.5"
              style={{
                background: '#FFFFFF',
                color: '#4A4A4A',
                fontVariantNumeric: 'tabular-nums',
                width: 52,
                zIndex: 20,
                boxShadow: '2px 0 4px rgba(0,0,0,0.04)',
              }}
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
                    // Allow click on special bookings that have a PIN
                    if (booking?.booking_type === 'special' && !booking?.has_absage_pin) return;
                    onSlotClick(court, hour, booking);
                  }}
                />
              );
            })}
          </React.Fragment>
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
      <div className="court-cell court-cell-empty" onClick={onClick}>
        <div className="h-full flex items-center justify-center text-xs" style={{ color: 'hsl(var(--slot-free-text))' }}>
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
      <div className="court-cell court-cell-half overflow-hidden cursor-pointer" onClick={onClick}>
        <div className="h-full flex">
          {/* Left half - booked */}
          <div className="w-1/2 flex flex-col items-center justify-center p-1" style={{ borderRight: '1px dashed hsl(var(--slot-half-border))' }}>
            <User className="w-4 h-4 text-accent-foreground" />
            <span className="text-[10px] font-medium mt-0.5 text-accent-foreground">{formatInitials(booking.booker_vorname, booking.booker_nachname)}</span>
          </div>
          {/* Right half - open, white bg with golden dashed border visible around cell */}
          <div className="w-1/2 bg-white flex flex-col items-center justify-center p-1">
            <UserPlus className="w-4 h-4" style={{ color: 'hsl(var(--slot-free-text))' }} />
            <span className="text-[10px] mt-0.5" style={{ color: 'hsl(var(--slot-free-text))' }}>+</span>
          </div>
        </div>
      </div>
    );
  }

  // Full or joined half booking
  const isDouble = booking.booking_type === 'double';
  const PlayerIcon = isDouble ? Users : UserCheck;

  return (
    <div className="court-cell court-cell-full overflow-hidden cursor-pointer" onClick={onClick}>
      <div className="h-full flex">
        <div className="w-1/2 flex flex-col items-center justify-center p-1">
          <PlayerIcon className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">{formatInitials(booking.booker_vorname, booking.booker_nachname)}</span>
        </div>
        <div className="w-1/2 flex flex-col items-center justify-center p-1 border-l border-white/20">
          <PlayerIcon className="w-4 h-4" />
          {booking.is_joined && booking.partner_vorname && (
            <span className="text-[10px] font-medium mt-0.5">{formatInitials(booking.partner_vorname || '', booking.partner_nachname || '')}</span>
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
      {formatInitials(booking.booker_vorname, booking.booker_nachname)}
    </div>
  );
}
