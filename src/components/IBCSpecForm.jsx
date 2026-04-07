import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { graphScopes } from '../authConfig'
import { getSalesperson } from '../quoteConfig'
import { sendEmailWithAttachment } from '../graphService'

// ─── Brand colours (for PDF) ─────────────────────────────────────────────────
const NAVY  = [0, 40, 80]
const AMBER = [220, 180, 30]
const WHITE = [255, 255, 255]
const DARK  = [25, 25, 25]
const MID   = [100, 100, 100]
const ROW_A = [214, 226, 241]
const ROW_B = [232, 239, 248]

// ─── Dropdown option lists (from IBC SPEC ORDER FORM.docm) ───────────────────

const SHIPPING_OPTIONS = [
  'Frontline', 'CPU', 'RRG', '5 Star', 'RRG or Frontline', 'Great Plains',
  'STS', 'Four Seasons', 'Eagle Ford Containers', 'TBD', 'Texas Tote Works',
  'Oasis Freight Transport', 'SouthEast Container', 'United Container', 'APCO',
  'G & L Transport', 'Reconex', 'ENGY', 'UPS', 'AgTank', 'XPO LTL',
]

const SIZE_OPTIONS   = ['275 Gal', '330 Gal', '135 Gal']
const TYPE_OPTIONS   = ['Bottle', 'Rebottle IBC', 'Washout IBC', 'New IBC']

const VALVE_OPTIONS  = [
  'BV-AG QD', 'BV QD', 'BV NPT', 'BV BUTTRESS',
  'BVP QD (GJL-PLASTIC COLLAR)', 'BVP QD (Stainlez)',
  'BF QD', 'BF-GR QD', 'BF NPT',
  'ANY', 'ANY QD', 'ANY NPT',
]

// ─── Conditional Valve Gasket map ────────────────────────────────────────────
const VALVE_GASKET_MAP = {
  'BV-AG QD':                    ['VITON', 'PE', 'ANY'],
  'BV QD':                       ['VITON', 'EPDM', 'PE', 'ANY'],
  'BV NPT':                      ['VITON', 'EPDM', 'PE', 'ANY'],
  'BV BUTTRESS':                  ['EPDM', 'ANY'],
  'BVP QD (GJL-PLASTIC COLLAR)': ['VITON', 'ANY'],
  'BVP QD (Stainlez)':           ['PE', 'ANY'],
  'BF QD':                       ['PE', 'ANY'],
  'BF-GR QD':                    ['PE', 'ANY'],
  'BF NPT':                      ['PE', 'ANY'],
  'ANY':                         ['VITON', 'EPDM', 'ANY'],
  'ANY QD':                      ['ANY'],
  'ANY NPT':                     ['ANY'],
}

const LID_GASKET_OPTIONS = [
  '6" BLACK EPDM SOLID (NO BUNG)',
  '6" BLACK EPDM 2" NON-VENTED BUNG (NO CS)',
  '6" BLACK EPDM 2" NON-VENTED BUNG RED CS',
  '6" BLACK EPDM 2" AG BUNG (NO CS)',
  '6" BLACK EPDM 2" VENTED MICROPOROUS BUNG YELLOW CS',
  'ANY NON-VENTED',
  'ANY',
]

const PLACARD_OPTIONS = [
  'Placards(2)-PLASTIC FRONT AND BACK',
  'Placards(2)-METAL FRONT AND BACK',
  'Placards(2)-METAL FRONT PLASTIC BACK',
  'Placards(4)-METAL ALL FOUR SIDES',
  'Placards(4)-PLASTIC ALL FOUR SIDES',
  'Placards(4)-METAL FRONT & PLASTIC 3 SIDES',
  'Placards-ANY',
  'Placards(2)-ANY FRONT AND BACK',
  'Placard(1)-METAL FRONT (NO BACK)',
]

const PALLET_OPTIONS = [
  'Pallet-COMPOSITE OR STEEL',
  'Pallet-COMPOSITE ONLY',
  'Pallet-STEEL ONLY',
  'Pallet-PLASTIC ONLY',
  'Pallet-WOOD',
  'Pallet-ANY (EXCEPT NO WOOD)',
  'Pallet-ANY',
]

