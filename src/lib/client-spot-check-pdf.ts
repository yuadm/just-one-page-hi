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

    const title = 'Service Quality Spot Check Report'
    const titleSize = 12
    const titleWidth = boldFont.widthOfTextAtSize(title, titleSize)
    page.drawText(title, { x: centerX - titleWidth / 2, y: cursorY - titleSize - 2, size: titleSize, font: boldFont, color: rgb(0,0,0) })
    cursorY -= titleSize + 8

    // Quarter and Year centered
    const d = data?.date ? new Date(data.date) : new Date()
    const q = Math.floor((d.getMonth()) / 3) + 1
    const qText = `Q${q} ${d.getFullYear()}`
    const qSize = 11
    const qWidth = font.widthOfTextAtSize(qText, qSize)
    page.drawText(qText, { x: centerX - qWidth / 2, y: cursorY - qSize, size: qSize, font, color: rgb(0.6,0.6,0.6) })

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
  drawKeyVal("Service User's Name", data.serviceUserName)
  drawKeyVal('Care Workers', data.careWorkers)
  drawKeyVal('Date of Spot Check', data.date)
  drawKeyVal('Time', data.time)
  drawKeyVal('Performed By', data.performedBy)
  drawKeyVal('Completed By', data.completedBy)

  addSpacer(10)
  drawText('B. Assessment Questions', { bold: true, size: 13 })
  addSpacer(6)

  // Table headers
  const tableX = margin
  // Responsive column widths: Assessment column, Rating column, larger Comments
  const availableWidth = page.getWidth() - margin * 2
  const colRating = 80
  const colAssessment = Math.max(200, Math.min(280, Math.floor(availableWidth * 0.40)))
  const colComments = availableWidth - (colAssessment + colRating)

  const textSize = 11
  const baseRowHeight = 24
  const cellPadX = 6
  const cellPadY = 6

  const wrapText = (text: string, width: number, f = font) => {
    const words = (text || '').split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = ''
    const maxWidth = width - cellPadX * 2

    const pushHardWrapped = (word: string) => {
      let remaining = word
      while (remaining.length > 0 && f.widthOfTextAtSize(remaining, textSize) > maxWidth) {
        let cut = Math.min(remaining.length, 50)
        while (cut > 1 && f.widthOfTextAtSize(remaining.slice(0, cut), textSize) > maxWidth) {
          cut--
        }
        lines.push(remaining.slice(0, cut))
        remaining = remaining.slice(cut)
      }
      if (remaining) {
        if (f.widthOfTextAtSize(remaining, textSize) <= maxWidth) {
          if (!line) line = remaining
          else if (f.widthOfTextAtSize(line + ' ' + remaining, textSize) <= maxWidth) line = line + ' ' + remaining
          else { lines.push(line); line = remaining }
        }
      }
    }

    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (f.widthOfTextAtSize(test, textSize) <= maxWidth) {
        line = test
      } else {
        if (!line) {
          pushHardWrapped(word)
        } else {
          lines.push(line)
          line = ''
          if (f.widthOfTextAtSize(word, textSize) <= maxWidth) {
            line = word
          } else {
            pushHardWrapped(word)
          }
        }
      }
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
  }

  const measureCellHeight = (text: string, width: number, f = font) => {
    const lines = wrapText(text, width, f)
    return Math.max(baseRowHeight, lines.length * lineHeight + cellPadY * 2)
  }

  const drawTableHeader = () => {
    const headerHeight = 30
    page.drawRectangle({
      x: tableX,
      y: y - headerHeight + 5,
      width: page.getWidth() - margin * 2,
      height: headerHeight,
      color: rgb(0.95, 0.96, 1),
    })
    const boldF = boldFont
    const ratingX = tableX + colAssessment
    const commentsX = ratingX + colRating

    page.drawText('Assessment Area', {
      x: tableX + cellPadX,
      y: y - headerHeight + 9,
      size: 11,
      font: boldF,
      color: rgb(0, 0, 0),
    })

    const centerHeader = (text: string, x: number, width: number) => {
      const size = 11
      const tw = boldF.widthOfTextAtSize(text, size)
      page.drawText(text, {
        x: x + (width - tw) / 2,
        y: y - headerHeight + 9,
        size,
        font: boldF,
        color: rgb(0, 0, 0),
      })
    }
    centerHeader('Rating', ratingX, colRating)

    page.drawText('Comments', {
      x: commentsX + cellPadX,
      y: y - headerHeight + 9,
      size: 11,
      font: boldF,
      color: rgb(0, 0, 0),
    })

    y -= headerHeight
    page.drawRectangle({
      x: tableX,
      y: y - 1 + 5,
      width: page.getWidth() - margin * 2,
      height: 1,
      color: rgb(0.92, 0.92, 0.92),
    })
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage()
      y = page.getHeight() - margin
      drawTableHeader()
    }
  }

  const formatRating = (rating?: string) => {
    switch (rating) {
      case 'poor': return 'Poor'
      case 'fair': return 'Fair'
      case 'good': return 'Good'
      case 'very_good': return 'Very Good'
      case 'excellent': return 'Excellent'
      case 'not_applicable': return 'N/A'
      default: return '-'
    }
  }

  // initial table header
  drawTableHeader()

  data.observations.forEach((obs, i) => {
    const assessmentHeight = measureCellHeight(obs.label || '', colAssessment)
    const commentsHeight = measureCellHeight(obs.comments || '', colComments)
    let currentRowHeight = Math.max(assessmentHeight, commentsHeight, baseRowHeight)

    ensureSpace(currentRowHeight)

    if (i % 2 === 0) {
      page.drawRectangle({ x: tableX, y: y - currentRowHeight + 5, width: page.getWidth() - margin * 2, height: currentRowHeight, color: rgb(0.98,0.98,0.99) })
    }

    const assessmentLines = wrapText(obs.label || '', colAssessment)
    assessmentLines.forEach((line, idx) => {
      page.drawText(line, { x: tableX + cellPadX, y: y - cellPadY - (idx + 1) * lineHeight, size: textSize, font, color: rgb(0,0,0) })
    })

    // Center the rating text
    const ratingText = formatRating(obs.value)
    const ratingWidth = font.widthOfTextAtSize(ratingText, textSize)
    const centerY = y - currentRowHeight / 2 - textSize / 2 + 4
    page.drawText(ratingText, { 
      x: tableX + colAssessment + (colRating - ratingWidth) / 2, 
      y: centerY, 
      size: textSize, 
      font, 
      color: rgb(0,0,0) 
    })

    const commentsLines = wrapText(obs.comments || '', colComments)
    commentsLines.forEach((line, idx) => {
      page.drawText(line, { x: tableX + colAssessment + colRating + cellPadX, y: y - cellPadY - (idx + 1) * lineHeight, size: textSize, font, color: rgb(0,0,0) })
    })

    y -= currentRowHeight
    page.drawRectangle({ x: tableX, y: y - 1 + 5, width: page.getWidth() - margin * 2, height: 1, color: rgb(0.92,0.92,0.92) })
  })

  const bytes = await doc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const checkDate = data.date ? new Date(data.date) : new Date()
  const quarter = Math.floor(checkDate.getMonth() / 3) + 1
  const filename = `${data.serviceUserName || 'Client'} Q${quarter} ${checkDate.getFullYear()} service quality spot check.pdf`
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}