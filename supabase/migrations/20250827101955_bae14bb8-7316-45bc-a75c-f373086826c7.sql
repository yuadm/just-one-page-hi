
-- 1) Ensure tokens are unique (safe if it already exists)
CREATE UNIQUE INDEX IF NOT EXISTS reference_requests_token_unique
ON public.reference_requests (token);

-- 2) Function to safely fetch a reference request by token for public use
CREATE OR REPLACE FUNCTION public.reference_requests_get_by_token(p_token uuid)
RETURNS TABLE (
  id uuid,
  reference_type text,
  reference_name text,
  reference_email text,
  status text,
  expires_at timestamptz,
  is_expired boolean,
  application_id uuid,
  applicant_name text,
  applicant_dob text,
  applicant_postcode text,
  position_applied_for text,
  reference_company text,
  reference_address text,
  company_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rr.id,
    rr.reference_type,
    rr.reference_name,
    rr.reference_email,
    rr.status,
    rr.expires_at,
    COALESCE(rr.is_expired, false),
    rr.application_id,
    rr.applicant_name,
    ja.personal_info->>'dateOfBirth' AS applicant_dob,
    rr.applicant_postcode,
    rr.position_applied_for,
    rr.reference_company,
    rr.reference_address,
    rr.company_name
  FROM public.reference_requests rr
  JOIN public.job_applications ja
    ON ja.id = rr.application_id
  WHERE rr.token = p_token
    AND COALESCE(rr.is_expired, false) = false
    AND rr.status <> 'completed'
    AND rr.expires_at > now()
  LIMIT 1;
END;
$$;

-- 3) Function to submit a reference and immediately invalidate the link
CREATE OR REPLACE FUNCTION public.reference_requests_submit(
  p_token uuid,
  p_form_data jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT rr.id
  INTO v_id
  FROM public.reference_requests rr
  WHERE rr.token = p_token
    AND COALESCE(rr.is_expired, false) = false
    AND rr.status <> 'completed'
    AND rr.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.reference_requests
  SET
    form_data = p_form_data,
    status = 'completed',
    submitted_at = now(),
    completed_at = now(),
    is_expired = true,
    updated_at = now()
  WHERE id = v_id;

  RETURN true;
END;
$$;

-- 4) Allow public and authenticated users to execute these two functions
GRANT EXECUTE ON FUNCTION public.reference_requests_get_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reference_requests_submit(uuid, jsonb) TO anon, authenticated;
