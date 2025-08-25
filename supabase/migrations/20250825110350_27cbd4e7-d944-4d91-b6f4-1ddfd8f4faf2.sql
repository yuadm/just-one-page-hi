-- Add RLS policies for reference_requests table (only missing ones)
ALTER TABLE reference_requests ENABLE ROW LEVEL SECURITY;

-- Only create policies that don't exist
CREATE POLICY IF NOT EXISTS "Allow public read access by token" ON reference_requests
FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Allow public insert access" ON reference_requests
FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow public update access" ON reference_requests
FOR UPDATE USING (true) WITH CHECK (true);