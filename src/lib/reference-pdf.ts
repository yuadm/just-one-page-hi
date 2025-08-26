import jsPDF from 'jspdf';

interface ReferenceData {
  refereeFullName: string;
  refereeJobTitle: string;
  refereeCompany: string;
  refereeEmail: string;
  refereePhone: string;
  relationshipDuration: string;
  
  // Character reference specific
  personalQualities?: string;
  reliability?: string;
  integrity?: string;
  workEthic?: string;
  communication?: string;
  
  // Employer reference specific
  employmentDates?: string;
  jobPerformance?: string;
  attendance?: string;
  teamwork?: string;
  responsibilities?: string;
  reasonForLeaving?: string;
  rehireRecommendation?: string;
  
  // Common final fields
  overallRecommendation: string;
  additionalComments?: string;
  dateCompleted: string;
}

interface CompletedReference {
  id: string;
  reference_name: string;
  reference_type: string;
  form_data: ReferenceData;
  completed_at: string;
  application_id: string;
}

export const generateReferencePDF = (
  reference: CompletedReference,
  applicantName: string,
  companyName: string = 'Company Name'
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const lineHeight = 7;
  let yPosition = 30;

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
  pdf.text('Employment Reference', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  // Reference type and date
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  const referenceType = reference.reference_type === 'employer' ? 'Employer Reference' : 'Character Reference';
  pdf.text(`${referenceType} for ${applicantName}`, margin, yPosition);
  yPosition += 10;

  pdf.text(`Completed: ${new Date(reference.completed_at).toLocaleDateString()}`, margin, yPosition);
  yPosition += 15;

  // Referee Information Section
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee Information', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  
  const refereeInfo = [
    `Name: ${reference.form_data.refereeFullName}`,
    `Job Title: ${reference.form_data.refereeJobTitle}`,
    `Company: ${reference.form_data.refereeCompany}`,
    `Email: ${reference.form_data.refereeEmail}`,
    `Phone: ${reference.form_data.refereePhone}`,
    `Relationship Duration: ${reference.form_data.relationshipDuration}`
  ];

  refereeInfo.forEach(info => {
    pdf.text(info, margin, yPosition);
    yPosition += lineHeight;
  });

  yPosition += 10;

  // Reference Content
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Reference Details', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');

  if (reference.reference_type === 'employer') {
    // Employer reference specific content
    if (reference.form_data.employmentDates) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Employment Dates:', margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reference.form_data.employmentDates, margin + 80, yPosition);
      yPosition += lineHeight + 5;
    }

    if (reference.form_data.responsibilities) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Key Responsibilities:', margin, yPosition);
      yPosition += lineHeight;
      pdf.setFont('helvetica', 'normal');
      yPosition = addWrappedText(reference.form_data.responsibilities, margin, yPosition, pageWidth - 2 * margin);
      yPosition += 5;
    }

    if (reference.form_data.jobPerformance) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Job Performance:', margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reference.form_data.jobPerformance.charAt(0).toUpperCase() + reference.form_data.jobPerformance.slice(1), margin + 80, yPosition);
      yPosition += lineHeight + 5;
    }

    if (reference.form_data.attendance) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Attendance:', margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reference.form_data.attendance.charAt(0).toUpperCase() + reference.form_data.attendance.slice(1), margin + 80, yPosition);
      yPosition += lineHeight + 5;
    }

    if (reference.form_data.reasonForLeaving) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Reason for Leaving:', margin, yPosition);
      yPosition += lineHeight;
      pdf.setFont('helvetica', 'normal');
      yPosition = addWrappedText(reference.form_data.reasonForLeaving, margin, yPosition, pageWidth - 2 * margin);
      yPosition += 5;
    }

    if (reference.form_data.rehireRecommendation) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Would Rehire:', margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reference.form_data.rehireRecommendation.charAt(0).toUpperCase() + reference.form_data.rehireRecommendation.slice(1), margin + 80, yPosition);
      yPosition += lineHeight + 5;
    }
  } else {
    // Character reference specific content
    if (reference.form_data.personalQualities) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Personal Qualities:', margin, yPosition);
      yPosition += lineHeight;
      pdf.setFont('helvetica', 'normal');
      yPosition = addWrappedText(reference.form_data.personalQualities, margin, yPosition, pageWidth - 2 * margin);
      yPosition += 5;
    }

    const ratings = [
      { label: 'Reliability', value: reference.form_data.reliability },
      { label: 'Integrity', value: reference.form_data.integrity },
      { label: 'Communication', value: reference.form_data.communication }
    ];

    ratings.forEach(rating => {
      if (rating.value) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${rating.label}:`, margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(rating.value.charAt(0).toUpperCase() + rating.value.slice(1), margin + 80, yPosition);
        yPosition += lineHeight + 3;
      }
    });
  }

  // Overall Recommendation
  if (reference.form_data.overallRecommendation) {
    yPosition += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Overall Recommendation:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(reference.form_data.overallRecommendation, margin, yPosition, pageWidth - 2 * margin);
  }

  // Additional Comments
  if (reference.form_data.additionalComments) {
    yPosition += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Additional Comments:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(reference.form_data.additionalComments, margin, yPosition, pageWidth - 2 * margin);
  }

  // Footer
  yPosition = pdf.internal.pageSize.getHeight() - 30;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'italic');
  pdf.text('This reference was completed electronically and is digitally verified.', pageWidth / 2, yPosition, { align: 'center' });

  return pdf;
};