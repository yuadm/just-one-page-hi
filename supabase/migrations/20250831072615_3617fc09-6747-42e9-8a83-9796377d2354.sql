-- Fix client compliance type foreign key constraint issue
-- Create client compliance types that correspond to existing compliance types

INSERT INTO client_compliance_types (id, name, description, frequency, created_at, updated_at)
SELECT 
  id,
  name,
  description,
  frequency,
  created_at,
  updated_at
FROM compliance_types 
WHERE id NOT IN (SELECT id FROM client_compliance_types)
ON CONFLICT (id) DO NOTHING;