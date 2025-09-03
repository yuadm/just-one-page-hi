import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import DejaVuSansRegularUrl from '@/assets/fonts/dejavu/DejaVuSans.ttf'
import DejaVuSansBoldUrl from '@/assets/fonts/dejavu/DejaVuSans-Bold.ttf'
import { format } from 'date-fns'

import type { ClientSpotCheckFormData } from '@/components/clients/ClientSpotCheckFormDialog'

interface CompanyInfo {
  name?: string
  logo?: string
}

export async function generateClientSpotCheckPdf(data: ClientSpotCheckFormData, company?: CompanyInfo) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  let page = doc.addPage()
  const regularBytes = await fetch(DejaVuSansRegularUrl).then(r => r.arrayBuffer())
  const boldBytes = await fetch(DejaVuSansBoldUrl).then(r => r.arrayBuffer())
  const font = await doc.embedFont(new Uint8Array(regularBytes), { subset: true })
  const boldFont = await doc.embedFont(new Uint8Array(boldBytes), { subset: true })

  // Try to embed company logo (optional)
  let embeddedLogo: any | undefined
  if (company?.logo) {
    try {
      const logoBytes = await fetch(company.logo).then(r => r.arrayBuffer())
      try {
        embeddedLogo = await doc.embedPng(logoBytes)
      } catch {
        embeddedLogo = await doc.embedJpg(logoBytes)
      }
    } catch {
      embeddedLogo = undefined
    }
  }

  const margin = 40
  const lineHeight = 16
  let y = page.getHeight() - margin

  const drawText = (text: string, opts?: { bold?: boolean; size?: number }) => {
    const f = opts?.bold ? boldFont : font
    const size = opts?.size ?? 11
    page.drawText(text ?? '', {
      x: margin,
      y: y - lineHeight,
      size,
      font: f,
      color: rgb(0, 0, 0),
    })
    y -= lineHeight
    return lineHeight
  }

  const drawCheckbox = (label: string, checked: boolean, x = margin) => {
    // Draw checkbox
    const boxSize = 8
    page.drawRectangle({
      x: x,
      y: y - lineHeight + 3,
      width: boxSize,
      height: boxSize,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    })
    
    if (checked) {
      page.drawText('✓', {
        x: x + 1,
        y: y - lineHeight + 2,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      })
    }
    
    // Draw label
    page.drawText(label, {
      x: x + boxSize + 5,
      y: y - lineHeight,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    })
    
    return boxSize + 5 + (label.length * 5)
  }

  const formatRatingValue = (value?: string) => {
    switch (value) {
      case 'poor': return 'Poor'
      case 'fair': return 'Fair' 
      case 'good': return 'Good'
      case 'very_good': return 'Very Good'
      case 'excellent': return 'Excellent'
      case 'not_applicable': return 'N/A'
      default: return 'Not Rated'
    }
  }

  const checkPageSpace = (requiredSpace: number = 60) => {
    if (y - requiredSpace < margin) {
      page = doc.addPage()
      y = page.getHeight() - margin
    }
  }

  // Header with logo and company name
  if (embeddedLogo) {
    const logoSize = 40
    page.drawImage(embeddedLogo, {
      x: margin,
      y: y - logoSize,
      width: logoSize,
      height: logoSize,
    })
    
    if (company?.name) {
      page.drawText(company.name, {
        x: margin + logoSize + 10,
        y: y - 20,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      })
    }
    
    y -= logoSize + 10
  } else if (company?.name) {
    page.drawText(company?.name, {
      x: margin,
      y: y - lineHeight,
      size: 14,
      font: boldFont,
      color: rgb(0, 0, 0),
    })
    y -= lineHeight + 10
  }

  // Title
  drawText('CLIENT SPOT CHECK FORM', { bold: true, size: 16 })
  y -= 10

  // Basic Information
  drawText('Service User Name: ' + (data.serviceUserName || 'N/A'), { bold: true })
  drawText('Care Workers: ' + (data.careWorkers || 'N/A'))
  drawText('Date: ' + (data.date || 'N/A'))
  drawText('Time: ' + (data.time || 'N/A'))
  drawText('Performed By: ' + (data.performedBy || 'N/A'))
  drawText('Completed By: ' + (data.completedBy || 'N/A'))
  
  y -= 20

  // Observations Section
  drawText('OBSERVATIONS & ASSESSMENTS', { bold: true, size: 14 })
  y -= 10

  // Process observations
  for (const observation of data.observations || []) {
    checkPageSpace(80)
    
    // Observation label
    const wrappedLabel = wrapText(observation.label, 65)
    for (let i = 0; i < wrappedLabel.length; i++) {
      drawText(wrappedLabel[i], { bold: true, size: 10 })
    }
    y -= 5

    // Rating options
    const ratings = ['poor', 'fair', 'good', 'very_good', 'excellent', 'not_applicable']
    const ratingLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent', 'N/A']
    
    let currentX = margin + 20
    const checkboxSpacing = 85
    
    for (let i = 0; i < ratings.length; i++) {
      if (i === 3) { // Start new line after "Good"
        y -= lineHeight + 5
        currentX = margin + 20
      }
      
      const isSelected = observation.value === ratings[i]
      drawCheckbox(ratingLabels[i], isSelected, currentX)
      currentX += checkboxSpacing
    }
    
    y -= lineHeight + 5

    // Comments section
    if (observation.comments && observation.comments.trim()) {
      drawText('Comments:', { bold: true, size: 9 })
      const wrappedComments = wrapText(observation.comments, 80)
      for (const line of wrappedComments) {
        drawText(line, { size: 9 })
      }
    } else {
      drawText('Comments: None', { size: 9 })
    }
    
    y -= 20
  }

  // Footer
  checkPageSpace(40)
  y -= 20
  drawText(`Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, { size: 9 })

  // Download the PDF
  const pdfBytes = await doc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `client-spot-check-${data.serviceUserName || 'form'}-${data.date || format(new Date(), 'yyyy-MM-dd')}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Helper function to wrap text
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  
  for (const word of words) {
    if ((currentLine + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) {
        lines.push(currentLine)
      }
      currentLine = word
    }
  }
  
  if (currentLine) {
    lines.push(currentLine)
  }
  
  return lines
}