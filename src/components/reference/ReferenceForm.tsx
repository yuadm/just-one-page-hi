import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle } from 'lucide-react';

interface ReferenceFormProps {
  token: string;
}

interface ReferenceRequest {
  id: string;
  applicant_name: string;
  position_applied_for: string;
  reference_type: 'employer' | 'character';
  reference_name: string;
  reference_company?: string;
  company_name: string;
}

export function ReferenceForm({ token }: ReferenceFormProps) {
  const [referenceRequest, setReferenceRequest] = useState<ReferenceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const { toast } = useToast();

  useEffect(() => {
    const fetchReferenceRequest = async () => {
      try {
        const response = await fetch(`https://vfzyodedgtefvxcrqdtc.supabase.co/functions/v1/get-reference-request?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json();
        const error = response.ok ? null : data;

        if (error) throw error;

        if (data?.expired) {
          toast({
            title: "Link Expired",
            description: data.error || "This reference link has expired or been used",
            variant: "destructive",
          });
          return;
        }

        if (data?.success && data?.referenceRequest) {
          setReferenceRequest(data.referenceRequest);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error: any) {
        console.error('Error fetching reference request:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to load reference request",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchReferenceRequest();
    } else {
      setLoading(false);
    }
  }, [token, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('submit-reference', {
        body: {
          token,
          formData
        }
      });

      if (error) throw error;

      if (data?.success) {
        setSubmitted(true);
        toast({
          title: "Reference Submitted",
          description: "Thank you for providing the reference. This link is now expired.",
        });
      } else {
        throw new Error(data?.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      console.error('Error submitting reference:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit reference",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="text-center p-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-green-700 mb-2">Reference Submitted!</h2>
        <p className="text-muted-foreground">
          Thank you for taking the time to provide this reference. Your input is valuable and appreciated.
        </p>
      </div>
    );
  }

  if (!referenceRequest) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">
          Unable to load reference request. Please check your link or contact the requesting organization.
        </p>
      </div>
    );
  }

  const isEmployerReference = referenceRequest.reference_type === 'employer';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {isEmployerReference ? 'Employer Reference' : 'Character Reference'} for {referenceRequest.applicant_name}
          </CardTitle>
          <p className="text-muted-foreground">
            {referenceRequest.applicant_name} has applied for the position of {referenceRequest.position_applied_for} at {referenceRequest.company_name}.
            Please provide your honest assessment to help them with their application.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Your Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="refereeJob">Your Job Title</Label>
                  <Input
                    id="refereeJob"
                    value={formData.refereeJob || ''}
                    onChange={(e) => updateFormData('refereeJob', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="refereeDepartment">Department/Organization</Label>
                  <Input
                    id="refereeDepartment"
                    value={formData.refereeDepartment || ''}
                    onChange={(e) => updateFormData('refereeDepartment', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Relationship Questions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Relationship with Applicant</h3>
              
              <div>
                <Label htmlFor="relationshipNature">How do you know {referenceRequest.applicant_name}?</Label>
                <Textarea
                  id="relationshipNature"
                  value={formData.relationshipNature || ''}
                  onChange={(e) => updateFormData('relationshipNature', e.target.value)}
                  placeholder="Please describe your relationship (e.g., direct supervisor, colleague, mentor, etc.)"
                  required
                />
              </div>

              <div>
                <Label htmlFor="relationshipDuration">How long have you known them?</Label>
                <Input
                  id="relationshipDuration"
                  value={formData.relationshipDuration || ''}
                  onChange={(e) => updateFormData('relationshipDuration', e.target.value)}
                  placeholder="e.g., 2 years, 6 months"
                  required
                />
              </div>
            </div>

            {/* Assessment Questions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Assessment</h3>
              
              {isEmployerReference ? (
                <>
                  <div>
                    <Label htmlFor="workPerformance">How would you rate their work performance?</Label>
                    <RadioGroup
                      value={formData.workPerformance || ''}
                      onValueChange={(value) => updateFormData('workPerformance', value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="excellent" id="perf-excellent" />
                        <Label htmlFor="perf-excellent">Excellent</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="good" id="perf-good" />
                        <Label htmlFor="perf-good">Good</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="satisfactory" id="perf-satisfactory" />
                        <Label htmlFor="perf-satisfactory">Satisfactory</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="needs-improvement" id="perf-needs" />
                        <Label htmlFor="perf-needs">Needs Improvement</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="reliability">How would you rate their reliability and punctuality?</Label>
                    <RadioGroup
                      value={formData.reliability || ''}
                      onValueChange={(value) => updateFormData('reliability', value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="excellent" id="rel-excellent" />
                        <Label htmlFor="rel-excellent">Excellent</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="good" id="rel-good" />
                        <Label htmlFor="rel-good">Good</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="satisfactory" id="rel-satisfactory" />
                        <Label htmlFor="rel-satisfactory">Satisfactory</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="needs-improvement" id="rel-needs" />
                        <Label htmlFor="rel-needs">Needs Improvement</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="teamwork">How well do they work with others?</Label>
                    <RadioGroup
                      value={formData.teamwork || ''}
                      onValueChange={(value) => updateFormData('teamwork', value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="excellent" id="team-excellent" />
                        <Label htmlFor="team-excellent">Excellent team player</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="good" id="team-good" />
                        <Label htmlFor="team-good">Works well with others</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="satisfactory" id="team-satisfactory" />
                        <Label htmlFor="team-satisfactory">Adequate team member</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="needs-improvement" id="team-needs" />
                        <Label htmlFor="team-needs">Has difficulty working with others</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label>Would you rehire this person?</Label>
                    <RadioGroup
                      value={formData.wouldRehire || ''}
                      onValueChange={(value) => updateFormData('wouldRehire', value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="rehire-yes" />
                        <Label htmlFor="rehire-yes">Yes, definitely</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="probably" id="rehire-probably" />
                        <Label htmlFor="rehire-probably">Probably</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unsure" id="rehire-unsure" />
                        <Label htmlFor="rehire-unsure">Unsure</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="rehire-no" />
                        <Label htmlFor="rehire-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="character">How would you rate their character and integrity?</Label>
                    <RadioGroup
                      value={formData.character || ''}
                      onValueChange={(value) => updateFormData('character', value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="excellent" id="char-excellent" />
                        <Label htmlFor="char-excellent">Excellent</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="good" id="char-good" />
                        <Label htmlFor="char-good">Good</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="satisfactory" id="char-satisfactory" />
                        <Label htmlFor="char-satisfactory">Satisfactory</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="concerns" id="char-concerns" />
                        <Label htmlFor="char-concerns">Have some concerns</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="reliability">How would you rate their reliability and trustworthiness?</Label>
                    <RadioGroup
                      value={formData.reliability || ''}
                      onValueChange={(value) => updateFormData('reliability', value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="excellent" id="trust-excellent" />
                        <Label htmlFor="trust-excellent">Highly reliable and trustworthy</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="good" id="trust-good" />
                        <Label htmlFor="trust-good">Generally reliable</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="satisfactory" id="trust-satisfactory" />
                        <Label htmlFor="trust-satisfactory">Adequately reliable</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="concerns" id="trust-concerns" />
                        <Label htmlFor="trust-concerns">Have reliability concerns</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="strengths">{isEmployerReference ? 'Key strengths in the workplace' : 'Personal strengths and qualities'}</Label>
                <Textarea
                  id="strengths"
                  value={formData.strengths || ''}
                  onChange={(e) => updateFormData('strengths', e.target.value)}
                  placeholder="Please describe their main strengths..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="recommendation">Would you recommend them for this position?</Label>
                <RadioGroup
                  value={formData.recommendation || ''}
                  onValueChange={(value) => updateFormData('recommendation', value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="highly-recommend" id="rec-highly" />
                    <Label htmlFor="rec-highly">Highly recommend</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="recommend" id="rec-recommend" />
                    <Label htmlFor="rec-recommend">Recommend</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="recommend-with-reservations" id="rec-reservations" />
                    <Label htmlFor="rec-reservations">Recommend with reservations</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="do-not-recommend" id="rec-no" />
                    <Label htmlFor="rec-no">Do not recommend</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="additionalComments">Additional comments (optional)</Label>
                <Textarea
                  id="additionalComments"
                  value={formData.additionalComments || ''}
                  onChange={(e) => updateFormData('additionalComments', e.target.value)}
                  placeholder="Any additional information you'd like to share..."
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}