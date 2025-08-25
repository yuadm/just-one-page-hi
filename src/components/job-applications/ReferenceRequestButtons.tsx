import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Download, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface Reference {
  name: string;
  company: string;
  jobTitle: string;
  email: string;
  address: string;
  address2: string;
  town: string;
  contactNumber: string;
  postcode: string;
}

interface ReferenceRequestButtonsProps {
  application: any;
  reference: Reference;
  referenceType: 'employer' | 'character';
  applicationId: string;
}

export function ReferenceRequestButtons({ 
  application, 
  reference, 
  referenceType, 
  applicationId 
}: ReferenceRequestButtonsProps) {
  const [isSending, setIsSending] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'sent' | 'completed'>('none');
  const { toast } = useToast();
  const { companySettings } = useCompany();

  const sendReferenceEmail = async () => {
    if (!reference.email) {
      toast({
        title: "Error",
        description: "No email address found for this reference",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const applicantName = application.personal_info?.fullName || 'Unknown Applicant';
      const position = application.personal_info?.positionAppliedFor || 'Unknown Position';
      const applicantAddress = [
        application.personal_info?.streetAddress,
        application.personal_info?.streetAddress2,
        application.personal_info?.town,
        application.personal_info?.postcode
      ].filter(Boolean).join(', ');

      const referenceAddress = [
        reference.address,
        reference.address2,
        reference.town,
        reference.postcode
      ].filter(Boolean).join(', ');

      const { data, error } = await supabase.functions.invoke('send-reference-email', {
        body: {
          applicantName,
          applicantAddress,
          applicantPostcode: application.personal_info?.postcode || '',
          positionAppliedFor: position,
          referenceEmail: reference.email,
          referenceName: reference.name,
          referenceCompany: reference.company,
          referenceAddress,
          companyName: companySettings.name,
          referenceType,
          applicationId,
          referenceData: reference
        }
      });

      if (error) throw error;

      if (data?.success) {
        setRequestStatus('sent');
        toast({
          title: "Reference Request Sent",
          description: `Email sent to ${reference.name} (${reference.email})`,
        });
      } else {
        throw new Error(data?.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      console.error('Error sending reference email:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send reference request",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const downloadPrefilled = () => {
    // TODO: Implement prefilled PDF download
    toast({
      title: "Download",
      description: "Prefilled reference form download will be implemented soon",
    });
  };

  const downloadCompleted = () => {
    // TODO: Implement completed reference PDF download
    toast({
      title: "Download",
      description: "Completed reference download will be implemented soon",
    });
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      {requestStatus === 'none' && (
        <>
          <Button
            size="sm"
            onClick={sendReferenceEmail}
            disabled={isSending}
            className="flex items-center gap-1"
          >
            <Send className="w-3 h-3" />
            {isSending ? 'Sending...' : 'Send Reference Request'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadPrefilled}
            className="flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            Download Blank
          </Button>
        </>
      )}
      
      {requestStatus === 'sent' && (
        <>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Request Sent
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadPrefilled}
            className="flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            Download Manual Form
          </Button>
        </>
      )}
      
      {requestStatus === 'completed' && (
        <>
          <Badge variant="default" className="flex items-center gap-1 bg-green-600">
            <CheckCircle className="w-3 h-3" />
            Completed
          </Badge>
          <Button
            size="sm"
            onClick={downloadCompleted}
            className="flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            Download Reference
          </Button>
        </>
      )}
    </div>
  );
}