const UN_OPTIONS = ['UN', 'NON UN']
const TERMS_OPTIONS = ['Net 30 Days', 'Net 60 Days', 'COD', 'Prepay', 'Credit Card']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0] }

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${parseInt(m)}/${parseInt(d)}/${y}`
}

async function loadImageAsBase64(url) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ─── PDF builder ─────────────────────────────────────────────────────────────

async function buildIBCSpecPDF(form, salesperson) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()   // 215.9 mm

  // Top navy bar
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 9, 'F')

  // Logo
  const LOGO = 40
  try {
    const logo = await loadImageAsBase64('/MPH-Logo.png')
    if (logo) doc.addImage(logo, 'PNG', 10, 10, LOGO, LOGO)
  } catch { /* ignore */ }

  // Title
  doc.setFontSize(26); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY)
  doc.text('IBC SPEC ORDER FORM', W - 14, 25, { align: 'right' })
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MID)
  doc.text(`Date: ${fmtDate(form.date)}`, W - 14, 33, { align: 'right' })

  // Salesperson info under logo
  let sy = 55
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...DARK)
  doc.text(salesperson.name, 10 + LOGO / 2, sy, { align: 'center' }); sy += 5.5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(salesperson.phone, 10 + LOGO / 2, sy, { align: 'center' }); sy += 5
  doc.text(salesperson.email, 10 + LOGO / 2, sy, { align: 'center' }); sy += 5.5
  doc.setFont('helvetica', 'bold')
  doc.text('MPH United', 10 + LOGO / 2, sy, { align: 'center' }); sy += 5
  doc.setFont('helvetica', 'normal')
  doc.text('PO Box 1270', 10 + LOGO / 2, sy, { align: 'center' }); sy += 5
  doc.text('Fairhope, AL 36532', 10 + LOGO / 2, sy, { align: 'center' })

  // Divider line
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5)
  doc.line(10, 83, W - 10, 83)

  // ── Header row: Salesperson / PO / Customer / Shipping / Terms ──────────────
  const headerY = 87
  const colX = [10, 52, 94, 136, 166]
  const colW = [40, 40, 40, 28, 40]
  const hdrs = ['SALESPERSON', 'P.O. NUMBER', 'CUSTOMER', 'SHIPPING', 'TERMS']
  const vals = [
    salesperson.name,
    form.poNumber || '—',
    form.customer || '—',
    form.shipping || '—',
    form.terms || '—',
  ]

  doc.setFontSize(7); doc.setFont('helvetica', 'bold')
  doc.setFillColor(...NAVY)
  doc.rect(10, headerY - 4.5, W - 20, 6, 'F')
  doc.setTextColor(...WHITE)
  hdrs.forEach((h, i) => doc.text(h, colX[i] + 1, headerY, {}))

  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
  vals.forEach((v, i) => {
    const lines = doc.splitTextToSize(v, colW[i] - 2)
    doc.text(lines, colX[i] + 1, headerY + 6)
  })

  // ── PARTS table ──────────────────────────────────────────────────────────────
  const tableY = 107
  const labelColW = 38
  const valueColW = W - 20 - labelColW
  const rowH = 8
  const partRows = [
    ['SIZE',         form.size         || '—'],
    ['TYPE',         form.type         || '—'],
    ['VALVE',        form.valve        || '—'],
    ['VALVE GASKET', form.valveGasket  || '—'],
    ['LID & GASKET', form.lidGasket    || '—'],
    ['PLACARD',      form.placard      || '—'],
    ['PALLET',       form.pallet       || '—'],
    ['UN or NON UN', form.unType       || '—'],
  ]

  // Table header
  doc.setFillColor(...NAVY)
  doc.rect(10, tableY - 5, W - 20, 6, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE)
  doc.text('PARTS', 12, tableY - 0.5)
  doc.text('PARTS DESCRIPTION', 12 + labelColW + 2, tableY - 0.5)

  partRows.forEach(([label, value], idx) => {
    const rowY = tableY + idx * rowH
    const fill = idx % 2 === 0 ? ROW_A : ROW_B
    doc.setFillColor(...fill)
    doc.rect(10, rowY, W - 20, rowH, 'F')
    // Border
    doc.setDrawColor(200, 210, 220); doc.setLineWidth(0.2)
    doc.rect(10, rowY, W - 20, rowH)
    // Divider between label and value
    doc.line(10 + labelColW, rowY, 10 + labelColW, rowY + rowH)
    // Label
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY)
    doc.text(label, 12, rowY + 5.3)
    // Value
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(value, valueColW - 4)
    doc.text(lines[0], 12 + labelColW + 2, rowY + 5.3)
  })

  // ── Summary box ──────────────────────────────────────────────────────────────
  const sumY = tableY + partRows.length * rowH + 6
  doc.setFillColor(...NAVY)
  doc.rect(10, sumY, W - 20, 6, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE)
  doc.text('IBC SPEC SUMMARY', 12, sumY + 4.2)

  doc.setFillColor(...ROW_A)
  doc.rect(10, sumY + 6, W - 20, 10, 'F')
  doc.setDrawColor(200, 210, 220); doc.setLineWidth(0.2)
  doc.rect(10, sumY + 6, W - 20, 10)
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY)
  const summary = `Valve — ${form.valve || '—'} | Lid — ${form.lidGasket || '—'}`
  doc.text(summary, W / 2, sumY + 12.5, { align: 'center' })

  // ── Special Notes ─────────────────────────────────────────────────────────────
  if (form.specialNotes && form.specialNotes.trim()) {
    const notesY = sumY + 22
    doc.setFillColor(...NAVY)
    doc.rect(10, notesY, W - 20, 6, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE)
    doc.text('SPECIAL NOTES', 12, notesY + 4.2)
    doc.setFillColor(255, 255, 240)
    doc.rect(10, notesY + 6, W - 20, 20, 'F')
    doc.setDrawColor(200, 210, 220); doc.setLineWidth(0.2)
    doc.rect(10, notesY + 6, W - 20, 20)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
    const noteLines = doc.splitTextToSize(form.specialNotes, W - 28)
    doc.text(noteLines, 12, notesY + 12)
  }

  // ── Footer ────────────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 8
  doc.setFillColor(...NAVY)
  doc.rect(0, footerY - 2, W, 10, 'F')
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...WHITE)
  doc.text('MPH United · PO Box 1270 · Fairhope, AL 36532 · FORM REVISED 12-16-2025', W / 2, footerY + 3, { align: 'center' })

  return doc
}

// ─── Small reusable UI components ────────────────────────────────────────────

function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-bold text-mph-navy uppercase tracking-wider mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function TextInput({ label, value, onChange, placeholder, required, type = 'text' }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type}
        className="field-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder || ''}
      />
    </div>
  )
}

function SelectInput({ label, value, onChange, options, required, disabled }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <select
        className={`field-input ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        <option value="">— Select —</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-mph-navy uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

