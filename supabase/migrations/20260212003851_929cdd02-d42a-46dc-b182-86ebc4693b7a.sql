
-- Unique constraint to prevent double-booking the same court/date/hour
ALTER TABLE public.bookings
ADD CONSTRAINT uq_bookings_court_date_hour
UNIQUE (court_number, date, start_hour);
