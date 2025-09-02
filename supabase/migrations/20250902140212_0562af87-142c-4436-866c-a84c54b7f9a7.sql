-- Add target_table column to compliance_types table
ALTER TABLE public.compliance_types 
ADD COLUMN target_table TEXT NOT NULL DEFAULT 'employees' 
CHECK (target_table IN ('employees', 'clients'));

-- Update existing compliance_types to be for employees
UPDATE public.compliance_types SET target_table = 'employees';

-- Migrate existing client_compliance_types into main compliance_types table
INSERT INTO public.compliance_types (
  name, 
  description, 
  frequency, 
  has_questionnaire, 
  questionnaire_id, 
  target_table,
  created_at,
  updated_at
)
SELECT 
  name,
  description,
  frequency,
  has_questionnaire,
  questionnaire_id,
  'clients' as target_table,
  created_at,
  updated_at
FROM public.client_compliance_types
ON CONFLICT DO NOTHING;

-- Add comment to document the new column
COMMENT ON COLUMN public.compliance_types.target_table IS 'Specifies whether this compliance type applies to employees or clients';