// ─── Nav tab helper (shared pattern) ─────────────────────────────────────────

function NavTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'calculator', label: '📊 Sales Margins Calculator' },
    { id: 'quote',      label: '📄 Create a Customer Quote' },
    { id: 'order',      label: '📋 Order Form for New Customers' },
    { id: 'ibcspec',    label: '🔧 IBC Spec Order Form' },
  ]
  return (
    <div className="flex gap-2 ml-3 flex-wrap">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`px-5 py-2.5 rounded text-sm font-bold transition-colors ${
            activeTab === t.id
              ? 'bg-mph-amber text-mph-navy'
              : 'bg-blue-500 text-white hover:bg-blue-400'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const EMPTY_FORM = {
  date:         today(),
  salesperson:  '',
  poNumber:     '',
  customer:     '',
  shipping:     '',
  terms:        'Net 30 Days',
  size:         '',
  type:         '',
  valve:        '',
  valveGasket:  '',
  lidGasket:    '',
  placard:      '',
  pallet:       '',
  unType:       '',
  specialNotes: '',
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IBCSpecForm({ userProfile, activeTab, onTabChange }) {
  const { instance, accounts } = useMsal()
  const userEmail = (userProfile?.mail || userProfile?.userPrincipalName || accounts[0]?.username || '').toLowerCase()

  const salesperson = getSalesperson(userEmail) || {
    name:  userProfile?.displayName || userEmail,
    phone: '',
    email: userEmail,
  }

  const [form,      setForm]      = useState({ ...EMPTY_FORM, salesperson: salesperson.name })
  const [status,    setStatus]    = useState(null)   // null | 'generating' | 'emailing' | {error}
  const [emailSent, setEmailSent] = useState(false)

  function handleChange(field) {
    return e => {
      const value = e.target.value
      setForm(prev => {
        const next = { ...prev, [field]: value }
        // When valve changes, reset gasket if current gasket not valid for new valve
        if (field === 'valve') {
          const allowed = VALVE_GASKET_MAP[value] || []
          if (!allowed.includes(prev.valveGasket)) {
            next.valveGasket = allowed.length === 1 ? allowed[0] : ''
          }
        }
        return next
      })
    }
  }

  function handleReset() {
    setForm({ ...EMPTY_FORM, salesperson: salesperson.name })
    setStatus(null)
    setEmailSent(false)
  }

  // Gasket options driven by selected valve
  const gasketOptions = form.valve ? (VALVE_GASKET_MAP[form.valve] || ['EPDM', 'ANY']) : []

  // ── Download PDF ─────────────────────────────────────────────────────────────
  async function handleDownload() {
    setStatus('generating')
    try {
      const doc = await buildIBCSpecPDF(form, salesperson)
      const customer = (form.customer || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')
      const dateStr  = form.date.replace(/-/g, '')
      doc.save(`IBC_Spec_${customer}_${dateStr}.pdf`)
      setStatus(null)
    } catch (err) {
      console.error(err)
      setStatus({ error: `PDF generation failed: ${err.message}` })
    }
  }

  // ── Email PDF to logged-in salesperson ───────────────────────────────────────
  async function handleEmail() {
    setStatus('emailing')
    try {
      const doc  = await buildIBCSpecPDF(form, salesperson)
      const b64  = doc.output('datauristring').split(',')[1]
      const customer = (form.customer || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')
      const dateStr  = form.date.replace(/-/g, '')
      const fn   = `IBC_Spec_${customer}_${dateStr}.pdf`

      const tokenResponse = await instance.acquireTokenSilent({
        scopes: graphScopes.mail,
        account: accounts[0],
      })

      const subject = `IBC Spec Order — ${form.customer || 'Customer'} — ${fmtDate(form.date)}`
      const html = `
        <p>Hi ${salesperson.name.split(' ')[0]},</p>
        <p>The IBC Spec Order Form for <strong>${form.customer || 'the customer'}</strong>
           is attached as a PDF.</p>
        <table style="border-collapse:collapse;font-size:13px;margin-top:12px">
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;color:#002850">Valve:</td>
              <td style="padding:4px 0">${form.valve || '—'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;color:#002850">Valve Gasket:</td>
              <td style="padding:4px 0">${form.valveGasket || '—'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;color:#002850">Lid &amp; Gasket:</td>
              <td style="padding:4px 0">${form.lidGasket || '—'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;color:#002850">Size:</td>
              <td style="padding:4px 0">${form.size || '—'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;color:#002850">Type:</td>
              <td style="padding:4px 0">${form.type || '—'}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:16px">
          Generated by MPH United IBC Spec Form · ${fmtDate(form.date)}</p>
      `
      await sendEmailWithAttachment(tokenResponse.accessToken, [userEmail], subject, html, fn, b64)
      setEmailSent(true)
      setStatus(null)
    } catch (err) {
      console.error(err)
      setStatus({ error: `Email failed: ${err.message}` })
    }
  }

  const busy = status === 'generating' || status === 'emailing'

  return (
    <div className="min-h-screen bg-mph-gray">

      {/* Nav */}
      <nav className="bg-mph-navy text-white px-6 py-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white rounded px-2 py-1">
            <img src="/MPH-Logo.png" alt="MPH United" className="h-10 object-contain" />
          </div>
          <NavTabs activeTab={activeTab} onTabChange={onTabChange} />
        </div>
        <div className="text-sm text-blue-200 text-right">
          <div className="font-semibold">{userProfile?.displayName}</div>
          <div className="text-blue-300/70 text-xs">{userProfile?.mail}</div>
        </div>
      </nav>

      {/* Salesperson strip */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 text-xs text-gray-600">
        <span className="font-semibold text-mph-navy">{salesperson.name}</span>
        {salesperson.phone && <span>{salesperson.phone}</span>}
        <span>{salesperson.email}</span>
        <span className="text-gray-400">· MPH United · PO Box 1270 · Fairhope, AL 36532</span>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── Section A: Order Info ───────────────────────────────────────────── */}
        <Section title="A · Order Info">
          <TextInput
            label="Date" value={form.date} required
            onChange={handleChange('date')} type="date"
          />
          <TextInput
            label="P.O. Number" value={form.poNumber}
            onChange={handleChange('poNumber')} placeholder="PO # Here"
          />
          <TextInput
            label="Customer" value={form.customer} required
            onChange={handleChange('customer')} placeholder="Customer name"
          />
          <SelectInput
            label="Shipping / Carrier" value={form.shipping}
            onChange={handleChange('shipping')} options={SHIPPING_OPTIONS}
          />
          <SelectInput
            label="Terms" value={form.terms}
            onChange={handleChange('terms')} options={TERMS_OPTIONS}
          />
        </Section>

        {/* ── Section B: IBC Specifications ──────────────────────────────────── */}
        <Section title="B · IBC Specifications">
          <SelectInput
            label="Size" value={form.size} required
            onChange={handleChange('size')} options={SIZE_OPTIONS}
          />
          <SelectInput
            label="Type" value={form.type} required
            onChange={handleChange('type')} options={TYPE_OPTIONS}
          />
          <SelectInput
            label="Valve" value={form.valve} required
            onChange={handleChange('valve')} options={VALVE_OPTIONS}
          />

          {/* Conditional Valve Gasket */}
          <div>
            <FieldLabel required>Valve Gasket</FieldLabel>
            {!form.valve ? (
              <div className="field-input bg-gray-50 text-gray-400 flex items-center text-sm cursor-not-allowed">
                Select a Valve first
              </div>
            ) : (
              <select
                className="field-input"
                value={form.valveGasket}
                onChange={handleChange('valveGasket')}
              >
                <option value="">— Select —</option>
                {gasketOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}
            {form.valve && gasketOptions.length === 1 && (
              <p className="text-xs text-gray-400 mt-1">
                Only EPDM is available for {form.valve}.
              </p>
            )}
          </div>

          <SelectInput
            label="Lid & Gasket" value={form.lidGasket} required
            onChange={handleChange('lidGasket')} options={LID_GASKET_OPTIONS}
          />
          <SelectInput
            label="Placard" value={form.placard}
            onChange={handleChange('placard')} options={PLACARD_OPTIONS}
          />
          <SelectInput
            label="Pallet" value={form.pallet}
            onChange={handleChange('pallet')} options={PALLET_OPTIONS}
          />
          <SelectInput
            label="UN or NON UN" value={form.unType}
            onChange={handleChange('unType')} options={UN_OPTIONS}
          />
        </Section>

        {/* ── Section C: Special Notes ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-mph-navy uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            C · Special Notes
          </h3>
          <textarea
            className="field-input min-h-[90px] resize-y"
            value={form.specialNotes}
            onChange={handleChange('specialNotes')}
            placeholder="Enter any special notes or instructions here…"
          />
        </div>

        {/* ── Summary strip ──────────────────────────────────────────────────── */}
        {(form.valve || form.lidGasket) && (
          <div className="bg-mph-navy text-white rounded-xl px-5 py-3 text-sm font-medium">
            <span className="text-mph-amber font-bold mr-2">IBC Spec Summary</span>
            Valve — {form.valve || '—'} &nbsp;|&nbsp; Lid — {form.lidGasket || '—'}
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-mph-navy uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
            Actions
          </h3>

          {status?.error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {status.error}
            </div>
          )}

          {emailSent && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              ✅ Email sent to {userEmail}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownload}
              disabled={busy}
              className="px-6 py-2.5 bg-mph-navy text-white text-sm font-bold rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {status === 'generating' ? '⏳ Generating…' : '⬇️ Download PDF'}
            </button>

            <button
              onClick={handleEmail}
              disabled={busy}
              className="px-6 py-2.5 bg-mph-amber text-mph-navy text-sm font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors"
            >
              {status === 'emailing' ? '⏳ Sending…' : '📧 Email to Me'}
            </button>

            <button
              onClick={handleReset}
              disabled={busy}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              🔄 Clear Form
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            "Email to Me" sends a PDF to {userEmail}.
          </p>
        </div>

      </div>
    </div>
  )
}
