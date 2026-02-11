export interface Booking {
  id: string;
  court_number: number;
  date: string;
  start_hour: number;
  booking_type: 'half' | 'full' | 'double' | 'special';
  booker_vorname: string;
  booker_nachname: string;
  booker_geburtsjahr: number;
  booker_email?: string;
  booker_comment?: string;
  partner_vorname?: string;
  partner_nachname?: string;
  partner_geburtsjahr?: number;
  partner_comment?: string;
  double_match_names?: string;
  special_label?: string;
  recurrence_type?: string;
  recurrence_parent_id?: string;
  recurrence_end_date?: string;
  is_joined: boolean;
  created_by_admin: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  vorname: string;
  nachname: string;
  geburtsjahr: number;
  email?: string;
  created_at: string;
}

export interface BookingRule {
  id: string;
  rule_key: string;
  rule_value: string;
  description?: string;
  updated_at: string;
}

export type BookingSlot = {
  hour: number;
  court: number;
  booking?: Booking;
  isPast: boolean;
};

export function anonymizeName(name: string): string {
  if (!name || name.length === 0) return '****';
  return name.charAt(0).toUpperCase() + '***';
}

export function formatGermanDate(date: Date): string {
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  return `${days[date.getDay()]}, ${String(date.getDate()).padStart(2, '0')}.${months[date.getMonth()]}.${date.getFullYear()}`;
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
