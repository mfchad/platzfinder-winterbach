import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BookingGrid from "@/components/BookingGrid";
import DateNavigation from "@/components/DateNavigation";
import Legend from "@/components/Legend";
import NewBookingDialog from "@/components/NewBookingDialog";
import ExistingBookingDialog from "@/components/ExistingBookingDialog";
import { fetchRules, getRuleNum, clearRulesCache } from "@/lib/booking-rules";
import type { Booking } from "@/lib/types";
import { formatDateISO } from "@/lib/types";
import clubBadge from "@/assets/Wappen_TCW.png";

export default function Index() {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rules, setRules] = useState<Record<string, string>>({});
  const [newBooking, setNewBooking] = useState<{ court: number; hour: number } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const dateStr = formatDateISO(date);
  const startHour = getRuleNum(rules, 'day_start_hour', 8);
  const endHour = getRuleNum(rules, 'day_end_hour', 22);
  const courtsCount = getRuleNum(rules, 'courts_count', 6);

  const loadBookings = useCallback(async () => {
    const { data } = await supabase
      .from('bookings_public' as any)
      .select('*')
      .eq('date', dateStr);
    setBookings((data as unknown as Booking[]) || []);
  }, [dateStr]);

  const loadRules = useCallback(async () => {
    clearRulesCache();
    const r = await fetchRules();
    setRules(r);
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleSlotClick = (court: number, hour: number, booking?: Booking) => {
    if (booking) {
      setSelectedBooking(booking);
    } else {
      setNewBooking({ court, hour });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with navy gradient */}
      <header className="relative shadow-lg">
        <div
          style={{
            background: 'linear-gradient(135deg, hsl(var(--club-navy)) 0%, hsl(var(--club-badge-blue)) 55%, hsl(var(--club-royal)) 100%)',
          }}
        >
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Badge with conic gold ring + enhanced glow */}
              <div
                className="flex-shrink-0 rounded-full p-[3px]"
                style={{
                  width: 52,
                  height: 52,
                  background: 'conic-gradient(hsl(var(--club-gold-stripe)) 0deg, hsl(var(--club-gold)) 90deg, hsl(var(--club-gold-stripe)) 180deg, hsl(var(--club-gold)) 270deg, hsl(var(--club-gold-stripe)) 360deg)',
                  boxShadow: '0 0 18px 4px hsla(52, 100%, 48%, 0.45), 0 3px 12px rgba(0,0,0,0.35)',
                }}
              >
                <div
                  className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                  style={{ background: 'hsl(var(--club-navy))' }}
                >
                  <img
                    src={clubBadge}
                    alt="TC Winterbach Wappen"
                    className="w-[110%] h-[110%] object-cover"
                    style={{ margin: '-5%' }}
                  />
                </div>
              </div>
              <h1
                className="font-display text-base sm:text-xl lg:text-2xl font-bold text-white cursor-pointer transition-colors hover:text-yellow-300"
                onClick={() => { setDate(new Date()); }}
              >
                Platzbuchung TC Winterbach
              </h1>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/admin')}
              className="bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-sm"
            >
              <Settings className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Verwaltung</span>
            </Button>
          </div>
        </div>
        {/* Metallic gold gradient stripe */}
        <div
          className="h-[3px]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, hsl(var(--club-gold-stripe)) 20%, hsl(var(--club-gold-stripe)) 80%, transparent 100%)',
          }}
        />
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-3 space-y-3">
        <DateNavigation date={date} onDateChange={setDate} />
        
        <BookingGrid
          date={dateStr}
          bookings={bookings}
          startHour={startHour}
          endHour={endHour}
          courtsCount={courtsCount}
          onSlotClick={handleSlotClick}
        />

        <Legend />
      </main>

      {/* Dialogs */}
      {newBooking && (
        <NewBookingDialog
          open={!!newBooking}
          onClose={() => setNewBooking(null)}
          court={newBooking.court}
          hour={newBooking.hour}
          date={dateStr}
          rules={rules}
          onSuccess={loadBookings}
        />
      )}
      {selectedBooking && (
        <ExistingBookingDialog
          open={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          booking={selectedBooking}
          onSuccess={loadBookings}
        />
      )}
    </div>
  );
}
