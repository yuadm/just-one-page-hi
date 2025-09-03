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
  }

  const addSpacer = (amount = 8) => { y -= amount }

  const drawKeyVal = (label: string, value?: string) => {
    const labelText = `${label}: `
    const labelWidth = boldFont.widthOfTextAtSize(labelText, 11)
    page.drawText(labelText, { x: margin, y: y - lineHeight, size: 11, font: boldFont, color: rgb(0,0,0) })
    page.drawText(String(value ?? ''), { x: margin + labelWidth, y: y - lineHeight, size: 11, font, color: rgb(0,0,0) })
    y -= lineHeight
  }

  // Header (logo + centered titles + quarter/year)
  const drawReportHeader = () => {
    const headerHeight = embeddedLogo ? 120 : 100
    // background
    page.drawRectangle({ x: 0, y: page.getHeight() - headerHeight, width: page.getWidth(), height: headerHeight, color: rgb(0.98, 0.98, 0.985) })
    const centerX = page.getWidth() / 2
    let cursorY = page.getHeight() - 16

    if (embeddedLogo) {
      const logoW = 56
      const logoH = (embeddedLogo.height / embeddedLogo.width) * logoW
      const logoX = centerX - logoW / 2
      const logoY = page.getHeight() - headerHeight + headerHeight - logoH - 8
      page.drawImage(embeddedLogo, { x: logoX, y: logoY, width: logoW, height: logoH })
      cursorY = logoY - 6
    }

    const companyName = company?.name || 'Company'
    const companySize = 13
    const companyWidth = boldFont.widthOfTextAtSize(companyName, companySize)
    page.drawText(companyName, { x: centerX - companyWidth / 2, y: cursorY - companySize, size: companySize, font: boldFont, color: rgb(0,0,0) })
    cursorY -= companySize + 2

    const title = 'Service Quality Spot Check'
    const titleSize = 12
    const titleWidth = boldFont.widthOfTextAtSize(title, titleSize)
    page.drawText(title, { x: centerX - titleWidth / 2, y: cursorY - titleSize - 2, size: titleSize, font: boldFont, color: rgb(0,0,0) })
    cursorY -= titleSize + 8

    // Date centered
    const d = data?.date ? new Date(data.date) : new Date()
    const dateText = format(d, 'dd/MM/yyyy')
    const dateSize = 11
    const dateWidth = font.widthOfTextAtSize(dateText, dateSize)
    page.drawText(dateText, { x: centerX - dateWidth / 2, y: cursorY - dateSize, size: dateSize, font, color: rgb(0.6,0.6,0.6) })

    // Divider
    page.drawRectangle({ x: margin, y: page.getHeight() - headerHeight - 1, width: page.getWidth() - margin * 2, height: 1, color: rgb(0.85,0.85,0.85) })

    // Reset Y to below header
    y = page.getHeight() - headerHeight - 16
  }
  // draw it
  drawReportHeader()

  // Details
  drawText('A. Details', { bold: true, size: 13 })
  addSpacer(4)
  drawKeyVal("Service User Name", data.serviceUserName)
  drawKeyVal('Care Workers', data.careWorkers)
  drawKeyVal('Date', data.date)
  drawKeyVal('Time', data.time)
  drawKeyVal('Performed By', data.performedBy)
  drawKeyVal('Completed By', data.completedBy)

  addSpacer(10)
  drawText('B. Assessment Questions', { bold: true, size: 13 })
  addSpacer(6)

  // For each observation, create a paragraph style entry
  data.observations.forEach((obs, i) => {
    // Ensure space for the observation
    const estimatedHeight = 60 // Estimate based on typical content
    if (y - estimatedHeight < margin) {
      page = doc.addPage()
      y = page.getHeight() - margin
    }

    // Question number and text
    drawText(`${i + 1}. ${obs.label}`, { bold: true })
    addSpacer(2)
    
    // Rating
    const ratingDisplay = obs.value ? obs.value.replace('_', ' ').toUpperCase() : 'NOT ANSWERED'
    drawKeyVal('Rating', ratingDisplay)
    
    // Comments if available
    if (obs.comments) {
      drawText('Comments:', { bold: true })
      addSpacer(2)
      
      // Wrap comments text
      const maxWidth = page.getWidth() - margin * 2
      const words = obs.comments.split(' ')
      let currentLine = ''
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const lineWidth = font.widthOfTextAtSize(testLine, 11)
        
        if (lineWidth <= maxWidth) {
          currentLine = testLine
        } else {
          if (currentLine) {
            page.drawText(currentLine, {
              x: margin,
              y: y - lineHeight,
              size: 11,
              font,
              color: rgb(0, 0, 0),
            })
            y -= lineHeight
          }
          currentLine = word
        }
      }
      
      if (currentLine) {
        page.drawText(currentLine, {
          x: margin,
          y: y - lineHeight,
          size: 11,
          font,
          color: rgb(0, 0, 0),
        })
        y -= lineHeight
      }
    }
    
    addSpacer(8) // Space between observations
  })

  const bytes = await doc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const checkDate = data.date ? new Date(data.date) : new Date()
  const filename = `${data.serviceUserName || 'Client'} ${format(checkDate, 'yyyy-MM-dd')} quality spot check.pdf`
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}