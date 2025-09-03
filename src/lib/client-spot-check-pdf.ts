import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import DejaVuSansRegularUrl from '@/assets/fonts/dejavu/DejaVuSans.ttf'
import DejaVuSansBoldUrl from '@/assets/fonts/dejavu/DejaVuSans-Bold.ttf'
import { format } from 'date-fns'

interface CompanyInfo {
  name?: string
  logo?: string
}

interface ClientSpotCheckData {
  client_name?: string
  service_user_name?: string
  care_workers?: string[]
  date?: string
  time?: string
  performed_by?: string
  observations?: {
    label: string
    value: 'yes' | 'no' | 'na'
    comments?: string
  }[]
  period_identifier?: string
}

export async function generateClientSpotCheckPdf(data: ClientSpotCheckData, company?: CompanyInfo) {
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

  // Header (logo + centered titles + period)
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

    const title = 'Client Spot Check Report'
    const titleSize = 12
    const titleWidth = boldFont.widthOfTextAtSize(title, titleSize)
    page.drawText(title, { x: centerX - titleWidth / 2, y: cursorY - titleSize - 2, size: titleSize, font: boldFont, color: rgb(0,0,0) })
    cursorY -= titleSize + 8

    // Period identifier
    const periodText = data.period_identifier || format(new Date(), 'yyyy')
    const pSize = 11
    const pWidth = font.widthOfTextAtSize(periodText, pSize)
    page.drawText(periodText, { x: centerX - pWidth / 2, y: cursorY - pSize, size: pSize, font, color: rgb(0.6,0.6,0.6) })

    // Divider
    page.drawRectangle({ x: margin, y: page.getHeight() - headerHeight - 1, width: page.getWidth() - margin * 2, height: 1, color: rgb(0.85,0.85,0.85) })

    // Reset Y to below header
    y = page.getHeight() - headerHeight - 16
  }
  // draw it
  drawReportHeader()

  // Details
  drawText('A. Client Details', { bold: true, size: 13 })
  addSpacer(4)
  drawKeyVal("Client Name", data.client_name)
  drawKeyVal("Service User's Name", data.service_user_name)
  if (data.care_workers && data.care_workers.length > 0) {
    data.care_workers.forEach((worker, idx) => {
      drawKeyVal(`Care Worker ${idx + 1}`, worker)
    })
  }
  drawKeyVal('Date of Spot Check', data.date ? format(new Date(data.date), 'dd/MM/yyyy') : '')
  drawKeyVal('Time', data.time)
  drawKeyVal('Carried Out By', data.performed_by)

  addSpacer(10)
  drawText('B. Observations', { bold: true, size: 13 })
  addSpacer(6)

  // Table headers
  const tableX = margin
  // Responsive column widths: smaller Item column, compact Yes/No, larger Comments
  const availableWidth = page.getWidth() - margin * 2
  const colYes = 40
  const colNo = 40
  const colNA = 40
  const colItem = Math.max(180, Math.min(240, Math.floor(availableWidth * 0.30)))
  const colComments = availableWidth - (colItem + colYes + colNo + colNA)

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
    const yesX = tableX + colItem
    const noX = yesX + colYes
    const naX = noX + colNo
    const commentsX = naX + colNA

    page.drawText('Item', {
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
    centerHeader('Yes', yesX, colYes)
    centerHeader('No', noX, colNo)
    centerHeader('N/A', naX, colNA)

    // Comments header
    const commentsHeader = 'Observation/comments'
    const commentsHeaderSize =
      boldF.widthOfTextAtSize(commentsHeader, 11) <= colComments - cellPadX * 2 ? 11 : 10
    page.drawText(commentsHeader, {
      x: commentsX + cellPadX,
      y: y - headerHeight + 9,
      size: commentsHeaderSize,
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

  // initial table header
  drawTableHeader()

  if (data.observations && data.observations.length > 0) {
    data.observations.forEach((obs, i) => {
      const itemHeight = measureCellHeight(obs.label || '', colItem)
      const commentsHeight = measureCellHeight(obs.comments || '', colComments)
      let currentRowHeight = Math.max(itemHeight, commentsHeight, baseRowHeight)

      ensureSpace(currentRowHeight)

      if (i % 2 === 0) {
        page.drawRectangle({ x: tableX, y: y - currentRowHeight + 5, width: page.getWidth() - margin * 2, height: currentRowHeight, color: rgb(0.98,0.98,0.99) })
      }

      const itemLines = wrapText(obs.label || '', colItem)
      itemLines.forEach((line, idx) => {
        page.drawText(line, { x: tableX + cellPadX, y: y - cellPadY - (idx + 1) * lineHeight, size: textSize, font, color: rgb(0,0,0) })
      })

      const centerY = y - currentRowHeight / 2 - textSize / 2 + 4
      if (obs.value === 'yes') {
        const tw = font.widthOfTextAtSize('✔', textSize)
        page.drawText('✔', { x: tableX + colItem + (colYes - tw) / 2, y: centerY, size: textSize, font, color: rgb(0,0,0) })
      }
      if (obs.value === 'no') {
        const tw = font.widthOfTextAtSize('✔', textSize)
        page.drawText('✔', { x: tableX + colItem + colYes + (colNo - tw) / 2, y: centerY, size: textSize, font, color: rgb(0,0,0) })
      }
      if (obs.value === 'na') {
        const tw = font.widthOfTextAtSize('✔', textSize)
        page.drawText('✔', { x: tableX + colItem + colYes + colNo + (colNA - tw) / 2, y: centerY, size: textSize, font, color: rgb(0,0,0) })
      }

      const commentsLines = wrapText(obs.comments || '', colComments)
      commentsLines.forEach((line, idx) => {
        page.drawText(line, { x: tableX + colItem + colYes + colNo + colNA + cellPadX, y: y - cellPadY - (idx + 1) * lineHeight, size: textSize, font, color: rgb(0,0,0) })
      })

      y -= currentRowHeight
      page.drawRectangle({ x: tableX, y: y - 1 + 5, width: page.getWidth() - margin * 2, height: 1, color: rgb(0.92,0.92,0.92) })
    })
  }

  const bytes = await doc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const checkDate = data.date ? new Date(data.date) : new Date()
  const filename = `${data.client_name || 'Client'} ${data.period_identifier || checkDate.getFullYear()} spot check.pdf`
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}