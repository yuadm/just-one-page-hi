-- Create Client Spot-Check compliance type
INSERT INTO client_compliance_types (name, description, frequency, has_questionnaire) 
VALUES ('Client Spot-Check', 'Service Quality Spot Check for client care assessment', 'quarterly', true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  frequency = EXCLUDED.frequency,
  has_questionnaire = EXCLUDED.has_questionnaire;