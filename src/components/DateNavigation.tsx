import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { formatGermanDate } from "@/lib/types";
import { de } from "date-fns/locale";

interface DateNavigationProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

export default function DateNavigation({ date, onDateChange }: DateNavigationProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const goLeft = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    onDateChange(d);
  };
  const goRight = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    onDateChange(d);
  };
  const goToday = () => onDateChange(new Date());

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <span className="font-display text-lg sm:text-xl font-semibold text-foreground">
        {formatGermanDate(date)}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={goLeft} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs">
          Heute
        </Button>
        <Button variant="outline" size="icon" onClick={goRight} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Calendar className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker
              mode="single"
              selected={date}
              onSelect={(d) => { if (d) { onDateChange(d); setCalendarOpen(false); } }}
              locale={de}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
