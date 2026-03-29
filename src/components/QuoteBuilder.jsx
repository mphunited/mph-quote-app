import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { graphScopes } from '../authConfig'
import { getSalesperson, generateQuoteNumber } from '../quoteConfig'
import { sendEmailWithAttachment } from '../graphService'

// ─── colours matching MPH brand ───────────────────────────────────────────────
const NAVY  = [0, 40, 80]      // #002850
const AMBER = [220, 180, 30]   // #DCB41E
const WHITE = [255, 255, 255]
const DARK  = [30, 30, 30]
const MID   = [90, 90, 90]
const ROW_A = [214, 226, 241]  // light blue row tint A
const ROW_B = [229, 236, 247]  // light blue row tint B

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

function today() {
  return new Date().toISOString().split('T')[0]
}

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

// ─── PDF generator ────────────────────────────────────────────────────────────
async function buildQuotePDF(form, lineItems, salesperson) {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()   // 215.9
  const H = doc.internal.pageSize.getHeight()  // 279.4

  // ── top navy bar ────────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 9, 'F')

  // ── logo box ────────────────────────────────────────────────────
  doc.setFillColor(...WHITE)
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.3)
  doc.rect(10, 11, 58, 42, 'FD')
  try {
    const logo = await loadImageAsBase64('/MPH-Logo.png')
    doc.addImage(logo, 'PNG', 12, 13, 54, 38)
  } catch {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text('MPH United', 39, 33, { align: 'center' })
  }

  // ── QUOTE heading ───────────────────────────────────────────────
  doc.setFontSize(40)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('QUOTE', W - 14, 30, { align: 'right' })

  // ── Date / Quote # ──────────────────────────────────────────────
  const lineX1 = W - 82
  const lineX2 = W - 12
  // Date
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MID)
  doc.text('Date:', lineX1, 40)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY)
  doc.text(fmtDate(form.quoteDate), lineX2, 40, { align: 'right' })
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.3)
  doc.line(lineX1 + 10, 41.5, lineX2, 41.5)
  // Quote #
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MID)
  doc.text('Quote #:', lineX1, 50)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY)
  doc.text(form.quoteNumber || '', lineX2, 50, { align: 'right' })
  doc.line(lineX1 + 18, 51.5, lineX2, 51.5)

  // ── salesperson block (left) ────────────────────────────────────
  let sy = 62
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text(salesperson.name, 14, sy);     sy += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(salesperson.phone, 14, sy);    sy += 6
  doc.text(salesperson.email, 14, sy);    sy += 10
  doc.setFont('helvetica', 'bold')
  doc.text('MPH United', 14, sy);         sy += 6
  doc.setFont('helvetica', 'normal')
  doc.text('PO Box 1270', 14, sy);        sy += 6
  doc.text('Fairhope, AL 36532', 14, sy)

  // ── CUSTOMER DETAILS (right) ────────────────────────────────────
  const cx = W / 2 + 8   // right column start
  let cy = 59
  // Header label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...AMBER)
  doc.text('CUSTOMER DETAILS', W - 14, cy, { align: 'right' })
  doc.setDrawColor(...AMBER)
  doc.setLineWidth(0.5)
  doc.line(cx - 2, cy + 1.5, W - 12, cy + 1.5)
  cy += 8

  const custFields = [
    ['Contact Name',    form.contactName],
    ['Contact Number',  form.contactPhone],
    ['Email',           form.contactEmail],
    ['Company Name',    form.companyName],
    ['Address',         form.address],
    ['City, State, Zip',form.cityStateZip],
  ]

  doc.setFontSize(9.5)
  for (const [label, value] of custFields) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(label, W - 14, cy, { align: 'right' })
    if (value) {
      cy += 4.5
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...MID)
      doc.text(value, W - 14, cy, { align: 'right' })
      cy += 5.5
    } else {
      cy += 7
    }
  }

  // ── line items table ────────────────────────────────────────────
  const tY   = 108
  const tW   = W - 22   // table width
  const tX   = 11       // table left edge
  const rH   = 8        // row height
  const NUM_ROWS = 8

  // Column definitions: [label, xStart, width, align]
  const cols = [
    { label: 'ITEM',       x: tX,      w: 14,  align: 'center' },
    { label: 'DESCRIPTION',x: tX + 14, w: 92,  align: 'left'   },
    { label: 'QTY',        x: tX + 106,w: 20,  align: 'center' },
    { label: 'UNIT PRICE', x: tX + 126,w: 32,  align: 'right'  },
    { label: 'TOTAL',      x: tX + 158,w: tW - 158, align: 'right' },
  ]

  // Header row
  doc.setFillColor(...NAVY)
  doc.rect(tX, tY, tW, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...WHITE)
  for (const col of cols) {
    let tx
    if (col.align === 'center') tx = col.x + col.w / 2
    else if (col.align === 'right') tx = col.x + col.w - 2
    else tx = col.x + 2
    doc.text(col.label, tx, tY + 6.2, { align: col.align })
  }

  // Data rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (let i = 0; i < NUM_ROWS; i++) {
    const ry = tY + 9 + i * rH
    const item = lineItems[i] || {}
    doc.setFillColor(...(i % 2 === 0 ? ROW_A : ROW_B))
    doc.rect(tX, ry, tW, rH, 'F')

    if (item.description) {
      doc.setTextColor(...DARK)
      // Item #
      doc.text(String(i + 1), cols[0].x + cols[0].w / 2, ry + 5.5, { align: 'center' })
      // Description
      const descTrunc = doc.splitTextToSize(item.description, cols[1].w - 4)[0]
      doc.text(descTrunc, cols[1].x + 2, ry + 5.5)
      // Qty
      if (item.qty) doc.text(String(item.qty), cols[2].x + cols[2].w / 2, ry + 5.5, { align: 'center' })
      // Unit price
      const up = parseFloat(item.unitPrice)
      if (!isNaN(up) && up > 0) {
        doc.text(fmt$(up), cols[3].x + cols[3].w - 2, ry + 5.5, { align: 'right' })
        // Total
        const qty = parseFloat(item.qty) || 0
        if (qty > 0) {
          doc.text(fmt$(qty * up), cols[4].x + cols[4].w - 2, ry + 5.5, { align: 'right' })
        }
      }
    }
  }

  // ── Special Notes box ───────────────────────────────────────────
  const nY = tY + 9 + NUM_ROWS * rH + 6
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.4)
  doc.rect(tX, nY, 120, 28, 'S')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MID)
  doc.text('Special Notes:', tX + 3, nY + 6)
  if (form.specialNotes) {
    doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(form.specialNotes, 114)
    doc.text(lines.slice(0, 3), tX + 3, nY + 12)
  }

  // ── Footer / lead time text ─────────────────────────────────────
  let fY = nY + 34
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'normal')
  doc.text('Current Lead Time: ' + (form.leadTime || ''), tX, fY);  fY += 5
  doc.setFont('helvetica', 'italic')
  doc.text('New and Rebottle quoted with Standard Valve and Lid', tX, fY); fY += 5
  doc.setFont('helvetica', 'normal')
  doc.text('New = New Bottle / New Cage', tX, fY);                          fY += 5
  doc.text('Rebottled = New Bottle / Reconditioned Cage', tX, fY);          fY += 5
  doc.text('Washout = Rinsed Bottle / Reconditioned Cage', tX, fY);         fY += 8
  doc.setFont('helvetica', 'bold')
  doc.text('MPH United Manufacturing and Recycling plants:', tX, fY);       fY += 5
  doc.setFont('helvetica', 'normal')
  doc.text('CA, GA, IA, IL, IN, KS, LA, MO, MS, OK, and TX.', tX, fY);    fY += 6
  doc.setTextColor(...NAVY)
  doc.text('https://www.mphunited.com', tX, fY)

  // ── bottom navy bar ─────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, H - 11, W, 11, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...WHITE)
  doc.text('[Revised 12-16-2025]', tX, H - 3.5)
  doc.setFont('helvetica', 'bolditalic')
  doc.setTextColor(255, 100, 100)
  doc.text('Note: This quote is valid for 30 days.', W - tX, H - 3.5, { align: 'right' })

  return doc
}

