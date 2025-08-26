import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ArrowRight, CheckCircle, Shield } from 'lucide-react';
import { CompanyProvider, useCompany } from '@/contexts/CompanyContext';
import { JobApplicationData, PersonalInfo, Availability, EmergencyContact, EmploymentHistory, References, SkillsExperience, Declaration, TermsPolicy } from './types';
import { PersonalInfoStep } from './steps/PersonalInfoStep';
import { AvailabilityStep } from './steps/AvailabilityStep';
import { EmergencyContactStep } from './steps/EmergencyContactStep';
import { EmploymentHistoryStep } from './steps/EmploymentHistoryStep';
import { ReferencesStep } from './steps/ReferencesStep';
import { SkillsExperienceStep } from './steps/SkillsExperienceStep';
import { DeclarationStep } from './steps/DeclarationStep';
import { TermsPolicyStep } from './steps/TermsPolicyStep';
import { generateJobApplicationPdf } from '@/lib/job-application-pdf';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReviewSummary } from './ReviewSummary';

const initialFormData: JobApplicationData = {
  personalInfo: {
    title: '',
    fullName: '',
    email: '',
    confirmEmail: '',
    telephone: '',
    dateOfBirth: '',
    streetAddress: '',
    streetAddress2: '',
    town: '',
    borough: '',
    postcode: '',
    englishProficiency: '',
    otherLanguages: [],
    positionAppliedFor: '',
    personalCareWillingness: '',
    hasDBS: '',
    hasCarAndLicense: '',
    nationalInsuranceNumber: '',
  },
  availability: {
    timeSlots: {},
    hoursPerWeek: '',
    hasRightToWork: '',
  },
  emergencyContact: {
    fullName: '',
    relationship: '',
    contactNumber: '',
    howDidYouHear: '',
  },
  employmentHistory: {
    previouslyEmployed: '',
  },
  references: {
    reference1: {
      name: '', company: '', jobTitle: '', email: '', address: '', address2: '', town: '', contactNumber: '', postcode: ''
    },
    reference2: {
      name: '', company: '', jobTitle: '', email: '', address: '', address2: '', town: '', contactNumber: '', postcode: ''
    }
  },
  skillsExperience: { skills: {} },
  declaration: {
    socialServiceEnquiry: '', convictedOfOffence: '', safeguardingInvestigation: '', 
    criminalConvictions: '', healthConditions: '', cautionsReprimands: ''
  },
  termsPolicy: { consentToTerms: false, signature: '', fullName: '', date: '' }
};

function JobApplicationPortalContent() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<JobApplicationData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const { companySettings } = useCompany();
  const { toast } = useToast();

  const DRAFT_KEY = 'job_application_draft';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.formData) setFormData(saved.formData);
        if (saved?.currentStep) setCurrentStep(saved.currentStep);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, currentStep }));
    } catch {}
  }, [formData, currentStep]);


  const totalSteps = 8;

  const updatePersonalInfo = (field: keyof PersonalInfo, value: string | string[]) => {
    setFormData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, [field]: value } }));
  };

  const updateAvailability = (field: keyof Availability, value: string | Record<string, string[]>) => {
    setFormData(prev => ({ ...prev, availability: { ...prev.availability, [field]: value } }));
  };

  const updateEmergencyContact = (field: keyof EmergencyContact, value: string) => {
    setFormData(prev => ({ ...prev, emergencyContact: { ...prev.emergencyContact, [field]: value } }));
  };

  const updateEmploymentHistory = (field: keyof EmploymentHistory, value: any) => {
    setFormData(prev => ({ ...prev, employmentHistory: { ...prev.employmentHistory, [field]: value } }));
  };

  const updateReferences = (field: keyof References, value: any) => {
    setFormData(prev => ({ ...prev, references: { ...prev.references, [field]: value } }));
  };

  const updateSkillsExperience = (field: keyof SkillsExperience, value: any) => {
    setFormData(prev => ({ ...prev, skillsExperience: { ...prev.skillsExperience, [field]: value } }));
  };

  const updateDeclaration = (field: keyof Declaration, value: string) => {
    setFormData(prev => ({ ...prev, declaration: { ...prev.declaration, [field]: value } }));
  };

  const updateTermsPolicy = (field: keyof TermsPolicy, value: string | boolean) => {
    setFormData(prev => ({ ...prev, termsPolicy: { ...prev.termsPolicy, [field]: value } }));
  };

