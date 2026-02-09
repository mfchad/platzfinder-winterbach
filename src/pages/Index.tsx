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
      .from('bookings')
      .select('*')
      .eq('date', dateStr);
    setBookings((data as Booking[]) || []);
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
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1
            className="font-display text-lg sm:text-2xl font-bold cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => { setDate(new Date()); }}
          >
            Platzbuchung Tennisclub Winterbach e.V. 1973
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin')}
            className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
          >
            <Settings className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Verwaltung</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
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
