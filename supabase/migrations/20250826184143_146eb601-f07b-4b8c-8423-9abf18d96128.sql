-- Add RLS policies for the reference_requests table
-- Admins can manage all reference requests
CREATE POLICY "Admins can manage reference requests" 
ON public.reference_requests 
FOR ALL 
TO authenticated
USING (is_admin_user())
WITH CHECK (is_admin_user());

-- Allow public insert for the reference portal to submit responses
CREATE POLICY "Allow public access for reference portal" 
ON public.reference_requests 
FOR ALL 
TO anon
USING (true)
WITH CHECK (true);