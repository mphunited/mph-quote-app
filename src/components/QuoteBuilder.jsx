import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { graphScopes } from '../authConfig'
import { getSalesperson, generateQuoteNumber } from '../quoteConfig'
import { sendEmailWithAttachment } from '../graphService'

// ─── brand colours ────────────────────────────────────────────────────────────
const NAVY  = [0, 40, 80]       // #002850
const AMBER = [220, 180, 30]    // #DCB41E
const WHITE = [255, 255, 255]
const DARK  = [25, 25, 25]
const MID   = [100, 100, 100]
const ROW_A = [214, 226, 241]
const ROW_B = [232, 239, 248]
const GRID  = [150, 170, 200]

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt$(n) {
  const v = parseFloat(n)
  if (isNaN(v)) return ''
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${parseInt(m)}/${parseInt(d)}/${y}`
}

function today() { return new Date().toISOString().split('T')[0] }

async function loadImageAsBase64(url) {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ─── PDF builder ──────────────────────────────────────────────────────────────
async function buildQuotePDF(form, lineItems, salesperson) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()   // 215.9
  const H = doc.internal.pageSize.getHeight()  // 279.4

  // ── top navy bar ──────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 9, 'F')

  // ── logo — TOP LEFT, used as-is (300×300 square) ─────────────────────────
  const LOGO = 48
  try {
    const logo = await loadImageAsBase64('/MPH_Logo.png')
    doc.addImage(logo, 'PNG', 10, 10, LOGO, LOGO)
  } catch {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY)
    doc.text('MPH United', 34, 35, { align: 'center' })
  }

  // ── QUOTE heading — RIGHT side ────────────────────────────────────────────
  doc.setFontSize(40); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('QUOTE', W - 14, 29, { align: 'right' })

  // ── Date / Quote # — RIGHT side ───────────────────────────────────────────
  const lxLbl = W - 82, lxVal = W - 12
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MID); doc.text('Date:', lxLbl, 39)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY)
  doc.text(fmtDate(form.quoteDate), lxVal, 39, { align: 'right' })
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.3)
  doc.line(lxLbl + 10, 40.5, lxVal, 40.5)

  doc.setFont('helvetica', 'normal'); doc.setTextColor(...MID)
  doc.text('Quote #:', lxLbl, 49)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY)
  doc.text(form.quoteNumber || '', lxVal, 49, { align: 'right' })
  doc.line(lxLbl + 18, 50.5, lxVal, 50.5)

  // ── salesperson block (left) ──────────────────────────────────────────────
  let sy = 63
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text(salesperson.name, 14, sy);      sy += 6
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text(salesperson.phone, 14, sy);     sy += 6
  doc.text(salesperson.email, 14, sy);     sy += 9
  doc.setFont('helvetica', 'bold')
  doc.text('MPH United', 14, sy);          sy += 5.5
  doc.setFont('helvetica', 'normal')
  doc.text('PO Box 1270', 14, sy);         sy += 5.5
  doc.text('Fairhope, AL 36532', 14, sy)

  // ── CUSTOMER DETAILS – two-column layout (right half) ─────────────────────
  const RX = 108         // right section start x
  const COL1 = RX
  const COL2 = RX + 48
  let cy = 59

  // Header — centered over both columns
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.setTextColor(...AMBER)
  doc.text('CUSTOMER DETAILS', (RX + W - 12) / 2, cy, { align: 'center' })
  doc.setDrawColor(...AMBER); doc.setLineWidth(0.5)
  doc.line(RX, cy + 1.5, W - 12, cy + 1.5)
  cy += 8

  const col1 = [
    ['Contact Name',   form.contactName],
    ['Contact Number', form.contactPhone],
    ['Email',          form.contactEmail],
  ]
  const col2 = [
    ['Company Name',    form.companyName],
    ['Address',         form.address],
    ['City, State, Zip', [form.city, [form.state, form.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
  ]

  const colW1 = COL2 - COL1 - 2
  const colW2 = W - 14 - COL2

  doc.setFontSize(7.5)
  for (let i = 0; i < 3; i++) {
    const ry = cy + i * 13.5
    // Column 1
    doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80)
    doc.text(col1[i][0].toUpperCase(), COL1, ry, {})
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK)
    const v1 = (col1[i][1] || '').trim()
    if (v1) doc.text(doc.splitTextToSize(v1, colW1)[0], COL1, ry + 5)
    doc.setDrawColor(210, 215, 220); doc.setLineWidth(0.2)
    doc.line(COL1, ry + 7, COL1 + colW1, ry + 7)
    // Column 2
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 80)
    doc.text(col2[i][0].toUpperCase(), COL2, ry)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK)
    const v2 = (col2[i][1] || '').trim()
    if (v2) doc.text(doc.splitTextToSize(v2, colW2)[0], COL2, ry + 5)
    doc.setDrawColor(210, 215, 220); doc.setLineWidth(0.2)
    doc.line(COL2, ry + 7, COL2 + colW2, ry + 7)
  }

  // ── line items table (dynamic rows + full grid) ───────────────────────────
  const tX = 11
  const tW = W - 22
  const rH = 8.5

  // Only show rows through the last filled one, minimum 3, max 8
  const lastFilled = lineItems.reduce((last, item, i) =>
    item.description?.trim() ? i : last, -1)
  const rowsToShow = Math.min(Math.max(lastFilled + 2, 3), 8)

  const tY = 110

  // Column definitions: x, width, label, text-align
  const COLS = [
    { x: tX,       w: 13,  label: 'ITEM',       align: 'center' },
    { x: tX + 13,  w: 95,  label: 'DESCRIPTION',align: 'left'   },
    { x: tX + 108, w: 18,  label: 'QTY',        align: 'center' },
    { x: tX + 126, w: 34,  label: 'UNIT PRICE', align: 'right'  },
    { x: tX + 160, w: tW - 160, label: 'TOTAL', align: 'right'  },
  ]

  // Header
  doc.setFillColor(...NAVY)
  doc.rect(tX, tY, tW, 9, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
  doc.setTextColor(...WHITE)
  for (const col of COLS) {
    const tx = col.align === 'center' ? col.x + col.w / 2
             : col.align === 'right'  ? col.x + col.w - 2
             :                          col.x + 2
    doc.text(col.label, tx, tY + 6.2, { align: col.align })
  }

  // Data rows
  doc.setFontSize(9)
  for (let i = 0; i < rowsToShow; i++) {
    const ry = tY + 9 + i * rH
    const item = lineItems[i] || {}
    doc.setFillColor(...(i % 2 === 0 ? ROW_A : ROW_B))
    doc.rect(tX, ry, tW, rH, 'F')

    if (item.description?.trim()) {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
      // Item #
      doc.text(String(i + 1), COLS[0].x + COLS[0].w / 2, ry + 5.8, { align: 'center' })
      // Description (truncate to fit)
      const desc = doc.splitTextToSize(item.description, COLS[1].w - 4)[0]
      doc.text(desc, COLS[1].x + 2, ry + 5.8)
      // Qty
      if (item.qty) doc.text(String(item.qty), COLS[2].x + COLS[2].w / 2, ry + 5.8, { align: 'center' })
      // Unit price + total
      const up = parseFloat(item.unitPrice)
      if (!isNaN(up) && up > 0) {
        doc.text(fmt$(up), COLS[3].x + COLS[3].w - 2, ry + 5.8, { align: 'right' })
        const qty = parseFloat(item.qty) || 0
        if (qty > 0)
          doc.text(fmt$(qty * up), COLS[4].x + COLS[4].w - 2, ry + 5.8, { align: 'right' })
      }
    }
  }

  // Grid borders
  const tableBottom = tY + 9 + rowsToShow * rH
  doc.setDrawColor(...GRID); doc.setLineWidth(0.25)
  // Outer rect
  doc.rect(tX, tY, tW, 9 + rowsToShow * rH, 'S')
  // Header separator
  doc.line(tX, tY + 9, tX + tW, tY + 9)
  // Row separators
  for (let i = 1; i < rowsToShow; i++) {
    const ly = tY + 9 + i * rH
    doc.line(tX, ly, tX + tW, ly)
  }
  // Column separators (skip first col left edge — handled by outer rect)
  for (let c = 1; c < COLS.length; c++) {
    doc.line(COLS[c].x, tY, COLS[c].x, tableBottom)
  }

  // ── Special Notes ─────────────────────────────────────────────────────────
  const nY = tableBottom + 6
  doc.setDrawColor(...DARK); doc.setLineWidth(0.35)
  doc.rect(tX, nY, 118, 25, 'S')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  doc.setTextColor(...MID)
  doc.text('Special Notes:', tX + 3, nY + 6)
  if (form.specialNotes?.trim()) {
    doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(form.specialNotes, 112)
    doc.text(lines.slice(0, 3), tX + 3, nY + 12)
  }

  // ── Footer: lead time text (left) + IBC composite image (right) ───────────
  // Anchor the footer block to the bottom of the page (just above the navy bar)
  // Text block total height: ~37mm; pin last line to H - 14
  const TEXT_BLOCK_H = 37   // approximate total height of text lines
  const fStart = H - 11 - 3 - TEXT_BLOCK_H   // start so text ends just above navy bar
  let fY = fStart

  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
  doc.text('Current Lead Time: ' + (form.leadTime || ''), tX, fY);           fY += 4.8
  doc.setFont('helvetica', 'italic')
  doc.text('New and Rebottle quoted with Standard Valve and Lid', tX, fY);   fY += 4.5
  doc.setFont('helvetica', 'normal')
  doc.text('New = New Bottle / New Cage', tX, fY);                           fY += 4.5
  doc.text('Rebottled = New Bottle / Reconditioned Cage', tX, fY);           fY += 4.5
  doc.text('Washout = Rinsed Bottle / Reconditioned Cage', tX, fY);          fY += 6
  doc.setFont('helvetica', 'bold')
  doc.text('MPH United Manufacturing and Recycling plants:', tX, fY);        fY += 4.5
  doc.setFont('helvetica', 'normal')
  doc.text('CA, GA, IA, IL, IN, KS, LA, MO, MS, OK, and TX.', tX, fY);     fY += 5.5
  doc.setTextColor(...NAVY)
  doc.text('https://www.mphunited.com', tX, fY)

  // IBC/Drum image — BOTTOM RIGHT, used as-is (273×169, ratio 1.6154)
  const ibcW = 76
  const ibcH = ibcW * (169 / 273)             // ≈ 47mm — native aspect ratio
  const ibcX = W - ibcW - 10                  // flush to right margin
  const ibcY = H - 11 - 4 - ibcH             // sits just above navy footer bar
  try {
    const ibc = await loadImageAsBase64('/IBCs_Drum.png')
    doc.addImage(ibc, 'PNG', ibcX, ibcY, ibcW, ibcH)
  } catch { /* skip if unavailable */ }

  // ── bottom navy bar ───────────────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, H - 11, W, 11, 'F')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.setTextColor(...WHITE)
  doc.text('[3/1/2026]', tX, H - 3.5)
  doc.setFont('helvetica', 'bolditalic'); doc.setTextColor(255, 100, 100)
  doc.text('Note: This quote is valid for 30 days.', W - tX, H - 3.5, { align: 'right' })

  return doc
}

// ─── small form components ────────────────────────────────────────────────────
function Field({ label, name, value, onChange, placeholder, type = 'text', required }) {
  return (
    <div>
      <label className="field-label">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type} name={name} className="field-input"
        value={value} onChange={onChange} placeholder={placeholder || ''}
      />
    </div>
  )
}

function Section({ title, children, accent }) {
  return (
    <div className={`rounded-xl border ${accent
      ? 'border-mph-amber/40 bg-amber-50/30'
      : 'border-gray-200 bg-white'} p-4 shadow-sm`}>
      <h3 className="text-sm font-bold text-mph-navy uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

const EMPTY_ITEM = { description: '', qty: '', unitPrice: '' }

// ─── main component ───────────────────────────────────────────────────────────
export default function QuoteBuilder({ userProfile, activeTab, onTabChange }) {
  const { instance, accounts } = useMsal()
  const userEmail = (
    userProfile?.mail || userProfile?.userPrincipalName || accounts[0]?.username || ''
  ).toLowerCase()
  const salesperson = getSalesperson(userEmail)

  const [form, setForm] = useState(() => ({
    quoteDate:    today(),
    quoteNumber:  generateQuoteNumber(salesperson?.firstLetter || 'X'),
    contactName:  '',
    contactPhone: '',
    contactEmail: '',
    companyName:  '',
    address:      '',
    city:         '',
    state:        '',
    zip:          '',
    leadTime:     '',
    specialNotes: '',
  }))

  const [lineItems, setLineItems] = useState(
    Array(8).fill(null).map(() => ({ ...EMPTY_ITEM }))
  )

  const [status,    setStatus]    = useState(null)
  const [emailSent, setEmailSent] = useState(false)

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleLineChange(index, field, value) {
    setLineItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function lineTotal(item) {
    const q = parseFloat(item.qty), p = parseFloat(item.unitPrice)
    return (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) ? q * p : null
  }

  function handleReset() {
    setForm({
      quoteDate:    today(),
      quoteNumber:  generateQuoteNumber(salesperson?.firstLetter || 'X'),
      contactName: '', contactPhone: '', contactEmail: '',
      companyName: '', address: '', city: '', state: '', zip: '',
      leadTime: '', specialNotes: '',
    })
    setLineItems(Array(8).fill(null).map(() => ({ ...EMPTY_ITEM })))
    setStatus(null); setEmailSent(false)
  }

  function buildFilename() {
    const co = (form.companyName || 'Quote').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')
    const qn = (form.quoteNumber || 'Q').replace(/[^a-zA-Z0-9-]/g, '')
    const d  = new Date(form.quoteDate + 'T12:00:00')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${co}_${qn}_${mm}-${dd}-${d.getFullYear()}`
  }

  function getSp() {
    return salesperson || {
      name: userProfile?.displayName || 'MPH United',
      phone: '', email: userEmail, firstLetter: 'X',
    }
  }

  async function handleDownload() {
    setStatus('generating')
    try {
      const doc = await buildQuotePDF(form, lineItems, getSp())
      doc.save(`${buildFilename()}.pdf`)
      setStatus(null)
    } catch (err) {
      console.error(err)
      setStatus({ error: `PDF generation failed: ${err.message}` })
    }
  }

  async function handleEmail() {
    setStatus('emailing')
    try {
      const sp  = getSp()
      const doc = await buildQuotePDF(form, lineItems, sp)
      const b64 = doc.output('datauristring').split(',')[1]
      const fn  = `${buildFilename()}.pdf`

      const tokenResponse = await instance.acquireTokenSilent({
        scopes: graphScopes.mail, account: accounts[0],
      })
      const subject = `MPH Quote — ${form.companyName || 'Customer'} — ${form.quoteNumber}`
      const html = `
        <p>Hi ${sp.name.split(' ')[0]},</p>
        <p>Your quote for <strong>${form.companyName || 'the customer'}</strong>
           (Quote #${form.quoteNumber}) is attached as a PDF.</p>
        <p style="color:#888;font-size:12px">
          Generated by MPH United Quote Builder · ${fmtDate(form.quoteDate)}</p>
      `
      await sendEmailWithAttachment(tokenResponse.accessToken, [userEmail], subject, html, fn, b64)
      setEmailSent(true); setStatus(null)
    } catch (err) {
      console.error(err)
      setStatus({ error: `Failed to send email: ${err.message}` })
    }
  }

  const sp = salesperson

  return (
    <div className="min-h-screen bg-mph-gray">

      {/* nav with tabs */}
      <nav className="bg-mph-navy text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded px-2 py-1">
            <img src="/MPH-Logo.png" alt="MPH United" className="h-7 object-contain" />
          </div>
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => onTabChange('calculator')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                activeTab === 'calculator'
                  ? 'bg-mph-amber text-mph-navy'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              📊 Sales Margins Calculator
            </button>
            <button
              onClick={() => onTabChange('quote')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                activeTab === 'quote'
                  ? 'bg-mph-amber text-mph-navy'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              📄 Create a Customer Quote
            </button>
          </div>
        </div>
        <div className="text-xs text-blue-200 text-right">
          <div>{userProfile?.displayName}</div>
          <div className="text-blue-300/70">{userProfile?.mail}</div>
        </div>
      </nav>

      {/* salesperson banner */}
      {sp && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 text-xs text-gray-600">
          <span className="font-semibold text-mph-navy">{sp.name}</span>
          <span>{sp.phone}</span>
          <span>{sp.email}</span>
          <span className="text-gray-400">· MPH United · PO Box 1270 · Fairhope, AL 36532</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* A: Quote Info */}
        <Section title="A · Quote Info">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Quote Date" name="quoteDate" type="date"
                   value={form.quoteDate} onChange={handleFormChange} required />
            <div>
              <label className="field-label">Quote Number</label>
              <input type="text" name="quoteNumber"
                className="field-input font-mono"
                value={form.quoteNumber} onChange={handleFormChange}
                placeholder="Auto-generated" />
            </div>
            <Field label="Current Lead Time" name="leadTime"
                   value={form.leadTime} onChange={handleFormChange}
                   placeholder="e.g. 2–3 weeks" />
          </div>
        </Section>

        {/* B: Customer Details */}
        <Section title="B · Customer Details" accent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Company Name"  name="companyName"  value={form.companyName}  onChange={handleFormChange} required placeholder="Customer company" />
            <Field label="Contact Name"  name="contactName"  value={form.contactName}  onChange={handleFormChange} placeholder="Full name" />
            <Field label="Contact Phone" name="contactPhone" value={form.contactPhone} onChange={handleFormChange} placeholder="555.123.4567" />
            <Field label="Contact Email" name="contactEmail" type="email" value={form.contactEmail} onChange={handleFormChange} placeholder="contact@company.com" />
            <Field label="Address"       name="address"      value={form.address}      onChange={handleFormChange} placeholder="Street address" />
            <div>{/* empty cell to keep grid aligned */}</div>
            {/* City / State / Zip on their own row */}
            <div className="sm:col-span-2 grid grid-cols-6 gap-3">
              <div className="col-span-3">
                <Field label="City" name="city" value={form.city} onChange={handleFormChange} placeholder="City" />
              </div>
              <div className="col-span-1">
                <Field label="State" name="state" value={form.state} onChange={handleFormChange} placeholder="AL" />
              </div>
              <div className="col-span-2">
                <Field label="Zip" name="zip" value={form.zip} onChange={handleFormChange} placeholder="00000" />
              </div>
            </div>
          </div>
        </Section>

        {/* C: Line Items */}
        <Section title="C · Line Items">
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-mph-navy text-white text-xs uppercase tracking-wide">
                  <th className="border border-mph-navy px-2 py-2 text-center w-10">#</th>
                  <th className="border border-mph-navy px-2 py-2 text-left">Description</th>
                  <th className="border border-mph-navy px-2 py-2 text-center w-20">Qty</th>
                  <th className="border border-mph-navy px-2 py-2 text-right w-28">Unit Price</th>
                  <th className="border border-mph-navy px-2 py-2 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => {
                  const total = lineTotal(item)
                  return (
                    <tr key={i} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-blue-50' : 'bg-white'}`}>
                      <td className="border border-gray-200 px-2 py-1 text-center text-gray-400 text-xs">{i + 1}</td>
                      <td className="border border-gray-200 px-2 py-1">
                        <input type="text" className="w-full border-0 bg-transparent focus:outline-none text-sm text-gray-800 placeholder-gray-300"
                          value={item.description}
                          onChange={e => handleLineChange(i, 'description', e.target.value)}
                          placeholder="Product description…" />
                      </td>
                      <td className="border border-gray-200 px-2 py-1">
                        <input type="number" className="w-full border-0 bg-transparent focus:outline-none text-sm text-center text-gray-800 placeholder-gray-300"
                          value={item.qty}
                          onChange={e => handleLineChange(i, 'qty', e.target.value)}
                          placeholder="0" min="0" step="any" />
                      </td>
                      <td className="border border-gray-200 px-2 py-1">
                        <input type="number" className="w-full border-0 bg-transparent focus:outline-none text-sm text-right text-gray-800 placeholder-gray-300"
                          value={item.unitPrice}
                          onChange={e => handleLineChange(i, 'unitPrice', e.target.value)}
                          placeholder="$0.00" min="0" step="any" />
                      </td>
                      <td className="border border-gray-200 px-2 py-1 text-right text-gray-700 font-medium text-sm">
                        {total !== null ? fmt$(total) : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* D: Special Notes */}
        <Section title="D · Special Notes">
          <textarea name="specialNotes" className="field-input min-h-[80px] resize-y"
            value={form.specialNotes} onChange={handleFormChange}
            placeholder="Any special notes, exceptions, or terms for this customer…" />
        </Section>

        {/* Status messages */}
        {status?.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {status.error}
          </div>
        )}
        {emailSent && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            ✅ Quote emailed to <strong>{userEmail}</strong>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pb-6">
          <button onClick={handleDownload}
            disabled={status === 'generating' || status === 'emailing'}
            className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
            {status === 'generating' ? '⏳ Building PDF…' : '⬇️ Download PDF'}
          </button>
          <button onClick={handleEmail}
            disabled={status === 'generating' || status === 'emailing'}
            className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
            {status === 'emailing' ? '⏳ Sending…' : '📧 Email to Me'}
          </button>
          <button onClick={handleReset}
            disabled={status === 'generating' || status === 'emailing'}
            className="btn-ghost flex-1 disabled:opacity-40">
            🔄 New Quote
          </button>
        </div>

      </div>
    </div>
  )
}
