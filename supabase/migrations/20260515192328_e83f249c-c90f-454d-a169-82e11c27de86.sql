
-- Add email verification timestamp to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- Verification requests table
CREATE TABLE IF NOT EXISTS public.email_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  proposed_email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_ip text
);

CREATE INDEX IF NOT EXISTS idx_evr_token ON public.email_verification_requests(token);
CREATE INDEX IF NOT EXISTS idx_evr_member ON public.email_verification_requests(member_id);

ALTER TABLE public.email_verification_requests ENABLE ROW LEVEL SECURITY;

-- Only admins can view; edge functions use service role
CREATE POLICY "Admins can view verification requests"
  ON public.email_verification_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Public RPC: stats
CREATE OR REPLACE FUNCTION public.get_email_completion_stats()
RETURNS TABLE(filled bigint, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> '' AND email_verified_at IS NOT NULL) AS filled,
    COUNT(*) AS total
  FROM public.members;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_completion_stats() TO anon, authenticated;

-- Public RPC: lookup member (returns masked email if exists)
CREATE OR REPLACE FUNCTION public.lookup_member_for_email(_vorname text, _nachname text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _m record;
  _masked text;
BEGIN
  SELECT id, email, email_verified_at
  INTO _m
  FROM public.members
  WHERE lower(vorname) = lower(trim(_vorname))
    AND lower(nachname) = lower(trim(_nachname))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF _m.email IS NOT NULL AND _m.email <> '' THEN
    -- mask: first 2 chars + *** + @domain
    _masked := substring(_m.email from 1 for 2) || '***' ||
               substring(_m.email from position('@' in _m.email));
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'has_email', _m.email IS NOT NULL AND _m.email <> '',
    'verified', _m.email_verified_at IS NOT NULL,
    'masked_email', _masked
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_member_for_email(text, text) TO anon, authenticated;

-- Enable realtime for members so banner can update live
ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
