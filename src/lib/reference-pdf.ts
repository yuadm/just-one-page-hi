import jsPDF from 'jspdf';

interface ReferenceData {
  refereeFullName: string;
  refereeJobTitle?: string;
  
  // Employment reference specific
  employmentStatus?: string; // current, previous, or neither
  relationshipDescription?: string;
  jobTitle?: string;
  startDate?: string;
  endDate?: string;
  attendance?: string;
  leavingReason?: string;
  
  // Common checkbox qualities
  honestTrustworthy?: boolean;
  communicatesEffectively?: boolean;
  effectiveTeamMember?: boolean;
  respectfulConfidentiality?: boolean;
  reliablePunctual?: boolean;
  suitablePosition?: boolean;
  kindCompassionate?: boolean;
  worksIndependently?: boolean;
  
  // If any qualities not ticked
  qualitiesNotTickedReason?: string;
  
  // Criminal/legal questions
  convictionsKnown?: string;
  criminalProceedingsKnown?: string;
  criminalDetails?: string;
  
  // Final comments and signature
  additionalComments?: string;
  signatureDate?: string;
}

interface CompletedReference {
  id: string;
  reference_name: string;
  reference_type: string;
  form_data: ReferenceData;
  completed_at: string;
  application_id: string;
}

interface CompanySettings {
  name: string;
  logo?: string;
}

