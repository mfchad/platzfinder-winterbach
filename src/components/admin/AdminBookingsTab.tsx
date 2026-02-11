import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { de } from "date-fns/locale";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addWeeks, addMonths, addYears, format } from "date-fns";
import type { Booking } from "@/lib/types";
import { formatDateISO } from "@/lib/types";
import { fetchRules, getRuleNum } from "@/lib/booking-rules";
import AdminBookingsGrid from "./AdminBookingsGrid";
import AdminBookingsList from "./AdminBookingsList";

type ViewMode = "grid" | "list";
type TimeScale = "day" | "week" | "month" | "year";

export default function AdminBookingsTab() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [timeScale, setTimeScale] = useState<TimeScale>("day");
  const [date, setDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rules, setRules] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const { startDate, endDate, label } = getRange(date, timeScale);
  const startStr = formatDateISO(startDate);
  const endStr = formatDateISO(endDate);

  const loadRules = useCallback(async () => {
    const r = await fetchRules();
    setRules(r);
  }, []);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date")
      .order("start_hour");
    setBookings((data as Booking[]) || []);
    setLoading(false);
  }, [startStr, endStr]);

  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { loadBookings(); }, [loadBookings]);

  const deleteBooking = async (id: string) => {
    await supabase.from("bookings").delete().eq("id", id);
    loadBookings();
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    await supabase.from("bookings").update(updates).eq("id", id);
    loadBookings();
  };

  const handleDrillDown = useCallback((targetDate: Date, scale: "day" | "week" | "month") => {
    setDate(targetDate);
    setTimeScale(scale);
  }, []);

  const navigate = (dir: -1 | 1) => {
    switch (timeScale) {
      case "day": setDate(d => addDays(d, dir)); break;
      case "week": setDate(d => addWeeks(d, dir)); break;
      case "month": setDate(d => addMonths(d, dir)); break;
      case "year": setDate(d => addYears(d, dir)); break;
    }
  };

  const startHour = getRuleNum(rules, "day_start_hour", 8);
  const endHour = getRuleNum(rules, "day_end_hour", 22);
  const courtsCount = getRuleNum(rules, "courts_count", 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Buchungen verwalten</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time scale */}
          <ToggleGroup type="single" value={timeScale} onValueChange={v => v && setTimeScale(v as TimeScale)} className="border rounded-md">
            <ToggleGroupItem value="day" className="text-xs px-3 h-8">Tag</ToggleGroupItem>
            <ToggleGroupItem value="week" className="text-xs px-3 h-8">Woche</ToggleGroupItem>
            <ToggleGroupItem value="month" className="text-xs px-3 h-8">Monat</ToggleGroupItem>
            <ToggleGroupItem value="year" className="text-xs px-3 h-8">Jahr</ToggleGroupItem>
          </ToggleGroup>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDate(new Date())}>
              Heute
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Calendar className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={date}
                  onSelect={d => d && setDate(d)}
                  locale={de}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date label */}
          <span className="font-display text-base sm:text-lg font-semibold text-foreground">{label}</span>

          {/* View toggle */}
          <div className="ml-auto">
            <ToggleGroup type="single" value={viewMode} onValueChange={v => v && setViewMode(v as ViewMode)} className="border rounded-md">
              <ToggleGroupItem value="grid" className="h-8 w-8 p-0">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" className="h-8 w-8 p-0">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Laden...</div>
        ) : viewMode === "grid" ? (
          <AdminBookingsGrid
            bookings={bookings}
            date={date}
            timeScale={timeScale}
            startHour={startHour}
            endHour={endHour}
            courtsCount={courtsCount}
            onDelete={deleteBooking}
            onUpdate={updateBooking}
            onDrillDown={handleDrillDown}
          />
        ) : (
          <AdminBookingsList
            bookings={bookings}
            onDelete={deleteBooking}
          />
        )}
      </CardContent>
    </Card>
  );
}

function getRange(date: Date, scale: TimeScale): { startDate: Date; endDate: Date; label: string } {
  switch (scale) {
    case "day":
      return {
        startDate: date,
        endDate: date,
        label: format(date, "EEEE, dd.MM.yyyy", { locale: de }),
      };
    case "week": {
      const s = startOfWeek(date, { weekStartsOn: 1 });
      const e = endOfWeek(date, { weekStartsOn: 1 });
      return {
        startDate: s,
        endDate: e,
        label: `KW ${format(date, "w", { locale: de })} — ${format(s, "dd.MM.")} – ${format(e, "dd.MM.yyyy")}`,
      };
    }
    case "month":
      return {
        startDate: startOfMonth(date),
        endDate: endOfMonth(date),
        label: format(date, "MMMM yyyy", { locale: de }),
      };
    case "year":
      return {
        startDate: startOfYear(date),
        endDate: endOfYear(date),
        label: format(date, "yyyy"),
      };
  }
}
