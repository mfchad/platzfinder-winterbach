import { supabase } from "@/integrations/supabase/client";
import { getRuleNum, getRule } from "./booking-rules";
import type { Booking } from "./types";

export async function verifyMember(vorname: string, nachname: string, geburtsjahr: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_member', {
    _vorname: vorname,
    _nachname: nachname,
    _geburtsjahr: geburtsjahr,
  });
  if (error) {
    console.error('verify_member error:', error);
    return false;
  }
  return data === true;
}

export function isWithinBookingWindow(date: string, hour: number, rules: Record<string, string>): boolean {
  const windowHours = getRuleNum(rules, 'booking_window_hours', 24);
  // Build slot time as local time (matching Europe/Berlin context)
  const slotTime = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
  const now = new Date();
  const diffMs = slotTime.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  // Slot must be in the future and within the booking window
  return diffHours > 0 && diffHours <= windowHours;
}

export function isHalfBookingAllowed(date: string, hour: number, rules: Record<string, string>): boolean {
  const minHours = getRuleNum(rules, 'half_booking_min_hours', 12);
  const maxHours = getRuleNum(rules, 'half_booking_max_hours', 24);
  const slotTime = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
  const now = new Date();
  const diffMs = slotTime.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= minHours && diffHours <= maxHours;
}

export function isCoreTime(date: string, hour: number, rules: Record<string, string>): boolean {
  const coreStart = getRuleNum(rules, 'core_time_start', 17);
  const coreEnd = getRuleNum(rules, 'core_time_end', 20);
  const coreDaysStr = getRule(rules, 'core_time_days', '1,2,3,4,5');
  const coreDays = coreDaysStr.split(',').map(d => parseInt(d.trim(), 10));
  const d = new Date(date);
  const jsDay = d.getDay(); // 0=Sun
  const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Mon
  return coreDays.includes(isoDay) && hour >= coreStart && hour < coreEnd;
}

export async function checkCoreTimeLimits(
  vorname: string, nachname: string, geburtsjahr: number,
  date: string, bookingType: 'half' | 'full' | 'double',
  rules: Record<string, string>
): Promise<string | null> {
  // Get week bounds (Mon-Sun)
  const d = new Date(date);
  const jsDay = d.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = monday.toISOString().split('T')[0];
  const sundayStr = sunday.toISOString().split('T')[0];

  const { data: weekBookings } = await supabase
    .from('bookings')
    .select('*')
    .ilike('booker_vorname', vorname.trim())
    .ilike('booker_nachname', nachname.trim())
    .eq('booker_geburtsjahr', geburtsjahr)
    .gte('date', mondayStr)
    .lte('date', sundayStr)
    .neq('booking_type', 'special');

  const bookings = (weekBookings || []) as Booking[];
  
  // Filter to only core-time bookings
  const coreBookings = bookings.filter(b => isCoreTime(b.date, b.start_hour, rules));
  const todayCore = coreBookings.filter(b => b.date === date);

  // Check limits separately for singles (full/half) and doubles
  const isDouble = bookingType === 'double';

  if (isDouble) {
    const maxDayDouble = getRuleNum(rules, 'double_max_per_day', 2);
    const maxWeekDouble = getRuleNum(rules, 'double_max_per_week', 6);
    const todayDoubles = todayCore.filter(b => b.booking_type === 'double').length;
    const weekDoubles = coreBookings.filter(b => b.booking_type === 'double').length;

    if (todayDoubles >= maxDayDouble) {
      return `Sie haben Ihr tägliches Kernzeit-Limit für Doppel erreicht (max. ${maxDayDouble} Std./Tag).`;
    }
    if (weekDoubles >= maxWeekDouble) {
      return `Sie haben Ihr wöchentliches Kernzeit-Limit für Doppel erreicht (max. ${maxWeekDouble} Std./Woche).`;
    }
  } else {
    const maxDaySingle = getRuleNum(rules, 'single_max_per_day', 1);
    const maxWeekSingle = getRuleNum(rules, 'single_max_per_week', 3);
    const todaySingles = todayCore.filter(b => b.booking_type !== 'double').length;
    const weekSingles = coreBookings.filter(b => b.booking_type !== 'double').length;

    if (todaySingles >= maxDaySingle) {
      return `Sie haben Ihr tägliches Kernzeit-Limit für Einzel erreicht (max. ${maxDaySingle} Std./Tag).`;
    }
    if (weekSingles >= maxWeekSingle) {
      return `Sie haben Ihr wöchentliches Kernzeit-Limit für Einzel erreicht (max. ${maxWeekSingle} Std./Woche).`;
    }
  }

  return null;
}