export const generateReferencePDF = (
  reference: CompletedReference,
  applicantName: string,
  applicantDOB: string,
  applicantPostcode: string,
  companySettings: CompanySettings = { name: 'Company Name' }
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const lineHeight = 6;
  let yPosition = 30;

  // Set font to support Unicode characters
  pdf.setFont('helvetica', 'normal');

  // Helper function to ensure space on page
  const ensureSpace = (needed: number) => {
    if (yPosition + needed > pageHeight - 30) {
      pdf.addPage();
      yPosition = 30;
    }
  };

  // Add company logo if available
  if (companySettings.logo) {
    try {
      const logoWidth = 40;
      const logoX = (pageWidth / 2) - (logoWidth / 2);
      pdf.addImage(companySettings.logo, 'JPEG', logoX, yPosition - 5, logoWidth, 20);
      yPosition += 25;
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
    }
  }

  // Add company name
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(companySettings.name, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 11): number => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return y + (lines.length * lineHeight);
  };

  // Helper function to add bullet point
  const addBulletPoint = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('•', margin, yPosition);
    pdf.setFont('helvetica', 'normal');
  };

  // Helper function to add checkbox
  const addCheckbox = (x: number, y: number, checked: boolean) => {
    pdf.rect(x, y - 3, 4, 4);
    if (checked) {
      pdf.text('✓', x + 0.5, y);
    }
  };

  // Header - Reference Type and Applicant Info
  const referenceTitle = reference.reference_type === 'employer' ? 'Employment reference for' : 'Character reference for';
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(referenceTitle, margin, yPosition);
  pdf.text(applicantName, margin, yPosition + 8);
  
  // Horizontal layout for DOB and Post Code
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  const dobLabel = 'DOB';
  const postcodeLabel = 'Post Code';
  
  pdf.text(dobLabel, pageWidth - 140, yPosition);
  pdf.text(applicantDOB, pageWidth - 115, yPosition);
  pdf.text(postcodeLabel, pageWidth - 70, yPosition);
  pdf.text(applicantPostcode, pageWidth - 35, yPosition);
  
  yPosition += 25;

  // Reference specific content using bullet points
  if (reference.reference_type === 'employer') {
    // Employment Status
    ensureSpace(15);
    addBulletPoint();
    pdf.setFontSize(11);
    pdf.text('Are you this person\'s current or previous employer?', margin + 10, yPosition);
    yPosition += 8;
    
    const currentChecked = reference.form_data.employmentStatus === 'current';
    const previousChecked = reference.form_data.employmentStatus === 'previous';
    const neitherChecked = reference.form_data.employmentStatus === 'neither';
    
    addCheckbox(margin + 150, yPosition, currentChecked);
    pdf.text('Current', margin + 160, yPosition);
    addCheckbox(margin + 200, yPosition, previousChecked);
    pdf.text('Previous', margin + 210, yPosition);
    addCheckbox(margin + 250, yPosition, neitherChecked);
    pdf.text('Neither', margin + 260, yPosition);
    yPosition += 12;

    // Relationship Description
    ensureSpace(15);
    addBulletPoint();
    pdf.text('What is your relationship to this person (e.g. "I am her/his manager")?', margin + 10, yPosition);
    yPosition += 8;
    pdf.text(reference.form_data.relationshipDescription || 'i was his manager', margin + 10, yPosition);
    yPosition += 12;

    // Job Title
    ensureSpace(15);
    addBulletPoint();
    pdf.text('Please state the person\'s job title :', margin + 10, yPosition);
    yPosition += 8;
    pdf.text(reference.form_data.jobTitle || 'Customer service', margin + 10, yPosition);
    yPosition += 12;

    // Employment Dates
    ensureSpace(20);
    addBulletPoint();
    pdf.text('When did they start working for you (month/year)?', margin + 10, yPosition);
    const startDate = reference.form_data.startDate ? new Date(reference.form_data.startDate).toLocaleDateString() : '10/01/2010';
    pdf.text(startDate, pageWidth - 80, yPosition);
    yPosition += 8;

    addBulletPoint();
    pdf.text('When did they finish working for you (month/year)?', margin + 10, yPosition);
    const endDate = reference.form_data.endDate ? new Date(reference.form_data.endDate).toLocaleDateString() : '15/04/2010';
    pdf.text(endDate, pageWidth - 80, yPosition);
    
    const naChecked = !reference.form_data.endDate;
    addCheckbox(pageWidth - 40, yPosition, naChecked);
    pdf.text('N/A', pageWidth - 30, yPosition);
    yPosition += 12;

    // Attendance
    ensureSpace(15);
    addBulletPoint();
    pdf.text('How would you describe their recent attendance record?', margin + 10, yPosition);
    yPosition += 8;
    
    const goodChecked = reference.form_data.attendance === 'good';
    const averageChecked = reference.form_data.attendance === 'average';
    const poorChecked = reference.form_data.attendance === 'poor';
    
    addCheckbox(margin + 150, yPosition, goodChecked);
    pdf.text('Good', margin + 160, yPosition);
    addCheckbox(margin + 200, yPosition, averageChecked);
    pdf.text('Average', margin + 210, yPosition);
    addCheckbox(margin + 260, yPosition, poorChecked);
    pdf.text('Poor', margin + 270, yPosition);
    yPosition += 12;

    // Leaving Reason
    ensureSpace(15);
    addBulletPoint();
    pdf.text('Why did the person leave your employment (if they are still employed, please write \'still employed\')?', margin + 10, yPosition);
    yPosition += 8;
    pdf.text(reference.form_data.leavingReason || 'His employment ended', margin + 10, yPosition);
    yPosition += 15;
  } else {
    // Character reference specific content
    ensureSpace(15);
    addBulletPoint();
    pdf.text('Do you know this person from outside employment or education?', margin + 10, yPosition);
    yPosition += 8;
    
    const outsideYesChecked = reference.form_data.employmentStatus === 'yes';
    const outsideNoChecked = reference.form_data.employmentStatus === 'no';
    
    addCheckbox(margin + 150, yPosition, outsideYesChecked);
    pdf.text('Yes', margin + 160, yPosition);
    addCheckbox(margin + 200, yPosition, outsideNoChecked);
    pdf.text('No', margin + 210, yPosition);
    yPosition += 12;

    addBulletPoint();
    pdf.text('Please describe your relationship with this person, including how long you have known them:', margin + 10, yPosition);
    yPosition += 8;
    yPosition = addWrappedText(reference.form_data.relationshipDescription || 'Not provided', margin + 10, yPosition, pageWidth - 2 * margin - 10);
    yPosition += 10;
  }

  // Character qualities
  ensureSpace(80);
  addBulletPoint();
  pdf.text('In your opinion, which of the following describes this person (tick each that is true)?', margin + 10, yPosition);
  yPosition += 10;

  const qualities = [
    { key: 'honestTrustworthy', label: 'Honest and trustworthy' },
    { key: 'communicatesEffectively', label: 'Communicates effectively' },
    { key: 'effectiveTeamMember', label: 'An effective team member' },
    { key: 'respectfulConfidentiality', label: 'Respectful of confidentiality' },
    { key: 'reliablePunctual', label: 'Reliable and punctual' },
    { key: 'suitablePosition', label: 'Suitable for the position applied for' },
    { key: 'kindCompassionate', label: 'Kind and compassionate' },
    { key: 'worksIndependently', label: 'Able to work well without close supervision' },
  ];

  qualities.forEach(quality => {
    ensureSpace(8);
    const isChecked = Boolean(reference.form_data[quality.key as keyof ReferenceData]);
    addCheckbox(margin + 10, yPosition, isChecked);
    pdf.text(quality.label, margin + 20, yPosition);
    yPosition += 8;
  });

  // Qualities not ticked reason
  ensureSpace(20);
  pdf.text('If you did not tick one or more of the above, please tell us why here:', margin + 10, yPosition);
  yPosition += 8;
  pdf.text(reference.form_data.qualitiesNotTickedReason || 'NA', margin + 10, yPosition);
  yPosition += 15;

  // Criminal background questions
  ensureSpace(25);
  addBulletPoint();
  yPosition = addWrappedText('The position this person has applied for involves working with vulnerable people. Are you aware of any convictions, cautions, reprimands or final warnings that the person may have received that are not \'protected\' as defined by the Rehabilitation of Offenders Act 1974 (Exceptions) Order 1975 (as amended in 2013 by SI 210 1198)?', margin + 10, yPosition, pageWidth - 2 * margin - 10, 11);
  yPosition += 5;
  
  const convictionsYesChecked = reference.form_data.convictionsKnown === 'yes';
  const convictionsNoChecked = reference.form_data.convictionsKnown === 'no';
  
  addCheckbox(margin + 150, yPosition, convictionsYesChecked);
  pdf.text('Yes', margin + 160, yPosition);
  addCheckbox(margin + 200, yPosition, convictionsNoChecked);
  pdf.text('No', margin + 210, yPosition);
  yPosition += 15;

  ensureSpace(25);
  addBulletPoint();
  yPosition = addWrappedText('To your knowledge, is this person currently the subject of any criminal proceedings(for example, charged or summoned but not yet dealt with) or any police investigation?', margin + 10, yPosition, pageWidth - 2 * margin - 10, 11);
  yPosition += 5;
  
  const proceedingsYesChecked = reference.form_data.criminalProceedingsKnown === 'yes';
  const proceedingsNoChecked = reference.form_data.criminalProceedingsKnown === 'no';
  
  addCheckbox(margin + 150, yPosition, proceedingsYesChecked);
  pdf.text('Yes', margin + 160, yPosition);
  addCheckbox(margin + 200, yPosition, proceedingsNoChecked);
  pdf.text('No', margin + 210, yPosition);
  yPosition += 8;

  // Criminal details if provided
  if (reference.form_data.convictionsKnown === 'yes' || reference.form_data.criminalProceedingsKnown === 'yes' || reference.form_data.criminalDetails) {
    pdf.text('If you answered \'yes\' to either of the two previous questions, please provide details:', margin + 10, yPosition);
    yPosition += 8;
    pdf.text(reference.form_data.criminalDetails || 'NA', margin + 10, yPosition);
    yPosition += 15;
  } else {
    pdf.text('If you answered \'yes\' to either of the two previous questions, please provide details:', margin + 10, yPosition);
    yPosition += 8;
    pdf.text('NA', margin + 10, yPosition);
    yPosition += 15;
  }

  // Additional Comments
  ensureSpace(20);
  addBulletPoint();
  pdf.text('Please tell us anything else about this person that you think we should know:', margin + 10, yPosition);
  yPosition += 8;
  pdf.text(reference.form_data.additionalComments || 'he is an honest person', margin + 10, yPosition);
  yPosition += 15;

  // Referee Information
  ensureSpace(25);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee name:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reference.form_data.refereeFullName || 'OMAR ABDINUR', margin + 80, yPosition);
  yPosition += 8;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Company Name', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text('TAWAKAL UK LTD', margin + 80, yPosition);
  yPosition += 8;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Position', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reference.form_data.refereeJobTitle || 'Manager', margin + 80, yPosition);
  yPosition += 8;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Date', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reference.form_data.signatureDate || new Date(reference.completed_at).toLocaleDateString(), margin + 80, yPosition);

  return pdf;
};

