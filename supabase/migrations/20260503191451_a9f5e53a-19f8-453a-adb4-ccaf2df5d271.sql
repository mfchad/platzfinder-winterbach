
-- Insert new rules (idempotent)
INSERT INTO public.booking_rules (rule_key, rule_value, description)
VALUES
  ('booking_window_hours_single', COALESCE((SELECT rule_value FROM public.booking_rules WHERE rule_key = 'booking_window_hours'), '24'), 'Buchungsvorlauf für Einzel in Stunden'),
  ('booking_window_hours_double', '25', 'Buchungsvorlauf für Doppel in Stunden')
ON CONFLICT (rule_key) DO NOTHING;

-- Update validation trigger to differentiate between single and double
CREATE OR REPLACE FUNCTION public.validate_booking_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _booking_window_single int;
  _booking_window_double int;
  _booking_window_effective int;
  _half_min_hours int;
  _half_max_hours int;
  _slot_time timestamptz;
  _now timestamptz;
  _diff_hours numeric;
  _diff_minutes numeric;
BEGIN
  IF NEW.created_by_admin = true THEN
    RETURN NEW;
  END IF;

  _slot_time := (NEW.date || 'T' || lpad(NEW.start_hour::text, 2, '0') || ':00:00')::timestamp AT TIME ZONE 'Europe/Berlin';
  _now := now();
  _diff_hours := EXTRACT(EPOCH FROM (_slot_time - _now)) / 3600.0;
  _diff_minutes := EXTRACT(EPOCH FROM (_slot_time - _now)) / 60.0;

  IF _diff_minutes < -45 THEN
    RAISE EXCEPTION 'Buchungen für die aktuelle Stunde sind nur bis zur 45. Minute möglich.';
  END IF;

  IF _diff_minutes <= 0 AND _diff_minutes >= -45 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE((SELECT rule_value::int FROM booking_rules WHERE rule_key = 'booking_window_hours_single'),
                  (SELECT rule_value::int FROM booking_rules WHERE rule_key = 'booking_window_hours'),
                  24) INTO _booking_window_single;
  SELECT COALESCE((SELECT rule_value::int FROM booking_rules WHERE rule_key = 'booking_window_hours_double'),
                  25) INTO _booking_window_double;

  IF NEW.booking_type = 'half' THEN
    SELECT COALESCE((SELECT rule_value::int FROM booking_rules WHERE rule_key = 'half_booking_min_hours'), 8) INTO _half_min_hours;
    SELECT COALESCE((SELECT rule_value::int FROM booking_rules WHERE rule_key = 'half_booking_max_hours'), 24) INTO _half_max_hours;

    IF _diff_hours < _half_min_hours OR _diff_hours > _half_max_hours THEN
      RAISE EXCEPTION 'Halbbuchungen sind nur zwischen % und % Stunden vor Spielbeginn möglich.', _half_min_hours, _half_max_hours;
    END IF;
  ELSE
    IF NEW.booking_type = 'double' THEN
      _booking_window_effective := _booking_window_double;
    ELSE
      _booking_window_effective := _booking_window_single;
    END IF;

    IF _diff_hours > _booking_window_effective THEN
      IF NEW.booking_type = 'double' THEN
        RAISE EXCEPTION 'Doppelbuchungen sind nur innerhalb von % Stunden im Voraus möglich.', _booking_window_effective;
      ELSE
        RAISE EXCEPTION 'Einzelbuchungen sind erst % Stunden im Voraus möglich. Doppelbuchungen sind ggf. bereits jetzt möglich!', _booking_window_effective;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
