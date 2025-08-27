import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { generateReferencePDF, generateManualReferencePDF } from '@/lib/reference-pdf';

interface ReferenceButtonsProps {
  application: any;
  references: any;
  onUpdate?: () => void;
}

export function ReferenceButtons({ application, references, onUpdate }: ReferenceButtonsProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState<string | null>(null);
  const [completedReferences, setCompletedReferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompletedReferences();
  }, [application.id]);

  const fetchCompletedReferences = async () => {
    try {
      const { data, error } = await supabase
        .from('reference_requests')
        .select('*')
        .eq('application_id', application.id)
        .eq('status', 'completed');

      if (error) throw error;
      setCompletedReferences(data || []);
    } catch (error) {
      console.error('Error fetching completed references:', error);
    } finally {
      setLoading(false);
    }
  };

  // Count employers to determine reference types
  const countEmployers = (application: any) => {
    let count = 0;
    const employmentHistory = application.employment_history;
    
    if (!employmentHistory) return 0;
    
    // Count recent employer if present
    if (employmentHistory.recentEmployer?.company?.trim() || employmentHistory.recentEmployer?.name?.trim()) {
      count += 1;
    }
    
    // Count previous employers
    if (employmentHistory.previousEmployers?.length) {
      count += employmentHistory.previousEmployers.filter((emp: any) => 
        emp.company?.trim() || emp.name?.trim()
      ).length;
    }
    
    return count;
  };

  // Determine reference type for specific reference
  const referenceTypeForKey = (application: any, referenceKey: 'reference1' | 'reference2') => {
    const employerCount = countEmployers(application);
    
    if (employerCount >= 2) {
      return 'employer';
    } else if (employerCount === 1) {
      return referenceKey === 'reference1' ? 'employer' : 'character';
    } else {
      return 'character';
    }
  };

  const sendReferenceEmail = async (referenceKey: string, reference: any) => {
    setSending(referenceKey);
    
    try {
      const referenceType = referenceTypeForKey(application, referenceKey as 'reference1' | 'reference2');
      const personalInfo = application.personal_info || {};
      
      const emailData = {
        applicationId: application.id,
        applicantName: personalInfo.fullName || 'Unknown Applicant',
        applicantFirstName: personalInfo.fullName?.split(' ')[0] || 'Applicant',
        applicantAddress: `${personalInfo.streetAddress || ''}, ${personalInfo.town || ''}`,
        applicantPostcode: personalInfo.postcode || '',
        positionAppliedFor: personalInfo.positionAppliedFor || 'Support Worker',
        referenceEmail: reference.email,
        referenceName: reference.name,
        referenceCompany: reference.company,
        referenceAddress: `${reference.address || ''}, ${reference.town || ''}`,
        companyName: 'Your Company',
        referenceType: referenceType,
        employmentDetails: application.employment_history?.recentEmployer
      };

      const { error } = await supabase.functions.invoke('send-reference-email', {
        body: emailData
      });

      if (error) throw error;

      toast({
        title: "Reference Email Sent",
        description: `Reference request sent to ${reference.name} (${reference.email})`,
      });

      onUpdate?.();
    } catch (error) {
      console.error('Error sending reference email:', error);
      toast({
        title: "Error",
        description: "Failed to send reference email",
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  };

  const downloadCompletedReference = (completedRef: any) => {
    try {
      const applicantName = application.personal_info?.fullName || 'Unknown Applicant';
      const applicantDOB = application.personal_info?.dateOfBirth || 'Not provided';
      const applicantPostcode = application.personal_info?.postcode || 'Not provided';
      const pdf = generateReferencePDF(completedRef, applicantName, applicantDOB, applicantPostcode);
      
      const fileName = `reference-${completedRef.reference_name.replace(/\s+/g, '-')}-${applicantName.replace(/\s+/g, '-')}.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "Reference Downloaded",
        description: `Downloaded reference from ${completedRef.reference_name}`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const getCompletedReferenceForEmail = (email: string) => {
    return completedReferences.find(ref => ref.reference_email === email);
  };

  const generateBlankPDF = (referenceKey: string, reference: any) => {
    try {
      const personalInfo = application.personal_info || {};
      const applicantName = personalInfo.fullName || 'Unknown Applicant';
      const refType = referenceTypeForKey(application, referenceKey as 'reference1' | 'reference2');

      const pdf = generateManualReferencePDF({
        applicantName,
        applicantPosition: personalInfo.positionAppliedFor,
        referenceType: refType,
        referee: {
          name: reference.name,
          company: reference.company,
          jobTitle: reference.jobTitle,
          email: reference.email,
          phone: reference.contactNumber,
          address: reference.address,
          town: reference.town,
          postcode: reference.postcode,
        },
      });

      const fileName = `manual-reference-${reference.name?.replace(/\s+/g, '-') || referenceKey}-${applicantName.replace(/\s+/g, '-')}.pdf`;
      pdf.save(fileName);

      toast({
        title: 'Manual PDF Generated',
        description: `Blank reference form for ${reference.name || referenceKey} downloaded`,
      });
    } catch (error) {
      console.error('Error generating manual reference PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate manual reference PDF',
        variant: 'destructive',
      });
    }
  };
  if (!references) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <h4 className="font-medium">Reference Actions</h4>
        <div className="flex justify-center p-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Reference Actions</h4>
      
      {/* Reference 1 */}
      {references.reference1 && (() => {
        const completedRef = getCompletedReferenceForEmail(references.reference1.email);
        return (
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="font-medium">{references.reference1.name}</div>
                {completedRef && <CheckCircle2 className="w-4 h-4 text-green-600" />}
              </div>
              <div className="text-sm text-muted-foreground">{references.reference1.company}</div>
              <div className="text-sm text-muted-foreground">{references.reference1.email}</div>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">
                  {referenceTypeForKey(application, 'reference1') === 'employer' ? 'Employer Reference' : 'Character Reference'}
                </Badge>
                {completedRef && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Completed on {new Date(completedRef.completed_at).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {completedRef ? (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => downloadCompletedReference(completedRef)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateBlankPDF('reference1', references.reference1)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Manual PDF
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => sendReferenceEmail('reference1', references.reference1)}
                    disabled={sending === 'reference1'}
                  >
                    {sending === 'reference1' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1" />
                        Send Request
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateBlankPDF('reference1', references.reference1)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Manual PDF
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Reference 2 */}
      {references.reference2 && (() => {
        const completedRef = getCompletedReferenceForEmail(references.reference2.email);
        return (
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="font-medium">{references.reference2.name}</div>
                {completedRef && <CheckCircle2 className="w-4 h-4 text-green-600" />}
              </div>
              <div className="text-sm text-muted-foreground">{references.reference2.company}</div>
              <div className="text-sm text-muted-foreground">{references.reference2.email}</div>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">
                  {referenceTypeForKey(application, 'reference2') === 'employer' ? 'Employer Reference' : 'Character Reference'}
                </Badge>
                {completedRef && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Completed on {new Date(completedRef.completed_at).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {completedRef ? (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => downloadCompletedReference(completedRef)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateBlankPDF('reference2', references.reference2)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Manual PDF
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => sendReferenceEmail('reference2', references.reference2)}
                    disabled={sending === 'reference2'}
                  >
                    {sending === 'reference2' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1" />
                        Send Request
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateBlankPDF('reference2', references.reference2)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Manual PDF
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}