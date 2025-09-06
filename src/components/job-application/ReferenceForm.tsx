import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { Loader2 } from 'lucide-react';

interface ReferenceRequest {
  id: string;
  application_id: string;
  reference_type: string;
  reference_name: string;
  reference_email: string;
  reference_data: any;
  status: string;
  expires_at: string;
}

interface JobApplication {
  id: string;
  personal_info: any;
}

interface ReferenceFormProps {
  token: string;
}

export function ReferenceForm({ token }: ReferenceFormProps) {
  const { toast } = useToast();
  const { companySettings } = useCompany();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [referenceRequest, setReferenceRequest] = useState<ReferenceRequest | null>(null);
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [formData, setFormData] = useState({
    // Referee information
    refereeFullName: '',
    refereeJobTitle: '',
    
    // Employment reference specific
    employmentStatus: '', // current, previous, or neither
    relationshipDescription: '',
    jobTitle: '',
    startDate: '',
    endDate: '',
    attendance: '',
    leavingReason: '',
    
    // Common checkbox qualities
    honestTrustworthy: false,
    communicatesEffectively: false,
    effectiveTeamMember: false,
    respectfulConfidentiality: false,
    reliablePunctual: false,
    suitablePosition: false,
    kindCompassionate: false,
    worksIndependently: false,
    
    // If any qualities not ticked
    qualitiesNotTickedReason: '',
    
    // Criminal/legal questions
    convictionsKnown: '',
    criminalProceedingsKnown: '',
    criminalDetails: '',
    
    // Final comments and signature
    additionalComments: '',
    signatureDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (token) {
      fetchReferenceRequest(token);
    }
  }, [token]);

  const fetchReferenceRequest = async (token: string) => {
    try {
      // Fetch reference request using the token
      const { data: referenceData, error: refError } = await supabase
        .from('reference_requests')
        .select('*')
        .eq('token', token)
        .single();

      if (refError) {
        console.error('Reference request error:', refError);
        toast({
          title: "Invalid Link",
          description: "This reference link is invalid or has expired.",
          variant: "destructive",
        });
        return;
      }

      // Check if the request has expired
      if (new Date(referenceData.expires_at) < new Date()) {
        toast({
          title: "Link Expired",
          description: "This reference link has expired.",
          variant: "destructive",
        });
        return;
      }

      // Check if already completed
      if (referenceData.status === 'completed') {
        setReferenceRequest(referenceData);
        setLoading(false);
        return;
      }

      // Fetch the associated job application with specific fields only
      const { data: applicationData, error: appError } = await supabase
        .from('job_applications')
        .select('id, personal_info')
        .eq('id', referenceData.application_id)
        .maybeSingle();

      if (appError) {
        console.error('Application error:', appError);
        // If we can't fetch the application due to RLS, continue with minimal data
        console.warn('Could not fetch application data, continuing with reference request only');
      }

      setReferenceRequest(referenceData);
      if (applicationData) {
        setApplication(applicationData);
      } else {
        // Create minimal application object with just the ID
        setApplication({ 
          id: referenceData.application_id, 
          personal_info: { fullName: 'Applicant' } 
        });
      }
      
      // Pre-fill form with existing data if available
      setFormData(prev => ({
        ...prev,
        refereeEmail: referenceData.reference_email,
        refereeFullName: referenceData.reference_name
      }));

    } catch (error) {
      console.error('Error fetching reference request:', error);
      toast({
        title: "Error",
        description: "Failed to load reference request.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!referenceRequest) return;

      // Update the reference request with the form data and mark as completed
      const { error: updateError } = await supabase
        .from('reference_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          form_data: formData
        })
        .eq('id', referenceRequest.id);

      if (updateError) throw updateError;

      toast({
        title: "Reference Submitted",
        description: "Thank you for providing your reference. It has been submitted successfully.",
      });

      // Update local state to show completion message
      setReferenceRequest(prev => prev ? { ...prev, status: 'completed' } : null);

    } catch (error) {
      console.error('Error submitting reference:', error);
      toast({
        title: "Error",
        description: "Failed to submit reference. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!referenceRequest || !application) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Reference Not Found</h2>
        <p className="text-muted-foreground">This reference link is invalid or has expired.</p>
      </div>
    );
  }

  if (referenceRequest.status === 'completed') {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Reference Already Submitted</h2>
        <p className="text-muted-foreground">Thank you for providing your reference. It has been successfully submitted.</p>
      </div>
    );
  }

  const applicantName = application.personal_info?.fullName || 'the applicant';
  const isEmployerReference = referenceRequest.reference_type === 'employer';

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <div className="text-center border-b border-border pb-6">
        {companySettings.logo && (
          <div className="flex justify-center mb-4">
            <img 
              src={companySettings.logo} 
              alt={`${companySettings.name} logo`}
              className="h-16 w-auto object-contain"
            />
          </div>
        )}
        <h2 className="text-xl font-semibold text-foreground">{companySettings.name}</h2>
        {companySettings.tagline && (
          <p className="text-sm text-muted-foreground mt-1">{companySettings.tagline}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {isEmployerReference ? 'Employer Reference' : 'Character Reference'} for {applicantName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Reference for:</h4>
              <p><strong>Name:</strong> {applicantName}</p>
              <p><strong>Date of Birth:</strong> {application.personal_info?.dateOfBirth || 'Not provided'}</p>
              <p><strong>Postcode:</strong> {application.personal_info?.postcode || 'Not provided'}</p>
            </div>

            {/* Referee Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="refereeFullName">Referee Name *</Label>
                <Input
                  id="refereeFullName"
                  value={formData.refereeFullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, refereeFullName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="refereeJobTitle">Referee Job Title *</Label>
                <Input
                  id="refereeJobTitle"
                  value={formData.refereeJobTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, refereeJobTitle: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Reference Type Specific Questions */}
            {isEmployerReference ? (
              <>
                <div>
                  <Label className="text-base font-medium">Are you this person's current or previous employer? *</Label>
                  <RadioGroup 
                    value={formData.employmentStatus} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, employmentStatus: value }))}
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="current" id="current" />
                      <Label htmlFor="current">Current</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="previous" id="previous" />
                      <Label htmlFor="previous">Previous</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="neither" id="neither" />
                      <Label htmlFor="neither">Neither</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="relationshipDescription">What is your relationship to this person (e.g. "I am her/his manager")? *</Label>
                  <Input
                    id="relationshipDescription"
                    value={formData.relationshipDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, relationshipDescription: e.target.value }))}
                    placeholder="e.g., I am their direct manager"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="jobTitle">Please state the person's job title *</Label>
                  <Input
                    id="jobTitle"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Employment Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">Employment End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-base font-medium">How would you describe their recent attendance record? *</Label>
                  <RadioGroup 
                    value={formData.attendance} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, attendance: value }))}
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="good" id="att-good" />
                      <Label htmlFor="att-good">Good</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="average" id="att-average" />
                      <Label htmlFor="att-average">Average</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="poor" id="att-poor" />
                      <Label htmlFor="att-poor">Poor</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="leavingReason">Why did the person leave your employment (if they are still employed, please write 'still employed')? *</Label>
                  <Textarea
                    id="leavingReason"
                    value={formData.leavingReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, leavingReason: e.target.value }))}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-base font-medium">Do you know this person from outside employment or education? *</Label>
                  <RadioGroup 
                    value={formData.employmentStatus} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, employmentStatus: value }))}
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="outside-yes" />
                      <Label htmlFor="outside-yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="outside-no" />
                      <Label htmlFor="outside-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="relationshipDescription">Please describe your relationship with this person, including how long you have known them *</Label>
                  <Textarea
                    id="relationshipDescription"
                    value={formData.relationshipDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, relationshipDescription: e.target.value }))}
                    placeholder="Describe how you know them and for how long"
                    required
                  />
                </div>
              </>
            )}

            {/* Common Character Assessment */}
            <div>
              <Label className="text-base font-medium">In your opinion, which of the following describes this person (tick each that is true)? *</Label>
              <div className="mt-3 space-y-3">
                {[
                  { key: 'honestTrustworthy', label: 'Honest and trustworthy' },
                  { key: 'communicatesEffectively', label: 'Communicates effectively' },
                  { key: 'effectiveTeamMember', label: 'An effective team member' },
                  { key: 'respectfulConfidentiality', label: 'Respectful of confidentiality' },
                  { key: 'reliablePunctual', label: 'Reliable and punctual' },
                  { key: 'suitablePosition', label: 'Suitable for the position applied for' },
                  { key: 'kindCompassionate', label: 'Kind and compassionate' },
                  { key: 'worksIndependently', label: 'Able to work well without close supervision' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={item.key}
                      checked={formData[item.key as keyof typeof formData] as boolean}
                      onChange={(e) => setFormData(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={item.key}>{item.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="qualitiesNotTickedReason">If you did not tick one or more of the above, please tell us why here</Label>
              <Textarea
                id="qualitiesNotTickedReason"
                value={formData.qualitiesNotTickedReason}
                onChange={(e) => setFormData(prev => ({ ...prev, qualitiesNotTickedReason: e.target.value }))}
                placeholder="Please explain any concerns"
              />
            </div>

            {/* Criminal Background Questions */}
            <div>
              <Label className="text-base font-medium">
                The position this person has applied for involves working with vulnerable people. Are you aware of any convictions, cautions, reprimands or final warnings that the person may have received that are not 'protected' as defined by the Rehabilitation of Offenders Act 1974 (Exceptions) Order 1975 (as amended in 2013 by SI 210 1198)? *
              </Label>
              <RadioGroup 
                value={formData.convictionsKnown} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, convictionsKnown: value }))}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="convictions-yes" />
                  <Label htmlFor="convictions-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="convictions-no" />
                  <Label htmlFor="convictions-no">No</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-base font-medium">
                To your knowledge, is this person currently the subject of any criminal proceedings (for example, charged or summoned but not yet dealt with) or any police investigation? *
              </Label>
              <RadioGroup 
                value={formData.criminalProceedingsKnown} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, criminalProceedingsKnown: value }))}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="proceedings-yes" />
                  <Label htmlFor="proceedings-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="proceedings-no" />
                  <Label htmlFor="proceedings-no">No</Label>
                </div>
              </RadioGroup>
            </div>

            {(formData.convictionsKnown === 'yes' || formData.criminalProceedingsKnown === 'yes') && (
              <div>
                <Label htmlFor="criminalDetails">If you answered 'yes' to either of the two previous questions, please provide details *</Label>
                <Textarea
                  id="criminalDetails"
                  value={formData.criminalDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, criminalDetails: e.target.value }))}
                  placeholder="Please provide full details"
                  required={formData.convictionsKnown === 'yes' || formData.criminalProceedingsKnown === 'yes'}
                />
              </div>
            )}

            {/* Additional Comments */}
            <div>
              <Label htmlFor="additionalComments">Any additional comments you would like to make about this person</Label>
              <Textarea
                id="additionalComments"
                value={formData.additionalComments}
                onChange={(e) => setFormData(prev => ({ ...prev, additionalComments: e.target.value }))}
                placeholder="Any other relevant information"
              />
            </div>

            {/* Declaration and Signature */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Declaration</h4>
              <p className="text-sm text-muted-foreground mb-4">
                I certify that, to the best of my knowledge, the information I have given is true and complete. I understand that any deliberate omission, falsification or misrepresentation may lead to refusal of appointment or dismissal. I consent to enquiries being made of third parties, which may include previous employers (if applicable), in order to verify the information I have provided.
              </p>
              
              <div>
                <Label htmlFor="signatureDate">Date of completion *</Label>
                <Input
                  id="signatureDate"
                  type="date"
                  value={formData.signatureDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, signatureDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="submit"
                disabled={submitting}
                className="min-w-32"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Reference'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}