-- Check and update the reference_type constraint to allow both 'employer' and 'character'
-- First, let's see what constraints exist
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'reference_requests' AND table_schema = 'public';

-- Update the check constraint to allow both 'employer' and 'character' values
ALTER TABLE public.reference_requests 
DROP CONSTRAINT IF EXISTS reference_requests_reference_type_check;

ALTER TABLE public.reference_requests 
ADD CONSTRAINT reference_requests_reference_type_check 
CHECK (reference_type IN ('employer', 'character'));