// ─── form helpers ─────────────────────────────────────────────────────────────
function Field({ label, name, value, onChange, placeholder, type = 'text', required }) {
  return (
    <div>
      <label className="field-label">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        className="field-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder || ''}
      />
    </div>
  )
}

function Section({ title, children, accent }) {
  return (
    <div className={`rounded-xl border ${accent ? 'border-mph-amber/40 bg-amber-50/30' : 'border-gray-200 bg-white'} p-4 shadow-sm`}>
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
    cityStateZip: '',
    leadTime:     '',
    specialNotes: '',
  }))

  const [lineItems, setLineItems] = useState(
    Array(8).fill(null).map(() => ({ ...EMPTY_ITEM }))
  )

  const [status,   setStatus]   = useState(null)   // null | 'generating' | 'emailing' | 'sent' | { error }
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
    const q = parseFloat(item.qty)
    const p = parseFloat(item.unitPrice)
    if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) return q * p
    return null
  }

  function handleReset() {
    setForm({
      quoteDate:    today(),
      quoteNumber:  generateQuoteNumber(salesperson?.firstLetter || 'X'),
      contactName:  '',
      contactPhone: '',
      contactEmail: '',
      companyName:  '',
      address:      '',
      cityStateZip: '',
      leadTime:     '',
      specialNotes: '',
    })
    setLineItems(Array(8).fill(null).map(() => ({ ...EMPTY_ITEM })))
    setStatus(null)
    setEmailSent(false)
  }

  // ── build filename ──────────────────────────────────────────────
  function buildFilename() {
    const company = (form.companyName || 'Quote').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')
    const qn = (form.quoteNumber || 'Q').replace(/[^a-zA-Z0-9-]/g, '')
    const d = new Date(form.quoteDate + 'T12:00:00')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${company}_${qn}_${mm}-${dd}-${yyyy}`
  }

  // ── download PDF ────────────────────────────────────────────────
  async function handleDownload() {
    setStatus('generating')
    try {
      const doc = await buildQuotePDF(form, lineItems, salesperson || {
        name: userProfile?.displayName || 'MPH United',
        phone: '',
        email: userEmail,
        firstLetter: 'X',
      })
      doc.save(`${buildFilename()}.pdf`)
      setStatus(null)
    } catch (err) {
      console.error(err)
      setStatus({ error: `PDF generation failed: ${err.message}` })
    }
  }

  // ── email PDF ────────────────────────────────────────────────────
  async function handleEmail() {
    setStatus('emailing')
    try {
      const sp = salesperson || {
        name: userProfile?.displayName || 'MPH United',
        phone: '',
        email: userEmail,
        firstLetter: 'X',
      }
      const doc = await buildQuotePDF(form, lineItems, sp)
      const pdfBase64 = doc.output('datauristring').split(',')[1]
      const filename = `${buildFilename()}.pdf`
      const recipient = userEmail

      const account = accounts[0]
      const tokenResponse = await instance.acquireTokenSilent({
        scopes: graphScopes.mail,
        account,
      })

      const subject = `MPH Quote — ${form.companyName || 'Customer'} — ${form.quoteNumber}`
      const html = `
        <p>Hi ${sp.name.split(' ')[0]},</p>
        <p>Your quote for <strong>${form.companyName || 'the customer'}</strong> (Quote #${form.quoteNumber}) is attached as a PDF.</p>
        <p style="color:#888;font-size:12px">Generated by MPH United Quote Builder · ${fmtDate(form.quoteDate)}</p>
      `
      await sendEmailWithAttachment(tokenResponse.accessToken, [recipient], subject, html, filename, pdfBase64)
      setEmailSent(true)
      setStatus(null)
    } catch (err) {
      console.error(err)
      setStatus({ error: `Failed to send email: ${err.message}` })
    }
  }

  const sp = salesperson

  return (
    <div className="min-h-screen bg-mph-gray">

      {/* ── nav bar with tabs ───────────────────────────────────── */}
      <nav className="bg-mph-navy text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded px-2 py-1">
            <img src="/MPH-Logo.png" alt="MPH United" className="h-7 object-contain" />
          </div>
          {/* Tab buttons */}
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => onTabChange('calculator')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                activeTab === 'calculator'
                  ? 'bg-mph-amber text-mph-navy'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              📊 Margins
            </button>
            <button
              onClick={() => onTabChange('quote')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                activeTab === 'quote'
                  ? 'bg-mph-amber text-mph-navy'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              📄 Quote Builder
            </button>
          </div>
        </div>
        <div className="text-xs text-blue-200 text-right">
          <div>{userProfile?.displayName}</div>
          <div className="text-blue-300/70">{userProfile?.mail}</div>
        </div>
      </nav>

      {/* ── salesperson info banner ─────────────────────────────── */}
      {sp && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 text-xs text-gray-600">
          <span className="font-semibold text-mph-navy">{sp.name}</span>
          <span>{sp.phone}</span>
          <span>{sp.email}</span>
          <span className="text-gray-400">· MPH United · PO Box 1270 · Fairhope, AL 36532</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── A: Quote Info ─────────────────────────────────────── */}
        <Section title="A · Quote Info">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Quote Date" name="quoteDate" type="date" value={form.quoteDate} onChange={handleFormChange} required />
            <div>
              <label className="field-label">Quote Number</label>
              <input
                type="text"
                name="quoteNumber"
                className="field-input font-mono"
                value={form.quoteNumber}
                onChange={handleFormChange}
                placeholder="Auto-generated"
              />
            </div>
            <Field label="Current Lead Time" name="leadTime" value={form.leadTime} onChange={handleFormChange} placeholder="e.g. 2–3 weeks" />
          </div>
        </Section>

        {/* ── B: Customer Details ──────────────────────────────── */}
        <Section title="B · Customer Details" accent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Company Name" name="companyName"  value={form.companyName}  onChange={handleFormChange} required placeholder="Customer company" />
            <Field label="Contact Name" name="contactName"  value={form.contactName}  onChange={handleFormChange} placeholder="Full name" />
            <Field label="Contact Phone" name="contactPhone" value={form.contactPhone} onChange={handleFormChange} placeholder="555.123.4567" />
            <Field label="Contact Email" name="contactEmail" type="email" value={form.contactEmail} onChange={handleFormChange} placeholder="contact@company.com" />
            <Field label="Address"       name="address"      value={form.address}      onChange={handleFormChange} placeholder="Street address" />
            <Field label="City, State, Zip" name="cityStateZip" value={form.cityStateZip} onChange={handleFormChange} placeholder="City, ST 00000" />
          </div>
        </Section>

        {/* ── C: Line Items ─────────────────────────────────────── */}
        <Section title="C · Line Items">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-mph-navy text-white text-xs uppercase tracking-wide">
                  <th className="px-2 py-2 text-center w-10">#</th>
                  <th className="px-2 py-2 text-left">Description</th>
                  <th className="px-2 py-2 text-center w-20">Qty</th>
                  <th className="px-2 py-2 text-right w-28">Unit Price</th>
                  <th className="px-2 py-2 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => {
                  const total = lineTotal(item)
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                      <td className="px-2 py-1 text-center text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          className="w-full border-0 bg-transparent focus:outline-none text-sm text-gray-800 placeholder-gray-300"
                          value={item.description}
                          onChange={e => handleLineChange(i, 'description', e.target.value)}
                          placeholder="Product description…"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="w-full border-0 bg-transparent focus:outline-none text-sm text-center text-gray-800 placeholder-gray-300"
                          value={item.qty}
                          onChange={e => handleLineChange(i, 'qty', e.target.value)}
                          placeholder="0"
                          min="0"
                          step="any"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="w-full border-0 bg-transparent focus:outline-none text-sm text-right text-gray-800 placeholder-gray-300"
                          value={item.unitPrice}
                          onChange={e => handleLineChange(i, 'unitPrice', e.target.value)}
                          placeholder="$0.00"
                          min="0"
                          step="any"
                        />
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700 font-medium text-sm">
                        {total !== null ? fmt$(total) : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── D: Special Notes ──────────────────────────────────── */}
        <Section title="D · Special Notes">
          <textarea
            name="specialNotes"
            className="field-input min-h-[80px] resize-y"
            value={form.specialNotes}
            onChange={handleFormChange}
            placeholder="Any special notes, exceptions, or terms for this customer…"
          />
        </Section>

        {/* ── Status messages ───────────────────────────────────── */}
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

        {/* ── Action buttons ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 pb-6">
          <button
            onClick={handleDownload}
            disabled={status === 'generating' || status === 'emailing'}
            className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === 'generating' ? '⏳ Building PDF…' : '⬇️ Download PDF'}
          </button>
          <button
            onClick={handleEmail}
            disabled={status === 'generating' || status === 'emailing'}
            className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === 'emailing' ? '⏳ Sending…' : '📧 Email to Me'}
          </button>
          <button
            onClick={handleReset}
            disabled={status === 'generating' || status === 'emailing'}
            className="btn-ghost flex-1 disabled:opacity-40"
          >
            🔄 New Quote
          </button>
        </div>
      </div>
    </div>
  )
}