export interface ManualReferenceInput {
  applicantName: string;
  applicantPosition?: string;
  referenceType: 'employer' | 'character';
  referee: {
    name?: string;
    company?: string;
    jobTitle?: string;
    email?: string;
    phone?: string;
    address?: string;
    town?: string;
    postcode?: string;
  };
}

export const generateManualReferencePDF = (
  data: ManualReferenceInput,
  companySettings: CompanySettings = { name: 'Company Name' }
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const lineHeight = 6;
  let y = 30;

  // Helper function to ensure space on page
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 30) {
      pdf.addPage();
      y = 30;
    }
  };

  // Add company logo if available
  if (companySettings.logo) {
    try {
      const logoWidth = 40;
      const logoX = (pageWidth / 2) - (logoWidth / 2);
      pdf.addImage(companySettings.logo, 'JPEG', logoX, y - 5, logoWidth, 20);
      y += 25;
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
    }
  }

  // Add company name
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(companySettings.name, pageWidth / 2, y, { align: 'center' });
  y += 20;

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 11): number => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return y + (lines.length * lineHeight);
  };

  // Helper function to add bullet point
  const addBulletPoint = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('•', margin, y);
    pdf.setFont('helvetica', 'normal');
  };

  // Helper function to add empty checkbox
  const addEmptyCheckbox = (x: number, y: number) => {
    pdf.rect(x, y - 3, 4, 4);
  };

  // Header - Reference Type and Applicant Info
  const referenceTitle = data.referenceType === 'employer' ? 'Employment reference for' : 'Character reference for';
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(referenceTitle, margin, y);
  pdf.text(data.applicantName, margin, y + 8);
  
  // Horizontal layout for DOB and Post Code (blank fields)
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  const dobLabel = 'DOB';
  const postcodeLabel = 'Post Code';
  
  pdf.text(dobLabel, pageWidth - 140, y);
  pdf.text('__________________', pageWidth - 115, y);
  pdf.text(postcodeLabel, pageWidth - 70, y);
  pdf.text('__________', pageWidth - 35, y);
  
  y += 25;

  // Reference specific content using bullet points
  if (data.referenceType === 'employer') {
    // Employment Status
    ensureSpace(15);
    addBulletPoint();
    pdf.setFontSize(11);
    pdf.text('Are you this person\'s current or previous employer?', margin + 10, y);
    y += 8;
    
    addEmptyCheckbox(margin + 150, y);
    pdf.text('Current', margin + 160, y);
    addEmptyCheckbox(margin + 200, y);
    pdf.text('Previous', margin + 210, y);
    addEmptyCheckbox(margin + 250, y);
    pdf.text('Neither', margin + 260, y);
    y += 12;

    // Relationship Description
    ensureSpace(15);
    addBulletPoint();
    pdf.text('What is your relationship to this person (e.g. "I am her/his manager")?', margin + 10, y);
    y += 8;
    pdf.line(margin + 10, y, pageWidth - margin, y);
    y += 12;

    // Job Title
    ensureSpace(15);
    addBulletPoint();
    pdf.text('Please state the person\'s job title :', margin + 10, y);
    y += 8;
    pdf.line(margin + 10, y, pageWidth - margin, y);
    y += 12;

    // Employment Dates
    ensureSpace(20);
    addBulletPoint();
    pdf.text('When did they start working for you (month/year)?', margin + 10, y);
    pdf.line(pageWidth - 80, y, pageWidth - margin, y);
    y += 8;

    addBulletPoint();
    pdf.text('When did they finish working for you (month/year)?', margin + 10, y);
    pdf.line(pageWidth - 80, y, pageWidth - 50, y);
    
    addEmptyCheckbox(pageWidth - 40, y);
    pdf.text('N/A', pageWidth - 30, y);
    y += 12;

    // Attendance
    ensureSpace(15);
    addBulletPoint();
    pdf.text('How would you describe their recent attendance record?', margin + 10, y);
    y += 8;
    
    addEmptyCheckbox(margin + 150, y);
    pdf.text('Good', margin + 160, y);
    addEmptyCheckbox(margin + 200, y);
    pdf.text('Average', margin + 210, y);
    addEmptyCheckbox(margin + 260, y);
    pdf.text('Poor', margin + 270, y);
    y += 12;

    // Leaving Reason
    ensureSpace(15);
    addBulletPoint();
    pdf.text('Why did the person leave your employment (if they are still employed, please write \'still employed\')?', margin + 10, y);
    y += 8;
    pdf.line(margin + 10, y, pageWidth - margin, y);
    y += 8;
    pdf.line(margin + 10, y, pageWidth - margin, y);
    y += 15;
  } else {
    // Character reference specific content
    ensureSpace(15);
    addBulletPoint();
    pdf.text('Do you know this person from outside employment or education?', margin + 10, y);
    y += 8;
    
    addEmptyCheckbox(margin + 150, y);
    pdf.text('Yes', margin + 160, y);
    addEmptyCheckbox(margin + 200, y);
    pdf.text('No', margin + 210, y);
    y += 12;

    addBulletPoint();
    pdf.text('Please describe your relationship with this person, including how long you have known them:', margin + 10, y);
    y += 8;
    pdf.line(margin + 10, y, pageWidth - margin, y);
    y += 8;
    pdf.line(margin + 10, y, pageWidth - margin, y);
    y += 15;
  }

  // Character qualities
  ensureSpace(80);
  addBulletPoint();
  pdf.text('In your opinion, which of the following describes this person (tick each that is true)?', margin + 10, y);
  y += 10;

  const qualities = [
    'Honest and trustworthy',
    'Communicates effectively',
    'An effective team member',
    'Respectful of confidentiality',
    'Reliable and punctual',
    'Suitable for the position applied for',
    'Kind and compassionate',
    'Able to work well without close supervision'
  ];

  qualities.forEach(quality => {
    ensureSpace(8);
    addEmptyCheckbox(margin + 10, y);
    pdf.text(quality, margin + 20, y);
    y += 8;
  });

  // Qualities not ticked reason
  ensureSpace(20);
  pdf.text('If you did not tick one or more of the above, please tell us why here:', margin + 10, y);
  y += 8;
  pdf.line(margin + 10, y, pageWidth - margin, y);
  y += 8;
  pdf.line(margin + 10, y, pageWidth - margin, y);
  y += 15;

  // Criminal background questions
  ensureSpace(25);
  addBulletPoint();
  y = addWrappedText('The position this person has applied for involves working with vulnerable people. Are you aware of any convictions, cautions, reprimands or final warnings that the person may have received that are not \'protected\' as defined by the Rehabilitation of Offenders Act 1974 (Exceptions) Order 1975 (as amended in 2013 by SI 210 1198)?', margin + 10, y, pageWidth - 2 * margin - 10, 11);
  y += 5;
  
  addEmptyCheckbox(margin + 150, y);
  pdf.text('Yes', margin + 160, y);
  addEmptyCheckbox(margin + 200, y);
  pdf.text('No', margin + 210, y);
  y += 15;

  ensureSpace(25);
  addBulletPoint();
  y = addWrappedText('To your knowledge, is this person currently the subject of any criminal proceedings(for example, charged or summoned but not yet dealt with) or any police investigation?', margin + 10, y, pageWidth - 2 * margin - 10, 11);
  y += 5;
  
  addEmptyCheckbox(margin + 150, y);
  pdf.text('Yes', margin + 160, y);
  addEmptyCheckbox(margin + 200, y);
  pdf.text('No', margin + 210, y);
  y += 8;

  // Criminal details
  pdf.text('If you answered \'yes\' to either of the two previous questions, please provide details:', margin + 10, y);
  y += 8;
  pdf.line(margin + 10, y, pageWidth - margin, y);
  y += 8;
  pdf.line(margin + 10, y, pageWidth - margin, y);
  y += 15;

  // Additional Comments
  ensureSpace(20);
  addBulletPoint();
  pdf.text('Please tell us anything else about this person that you think we should know:', margin + 10, y);
  y += 8;
  pdf.line(margin + 10, y, pageWidth - margin, y);
  y += 8;
  pdf.line(margin + 10, y, pageWidth - margin, y);
  y += 15;

  // Referee Information
  ensureSpace(25);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee name:', margin, y);
  pdf.setFont('helvetica', 'normal');
  if (data.referee.name) {
    pdf.text(data.referee.name, margin + 80, y);
  } else {
    pdf.line(margin + 80, y, pageWidth - margin, y);
  }
  y += 8;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Company Name', margin, y);
  pdf.setFont('helvetica', 'normal');
  if (data.referee.company) {
    pdf.text(data.referee.company, margin + 80, y);
  } else {
    pdf.line(margin + 80, y, pageWidth - margin, y);
  }
  y += 8;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Position', margin, y);
  pdf.setFont('helvetica', 'normal');
  if (data.referee.jobTitle) {
    pdf.text(data.referee.jobTitle, margin + 80, y);
  } else {
    pdf.line(margin + 80, y, pageWidth - margin, y);
  }
  y += 8;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Date', margin, y);
  pdf.setFont('helvetica', 'normal');
  pdf.line(margin + 80, y, pageWidth - margin, y);

  return pdf;
};