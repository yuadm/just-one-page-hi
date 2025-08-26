import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Download, Loader2 } from 'lucide-react';

interface ReferenceButtonsProps {
  application: any;
  references: any;
  onUpdate?: () => void;
}

export function ReferenceButtons({ application, references, onUpdate }: ReferenceButtonsProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState<string | null>(null);

  const determineReferenceType = (application: any) => {
    const hasEmployment = application.employment_history?.previouslyEmployed === 'yes';
    return hasEmployment ? 'employer' : 'character';
  };

  const sendReferenceEmail = async (referenceKey: string, reference: any) => {
    setSending(referenceKey);
    
    try {
      const referenceType = determineReferenceType(application);
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

  const generateBlankPDF = (referenceKey: string, reference: any) => {
    // For now, just show a message about manual PDF generation
    toast({
      title: "Manual Reference PDF",
      description: "PDF generation will be implemented. For now, please manually create the reference document.",
    });
  };

  if (!references) return null;

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Reference Actions</h4>
      
      {/* Reference 1 */}
      {references.reference1 && (
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex-1">
            <div className="font-medium">{references.reference1.name}</div>
            <div className="text-sm text-muted-foreground">{references.reference1.company}</div>
            <div className="text-sm text-muted-foreground">{references.reference1.email}</div>
            <Badge variant="outline" className="mt-1">
              {determineReferenceType(application) === 'employer' ? 'Employer Reference' : 'Character Reference'}
            </Badge>
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>
      )}

      {/* Reference 2 */}
      {references.reference2 && (
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex-1">
            <div className="font-medium">{references.reference2.name}</div>
            <div className="text-sm text-muted-foreground">{references.reference2.company}</div>
            <div className="text-sm text-muted-foreground">{references.reference2.email}</div>
            <Badge variant="outline" className="mt-1">
              {determineReferenceType(application) === 'employer' ? 'Employer Reference' : 'Character Reference'}
            </Badge>
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>
      )}
    </div>
  );
}