const handleDownloadPdf = async () => {
    try {
      await generateJobApplicationPdf(formData, {
        logoUrl: companySettings.logo,
        companyName: companySettings.name,
      });
    } catch (err) {
      console.error('PDF generation failed', err);
      toast({ title: 'PDF Error', description: 'Failed to generate PDF. Please try again.', variant: 'destructive' });
    }
  };

  const handleDownloadJson = () => {
    try {
      const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'job-application.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('JSON download failed', err);
      toast({ title: 'Download Error', description: 'Failed to download JSON.', variant: 'destructive' });
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('job_applications')
        .insert([{
          personal_info: formData.personalInfo,
          availability: formData.availability,
          emergency_contact: formData.emergencyContact,
          employment_history: formData.employmentHistory,
          reference_info: formData.references,
          skills_experience: formData.skillsExperience,
          declarations: formData.declaration,
          consent: formData.termsPolicy,
          status: 'new'
        }] as any);

      if (error) throw error;

      setIsSubmitted(true);
      // Clear the draft after successful submission
      localStorage.removeItem(DRAFT_KEY);
      toast({
        title: "Application Submitted",
        description: "Your job application has been submitted successfully. We'll be in touch soon!",
      });
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-green-700">Application Submitted!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Thank you for your interest in joining our team. We have received your application and will review it shortly.
            </p>
            <Button onClick={() => {
              // Reset form data and redirect to start fresh application
              setFormData(initialFormData);
              setCurrentStep(1);
              setIsSubmitted(false);
              window.location.href = '/';
            }} className="w-full">
              Return to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <PersonalInfoStep data={formData.personalInfo} updateData={updatePersonalInfo} />;
      case 2:
        return <AvailabilityStep data={formData.availability} updateData={updateAvailability} />;
      case 3:
        return <EmergencyContactStep data={formData.emergencyContact} updateData={updateEmergencyContact} />;
      case 4:
        return <EmploymentHistoryStep data={formData.employmentHistory} updateData={updateEmploymentHistory} />;
      case 5:
        return <ReferencesStep data={formData.references} employmentHistory={formData.employmentHistory} updateData={updateReferences} />;
      case 6:
        return <SkillsExperienceStep data={formData.skillsExperience} updateData={updateSkillsExperience} />;
      case 7:
        return <DeclarationStep data={formData.declaration} updateData={updateDeclaration} />;
      case 8:
        return <TermsPolicyStep data={formData.termsPolicy} updateData={updateTermsPolicy} />;
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    const titles = [
      'Personal Information',
      'Availability',
      'Emergency Contact',
      'Employment History',
      'References',
      'Skills & Experience',
      'Declaration',
      'Terms & Policy'
    ];
    return titles[currentStep - 1];
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        // Personal Info: All required except Street Address Second Line and languages
        const pi = formData.personalInfo;
        return pi.title && pi.fullName && pi.email && pi.confirmEmail && 
               pi.email === pi.confirmEmail && pi.telephone && pi.dateOfBirth && 
               pi.streetAddress && pi.town && pi.borough && pi.postcode && 
               pi.englishProficiency && pi.positionAppliedFor && 
               pi.personalCareWillingness && pi.hasDBS && pi.hasCarAndLicense && 
               pi.nationalInsuranceNumber;
      case 2:
        return formData.availability.hoursPerWeek && formData.availability.hasRightToWork;
      case 3:
        return formData.emergencyContact.fullName && formData.emergencyContact.relationship && formData.emergencyContact.contactNumber && formData.emergencyContact.howDidYouHear;
      case 4:
        // Employment History: If previously employed = yes, must complete Most Recent Employer
        if (formData.employmentHistory.previouslyEmployed === 'yes') {
          const re = formData.employmentHistory.recentEmployer;
          return re && re.company && re.name && re.email && re.position && 
                 re.address && re.town && re.postcode && re.telephone && 
                 re.from && re.to && re.reasonForLeaving;
        }
        return formData.employmentHistory.previouslyEmployed === 'no';
      case 5:
        return formData.references.reference1.name && formData.references.reference2.name;
      case 7:
        // Declaration step validation
        const declaration = formData.declaration;
        const requiredFields = [
          'socialServiceEnquiry', 'convictedOfOffence', 'safeguardingInvestigation',
          'criminalConvictions', 'healthConditions', 'cautionsReprimands'
        ];
        
        // Check if all required fields are answered
        const allAnswered = requiredFields.every(field => declaration[field as keyof Declaration]);
        
        if (!allAnswered) return false;
        
        // Check if any "yes" answers have required details
        const needsDetails = [
          { field: 'socialServiceEnquiry', detail: 'socialServiceDetails' },
          { field: 'convictedOfOffence', detail: 'convictedDetails' },
          { field: 'safeguardingInvestigation', detail: 'safeguardingDetails' },
          { field: 'criminalConvictions', detail: 'criminalDetails' },
          { field: 'healthConditions', detail: 'healthDetails' },
          { field: 'cautionsReprimands', detail: 'cautionsDetails' }
        ];
        
        return needsDetails.every(({ field, detail }) => {
          if (declaration[field as keyof Declaration] === 'yes') {
            return declaration[detail as keyof Declaration]?.trim();
          }
          return true;
        });
      case 8:
        return formData.termsPolicy.consentToTerms && formData.termsPolicy.signature && formData.termsPolicy.date;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Company Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            {companySettings.logo ? (
              <img
                src={companySettings.logo}
                alt={companySettings.name}
                className="h-12 w-12 object-contain"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="text-left">
              <div className="text-2xl font-bold">{companySettings.name}</div>
              <p className="text-muted-foreground">{companySettings.tagline}</p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Homepage
            </Button>
          </div>
          
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">Job Application</h1>
            <p className="text-muted-foreground">Step {currentStep} of {totalSteps}: {getStepTitle()}</p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-secondary/20 rounded-full h-2 mb-8">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{getStepTitle()}</CardTitle>
          </CardHeader>
          <CardContent>
            {renderStep()}
            
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
          <div className="flex gap-2">
            {currentStep === totalSteps ? (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </Button>
            ) : (
                  <Button
                    onClick={nextStep}
                    disabled={!canProceed()}
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function JobApplicationPortal() {
  return (
    <CompanyProvider>
      <JobApplicationPortalContent />
    </CompanyProvider>
  );
}