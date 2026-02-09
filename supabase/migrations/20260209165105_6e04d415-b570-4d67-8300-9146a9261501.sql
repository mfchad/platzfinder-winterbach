
-- Members table
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  geburtsjahr INTEGER NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
-- Members readable by anyone (for booking verification), writable by admin only
CREATE POLICY "Anyone can read members for verification" ON public.members FOR SELECT USING (true);
CREATE POLICY "Admin can insert members" ON public.members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update members" ON public.members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete members" ON public.members FOR DELETE TO authenticated USING (true);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_number INTEGER NOT NULL CHECK (court_number BETWEEN 1 AND 6),
  date DATE NOT NULL,
  start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('half', 'full', 'double', 'special')),
  -- Initial booker info
  booker_vorname TEXT NOT NULL,
  booker_nachname TEXT NOT NULL,
  booker_geburtsjahr INTEGER NOT NULL,
  booker_email TEXT,
  booker_comment TEXT,
  -- Second person (for joined half-bookings)
  partner_vorname TEXT,
  partner_nachname TEXT,
  partner_geburtsjahr INTEGER,
  partner_comment TEXT,
  -- Double match info
  double_match_names TEXT,
  -- Special booking info (Abo, Gesperrt, etc.)
  special_label TEXT,
  -- Recurrence
  recurrence_type TEXT CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly')),
  recurrence_parent_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  recurrence_end_date DATE,
  -- Status
  is_joined BOOLEAN NOT NULL DEFAULT false,
  created_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- Anyone can read bookings (public display)
CREATE POLICY "Anyone can read bookings" ON public.bookings FOR SELECT USING (true);
-- Anyone can insert bookings (members book without login)
CREATE POLICY "Anyone can insert bookings" ON public.bookings FOR INSERT WITH CHECK (true);
-- Anyone can update bookings (for joining half-bookings)
CREATE POLICY "Anyone can update bookings" ON public.bookings FOR UPDATE USING (true);
-- Anyone can delete bookings (for cancellation after verification)
CREATE POLICY "Anyone can delete bookings" ON public.bookings FOR DELETE USING (true);

-- Booking rules table (admin-configurable)
CREATE TABLE public.booking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  rule_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read rules" ON public.booking_rules FOR SELECT USING (true);
CREATE POLICY "Admin can manage rules" ON public.booking_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default rules
INSERT INTO public.booking_rules (rule_key, rule_value, description) VALUES
  ('booking_window_hours', '24', 'Buchungen nur innerhalb der nächsten X Stunden erlaubt'),
  ('slot_duration_minutes', '60', 'Dauer eines Zeitslots in Minuten'),
  ('day_start_hour', '8', 'Erster buchbarer Slot (Stunde)'),
  ('day_end_hour', '22', 'Letzter Slot endet um diese Stunde'),
  ('core_time_start', '17', 'Kernzeit Beginn (Stunde)'),
  ('core_time_end', '20', 'Kernzeit Ende (Stunde)'),
  ('core_time_days', '1,2,3,4,5', 'Kernzeit Wochentage (1=Mo, 7=So)'),
  ('single_max_per_day', '1', 'Max Stunden Einzel pro Tag in Kernzeit'),
  ('single_max_per_week', '3', 'Max Stunden Einzel pro Woche in Kernzeit'),
  ('double_max_per_day', '2', 'Max Stunden Doppel pro Tag in Kernzeit'),
  ('double_max_per_week', '6', 'Max Stunden Doppel pro Woche in Kernzeit'),
  ('half_booking_min_hours', '12', 'Halbbuchung: mind. X Stunden vor Beginn erstellen'),
  ('half_booking_max_hours', '24', 'Halbbuchung: max. X Stunden vor Beginn erstellen'),
  ('half_booking_expiry_hours', '12', 'Halbbuchung verfällt X Stunden vor Beginn wenn nicht beigetreten'),
  ('email_notifications_enabled', 'false', 'E-Mail-Benachrichtigungen aktiviert'),
  ('courts_count', '6', 'Anzahl der Plätze');
