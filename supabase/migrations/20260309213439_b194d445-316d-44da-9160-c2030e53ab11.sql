
CREATE OR REPLACE FUNCTION public.validate_booking_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _booking_window_hours int;
  _half_min_hours int;
  _half_max_hours int;
  _slot_time timestamptz;
  _now timestamptz;
  _diff_hours numeric;
  _diff_minutes numeric;
BEGIN
  -- Admin-created bookings bypass all window checks
  IF NEW.created_by_admin = true THEN
    RETURN NEW;
  END IF;

  -- Calculate slot time in Europe/Berlin timezone
  _slot_time := (NEW.date || 'T' || lpad(NEW.start_hour::text, 2, '0') || ':00:00')::timestamp AT TIME ZONE 'Europe/Berlin';
  _now := now();
  _diff_hours := EXTRACT(EPOCH FROM (_slot_time - _now)) / 3600.0;
  _diff_minutes := EXTRACT(EPOCH FROM (_slot_time - _now)) / 60.0;

  -- Grace period: allow booking current hour slot if within first 45 minutes
  IF _diff_minutes < -45 THEN
    RAISE EXCEPTION 'Buchungen für die aktuelle Stunde sind nur bis zur 45. Minute möglich.';
  END IF;
  
  IF _diff_minutes <= 0 AND _diff_minutes >= -45 THEN
    RETURN NEW;
  END IF;

  -- Fetch rules
  SELECT COALESCE(
    (SELECT rule_value::int FROM booking_rules WHERE rule_key = 'booking_window_hours'), 24
  ) INTO _booking_window_hours;

  IF NEW.booking_type = 'half' THEN
    SELECT COALESCE(
      (SELECT rule_value::int FROM booking_rules WHERE rule_key = 'half_booking_min_hours'), 8
    ) INTO _half_min_hours;

    SELECT COALESCE(
      (SELECT rule_value::int FROM booking_rules WHERE rule_key = 'half_booking_max_hours'), 24
    ) INTO _half_max_hours;

    IF _diff_hours < _half_min_hours OR _diff_hours > _half_max_hours THEN
      RAISE EXCEPTION 'Halbbuchungen sind nur zwischen % und % Stunden vor Spielbeginn möglich.', _half_min_hours, _half_max_hours;
    END IF;
  ELSE
    IF _diff_hours > _booking_window_hours THEN
      RAISE EXCEPTION 'Buchungen sind nur innerhalb von % Stunden im Voraus möglich.', _booking_window_hours;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
