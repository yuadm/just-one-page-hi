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
  const lineHeight = 7;
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
  yPosition += 15;

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 11): number => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return y + (lines.length * lineHeight);
  };

  // Header
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  const referenceType = reference.reference_type === 'employer' ? 'Employment reference for' : 'Character reference for';
  pdf.text(referenceType, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Applicant Information - Horizontal Layout
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  const nameText = `Name: ${applicantName}`;
  const dobText = `Date of Birth: ${applicantDOB}`;
  const postcodeText = `Postcode: ${applicantPostcode}`;
  
  pdf.text(nameText, margin, yPosition);
  const nameWidth = pdf.getTextWidth(nameText);
  pdf.text(dobText, margin + nameWidth + 20, yPosition);
  const dobWidth = pdf.getTextWidth(dobText);
  pdf.text(postcodeText, margin + nameWidth + dobWidth + 40, yPosition);
  yPosition += 15;

  // Referee Information
  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee Name:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reference.form_data.refereeFullName || '', margin + 70, yPosition);
  
  if (reference.form_data.refereeJobTitle) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Job Title:', margin + 200, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(reference.form_data.refereeJobTitle, margin + 250, yPosition);
  }
  yPosition += 15;

  // Reference specific content
  ensureSpace(60);
  if (reference.reference_type === 'employer') {
  // Employment Status
  pdf.setFont('helvetica', 'bold');
  pdf.text('Are you this person\'s current or previous employer?', margin, yPosition);
  yPosition += lineHeight;
  pdf.setFont('helvetica', 'normal');
  const currentBox = reference.form_data.employmentStatus === 'current' ? '[X]' : '[ ]';
  const previousBox = reference.form_data.employmentStatus === 'previous' ? '[X]' : '[ ]';
  const neitherBox = reference.form_data.employmentStatus === 'neither' ? '[X]' : '[ ]';
  pdf.text(`${currentBox} Current    ${previousBox} Previous    ${neitherBox} Neither`, margin, yPosition);
  yPosition += lineHeight + 2;

    // Relationship Description
    ensureSpace(25);
    pdf.setFont('helvetica', 'bold');
    pdf.text('What is your relationship to this person (e.g. "I am her/his manager")?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${reference.form_data.relationshipDescription || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 2;

    // Job Title
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Please state the person\'s job title:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${reference.form_data.jobTitle || 'Not provided'}`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Employment Dates
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Employment Period:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    const startDate = reference.form_data.startDate ? new Date(reference.form_data.startDate).toLocaleDateString() : 'Not provided';
    const endDate = reference.form_data.endDate ? new Date(reference.form_data.endDate).toLocaleDateString() : 'Not provided';
    pdf.text(`From ${startDate} to ${endDate}`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Attendance
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('How would you describe their recent attendance record?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    const goodBox = reference.form_data.attendance === 'good' ? '[X]' : '[ ]';
    const averageBox = reference.form_data.attendance === 'average' ? '[X]' : '[ ]';
    const poorBox = reference.form_data.attendance === 'poor' ? '[X]' : '[ ]';
    pdf.text(`${goodBox} Good    ${averageBox} Average    ${poorBox} Poor`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Leaving Reason
    ensureSpace(30);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Why did the person leave your employment (if they are still employed, please write \'still employed\')?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${reference.form_data.leavingReason || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 2;
  } else {
    // Character reference specific content
    ensureSpace(40);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Do you know this person from outside employment or education?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    const outsideYesBox = reference.form_data.employmentStatus === 'yes' ? '[X]' : '[ ]';
    const outsideNoBox = reference.form_data.employmentStatus === 'no' ? '[X]' : '[ ]';
    pdf.text(`${outsideYesBox} Yes    ${outsideNoBox} No`, margin, yPosition);
    yPosition += lineHeight + 5;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Please describe your relationship with this person, including how long you have known them:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${reference.form_data.relationshipDescription || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 5;
  }

  // Character qualities - Horizontal layout in 2 columns
  ensureSpace(60);
  pdf.setFont('helvetica', 'bold');
  pdf.text('In your opinion, which of the following describes this person (tick each that is true)?', margin, yPosition);
  yPosition += lineHeight + 3;

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

  pdf.setFont('helvetica', 'normal');
  
  // Display qualities in 2 columns
  const columnWidth = (pageWidth - 2 * margin) / 2;
  for (let i = 0; i < qualities.length; i += 2) {
    ensureSpace(8);
    
    // Left column quality
    const leftQuality = qualities[i];
    const leftChecked = reference.form_data[leftQuality.key as keyof ReferenceData];
    const leftCheckbox = leftChecked ? '[X]' : '[ ]';
    pdf.text(leftCheckbox, margin, yPosition);
    pdf.text(leftQuality.label, margin + 10, yPosition);
    
    // Right column quality (if exists)
    if (i + 1 < qualities.length) {
      const rightQuality = qualities[i + 1];
      const rightChecked = reference.form_data[rightQuality.key as keyof ReferenceData];
      const rightCheckbox = rightChecked ? '[X]' : '[ ]';
      const rightStartX = margin + columnWidth;
      pdf.text(rightCheckbox, rightStartX, yPosition);
      pdf.text(rightQuality.label, rightStartX + 10, yPosition);
    }
    
    yPosition += lineHeight;
  }

  // Qualities not ticked reason
  ensureSpace(30);
  yPosition += 3;
  pdf.setFont('helvetica', 'bold');
  pdf.text('If you did not tick one or more of the above, please tell us why here:', margin, yPosition);
  yPosition += lineHeight;
  pdf.setFont('helvetica', 'normal');
  yPosition = addWrappedText(`${reference.form_data.qualitiesNotTickedReason || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
  yPosition += 5;

  // Criminal background questions - CRITICAL SECTION
  ensureSpace(100);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('CRIMINAL BACKGROUND CHECK', margin, yPosition);
  yPosition += lineHeight + 3;
  
  pdf.setFontSize(11);
  yPosition = addWrappedText('The position this person has applied for involves working with vulnerable people. Are you aware of any convictions, cautions, reprimands or final warnings that the person may have received that are not \'protected\' as defined by the Rehabilitation of Offenders Act 1974 (Exceptions) Order 1975 (as amended in 2013 by SI 210 1198)?', margin, yPosition, pageWidth - 2 * margin, 11);
  yPosition += 3;
  pdf.setFont('helvetica', 'normal');
  const convictionsYesBox = reference.form_data.convictionsKnown === 'yes' ? '[X]' : '[ ]';
  const convictionsNoBox = reference.form_data.convictionsKnown === 'no' ? '[X]' : '[ ]';
  const convictionsAnswer = reference.form_data.convictionsKnown ? `${convictionsYesBox} Yes    ${convictionsNoBox} No` : 'Not answered';
  pdf.text(`Answer: ${convictionsAnswer}`, margin, yPosition);
  yPosition += lineHeight + 8;

  ensureSpace(50);
  pdf.setFont('helvetica', 'bold');
  yPosition = addWrappedText('To your knowledge, is this person currently the subject of any criminal proceedings (for example, charged or summoned but not yet dealt with) or any police investigation?', margin, yPosition, pageWidth - 2 * margin, 11);
  yPosition += 3;
  pdf.setFont('helvetica', 'normal');
  const proceedingsYesBox = reference.form_data.criminalProceedingsKnown === 'yes' ? '[X]' : '[ ]';
  const proceedingsNoBox = reference.form_data.criminalProceedingsKnown === 'no' ? '[X]' : '[ ]';
  const proceedingsAnswer = reference.form_data.criminalProceedingsKnown ? `${proceedingsYesBox} Yes    ${proceedingsNoBox} No` : 'Not answered';
  pdf.text(`Answer: ${proceedingsAnswer}`, margin, yPosition);
  yPosition += lineHeight + 8;

  // Criminal details if provided
  if (reference.form_data.convictionsKnown === 'yes' || reference.form_data.criminalProceedingsKnown === 'yes' || reference.form_data.criminalDetails) {
    ensureSpace(40);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Details provided:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${reference.form_data.criminalDetails || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 10;
  }

  // Additional Comments
  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Any additional comments you would like to make about this person:', margin, yPosition);
  yPosition += lineHeight;
  pdf.setFont('helvetica', 'normal');
  yPosition = addWrappedText(`${reference.form_data.additionalComments || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
  yPosition += 10;

  // Referee Information
  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  pdf.text('REFEREE INFORMATION', margin, yPosition);
  yPosition += lineHeight + 3;
  
  pdf.text('Referee Name:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reference.form_data.refereeFullName || '', margin + 70, yPosition);
  yPosition += lineHeight;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee Job Title:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reference.form_data.refereeJobTitle || '', margin + 85, yPosition);
  yPosition += lineHeight + 5;

  // Declaration and Date
  ensureSpace(50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DECLARATION', margin, yPosition);
  yPosition += lineHeight + 3;
  pdf.setFont('helvetica', 'normal');
  const declarationText = 'I certify that, to the best of my knowledge, the information I have given is true and complete. I understand that any deliberate omission, falsification or misrepresentation may lead to refusal of appointment or dismissal.';
  yPosition = addWrappedText(declarationText, margin, yPosition, pageWidth - 2 * margin);
  yPosition += 8;
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('Date of completion:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reference.form_data.signatureDate || new Date(reference.completed_at).toLocaleDateString(), margin + 100, yPosition);

  return pdf;
};

export interface ManualReferenceInput {
  applicantName: string;
  applicantPosition?: string;
  referenceType: 'employer' | 'character';
  applicantDOB?: string;
  applicantPostcode?: string;
  employmentFrom?: string;
  employmentTo?: string;
  reasonForLeaving?: string;
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
  let yPosition = 30;

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
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(companySettings.name, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  const addWrappedText = (text: string, x: number, y: number, maxWidth: number) => {
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return y + (lines.length * lineHeight);
  };

  const ensureSpace = (needed: number) => {
    if (yPosition + needed > pageHeight - 20) {
      pdf.addPage();
      yPosition = 30;
    }
  };

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  const referenceTitle = data.referenceType === 'employer' ? 'Employment reference for' : 'Character reference for';
  pdf.text(referenceTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  // Basic Information - Horizontal Layout
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  const nameText = `Name: ${data.applicantName}`;
  const dobText = `Date of Birth: ${data.applicantDOB || ''}`;
  const postcodeText = `Postcode: ${data.applicantPostcode || ''}`;
  
  pdf.text(nameText, margin, yPosition);
  const nameWidth = pdf.getTextWidth(nameText);
  pdf.text(dobText, margin + nameWidth + 20, yPosition);
  const dobWidth = pdf.getTextWidth(dobText);
  pdf.text(postcodeText, margin + nameWidth + dobWidth + 40, yPosition);
  yPosition += 20;

  // Referee Information
  ensureSpace(30);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee Name:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.referee.name || '', margin + 80, yPosition);
  yPosition += lineHeight + 2;
  
  if (data.referee.jobTitle) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Job Title:', margin + 200, yPosition - (lineHeight + 2));
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.referee.jobTitle, margin + 250, yPosition - (lineHeight + 2));
  }
  yPosition += 15;

  // Reference Type Specific Questions
  if (data.referenceType === 'employer') {
    // Employment Status
    ensureSpace(30);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Are you this person\'s current or previous employer?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.text('[ ] Current    [ ] Previous    [ ] Neither', margin, yPosition);
    yPosition += lineHeight + 2;

    // Relationship Description
    ensureSpace(25);
    pdf.setFont('helvetica', 'bold');
    pdf.text('What is your relationship to this person (e.g. "I am her/his manager")?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${data.referee.jobTitle || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 2;

    // Job Title
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Please state the person\'s job title:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${data.applicantPosition || 'Not provided'}`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Employment Dates
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Employment Period:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    const startDate = data.employmentFrom ? new Date(data.employmentFrom).toLocaleDateString() : 'Not provided';
    const endDate = data.employmentTo ? new Date(data.employmentTo).toLocaleDateString() : 'Not provided';
    pdf.text(`From ${startDate} to ${endDate}`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Attendance Record
    ensureSpace(25);
    pdf.setFont('helvetica', 'bold');
    pdf.text('How would you describe their recent attendance record?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.text('[X] Good    [ ] Average    [ ] Poor', margin, yPosition);
    yPosition += lineHeight + 5;

    // Reason for Leaving
    ensureSpace(30);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Why did the person leave your employment (if they are still employed, please write \'still', margin, yPosition);
    yPosition += lineHeight;
    pdf.text('employed\')?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${data.reasonForLeaving || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 2;
  } else {
    // Character reference specific content
    ensureSpace(40);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Do you know this person from outside employment or education?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.text('[X] Yes    [ ] No', margin, yPosition);
    yPosition += lineHeight + 5;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Please describe your relationship with this person, including how long you have known them:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText('Not provided', margin, yPosition, pageWidth - 2 * margin);
    yPosition += 5;
  }

  // Character qualities - Horizontal layout in 2 columns
  ensureSpace(60);
  pdf.setFont('helvetica', 'bold');
  pdf.text('In your opinion, which of the following describes this person (tick each that is true)?', margin, yPosition);
  yPosition += lineHeight + 3;

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

  pdf.setFont('helvetica', 'normal');
  
  // Display qualities in 2 columns - All selected
  const columnWidth = (pageWidth - 2 * margin) / 2;
  for (let i = 0; i < qualities.length; i += 2) {
    ensureSpace(8);
    
    // Left column quality
    pdf.text('[X]', margin, yPosition);
    pdf.text(qualities[i], margin + 10, yPosition);
    
    // Right column quality (if exists)
    if (i + 1 < qualities.length) {
      const rightStartX = margin + columnWidth;
      pdf.text('[X]', rightStartX, yPosition);
      pdf.text(qualities[i + 1], rightStartX + 10, yPosition);
    }
    
    yPosition += lineHeight;
  }

  yPosition += 4;
  pdf.setFont('helvetica', 'bold');
  pdf.text('If you did not tick one or more of the above, please tell us why here:', margin, yPosition);
  yPosition += lineHeight + 5;

  // Criminal Background Questions
  ensureSpace(80);
  pdf.setFont('helvetica', 'bold');
  yPosition = addWrappedText('The position this person has applied for involves working with vulnerable people. Are you aware of any convictions, cautions, reprimands or final warnings that the person may have received that are not \'protected\' as defined by the Rehabilitation of Offenders Act 1974 (Exceptions) Order 1975 (as amended in 2013 by SI 210 1198)?', margin, yPosition, pageWidth - 2 * margin);
  yPosition += 3;
  pdf.setFont('helvetica', 'normal');
  pdf.text('[ ] Yes    [X] No', margin, yPosition);
  yPosition += 8;

  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  yPosition = addWrappedText('To your knowledge, is this person currently the subject of any criminal proceedings (for example, charged or summoned but not yet dealt with) or any police investigation?', margin, yPosition, pageWidth - 2 * margin);
  yPosition += 3;
  pdf.setFont('helvetica', 'normal');
  pdf.text('[ ] Yes    [X] No', margin, yPosition);
  yPosition += 8;

  ensureSpace(30);
  pdf.setFont('helvetica', 'bold');
  pdf.text('If you answered \'yes\' to either of the two previous questions, please provide details:', margin, yPosition);
  yPosition += lineHeight + 5;

  ensureSpace(30);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Please tell us anything else about this person that you think we should know:', margin, yPosition);
  yPosition += lineHeight + 15;

  ensureSpace(25);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Please sign and date your reference here:', margin, yPosition);
  yPosition += 10;
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('Signature:', margin, yPosition);
  yPosition += lineHeight + 2;
  
  const dateLabel = data.referenceType === 'employer' ? 'Date: {R1_signed}' : 'Date: {R2_signed}';
  pdf.setFont('helvetica', 'bold');
  pdf.text(dateLabel, margin, yPosition);

  return pdf;
};