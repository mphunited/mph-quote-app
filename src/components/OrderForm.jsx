import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { graphScopes } from '../authConfig'
import { sendQuoteEmail } from '../graphService'

const MAX_IBC_ROWS = 7
const EMPTY_IBC_ROW = { qty: '', spec: '' }

// ── Small reusable field components ─────────────────────────────────────────

function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-bold text-mph-navy uppercase tracking-wider mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
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

function SelectInput({ label, value, onChange, options, required }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <select className="field-input" value={value} onChange={onChange}>
        <option value="">— Select —</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

function Section({ title, children, fullGrid = false }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-mph-navy uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
        {title}
      </h3>
      {fullGrid ? children : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Empty form state ─────────────────────────────────────────────────────────

const EMPTY = {
  customerName:          '',
  vendorName:            '',
  ibcRows:               [{ qty: '', spec: '' }],
  emptiesBack:           '',
  specialNotes:          '',
  customerPO:            '',
  buyPrice:              '',
  sellPrice:             '',
  deliveredPrice:        '',
  freightBillCustomer:   '',
  shipToCompany:         '',
  shipToAddress:         '',
  shipToCityStateZip:    '',
  receivingInfo:         '',
  receivingContactName:  '',
  receivingContactPhone: '',
  freightDesc:           '',
  carrierBillTo:         '',
  freightPriceToMPH:     '',
  deliveryDates:         '',
  confirmContact:        '',
  confirmEmail:          '',
  confirmPhone:          '',
  billToCompany:         '',
  billToAddress:         '',
  billToCityStateZip:    '',
  billToContact:         '',
  billToEmail:           '',
  billToPhone:           '',
}

// ── Email HTML builder ───────────────────────────────────────────────────────

function buildEmailHtml(form, senderName) {
  const row = (label, value) =>
    value
      ? `<tr>
           <td style="padding:6px 12px;font-weight:600;color:#002850;white-space:nowrap;width:220px;vertical-align:top">${label}</td>
           <td style="padding:6px 12px;color:#333">${value}</td>
         </tr>`
      : ''

  const sectionHeader = title =>
    `<tr><td colspan="2" style="padding:16px 12px 4px;font-size:12px;font-weight:700;color:#ffffff;background:#002850;text-transform:uppercase;letter-spacing:0.08em">${title}</td></tr>`

  // Build IBC rows table
  const filledIbcRows = form.ibcRows.filter(r => r.qty || r.spec)
  const ibcTable = filledIbcRows.length
    ? `<tr>
         <td colspan="2" style="padding:6px 12px">
           <table style="width:100%;border-collapse:collapse;font-size:13px">
             <thead>
               <tr style="background:#f0f4f8">
                 <th style="padding:4px 8px;text-align:left;color:#002850;font-weight:700;border:1px solid #dde3ea;width:120px">Qty</th>
                 <th style="padding:4px 8px;text-align:left;color:#002850;font-weight:700;border:1px solid #dde3ea">SPEC Description</th>
               </tr>
             </thead>
             <tbody>
               ${filledIbcRows.map(r => `
                 <tr>
                   <td style="padding:4px 8px;border:1px solid #dde3ea">${r.qty || '—'}</td>
                   <td style="padding:4px 8px;border:1px solid #dde3ea">${r.spec || '—'}</td>
                 </tr>`).join('')}
             </tbody>
           </table>
         </td>
       </tr>`
    : row('IBC Lines', '(none entered)')

  return `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#f5f7fa;padding:20px">
      <div style="background:#002850;padding:16px 24px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:16px">
        <div style="background:#DCB41E;color:#002850;font-weight:900;font-size:18px;padding:6px 14px;border-radius:4px">MPH</div>
        <div style="color:white;font-size:18px;font-weight:700">New Customer Order Form</div>
      </div>
      <div style="background:#DCB41E;padding:6px 24px">
        <span style="color:#002850;font-size:12px;font-weight:700">Submitted by: ${senderName}</span>
      </div>
      <table style="width:100%;background:#ffffff;border-collapse:collapse;border-radius:0 0 8px 8px;overflow:hidden">
        ${sectionHeader('Order Details')}
        ${row('Customer Name', form.customerName)}
        ${row('Vendor Name', form.vendorName)}
        <tr><td colspan="2" style="padding:4px 12px;font-size:11px;font-weight:700;color:#002850;text-transform:uppercase;letter-spacing:0.05em">IBC Lines</td></tr>
        ${ibcTable}
        ${row('Empties Coming Back', form.emptiesBack)}
        ${row('Customer PO(s)', form.customerPO)}
        ${row('Buy Price', form.buyPrice ? `$${form.buyPrice}` : '')}
        ${row('Sell Price', form.sellPrice ? `$${form.sellPrice}` : '')}
        ${row('Delivered Price', form.deliveredPrice)}
        ${row('Freight Line Bill to Customer', form.freightBillCustomer ? `$${form.freightBillCustomer}` : '')}
        ${row('Special Notes', form.specialNotes)}

        ${sectionHeader('Ship To')}
        ${row('Company Name', form.shipToCompany)}
        ${row('Street Address', form.shipToAddress)}
        ${row('City, State, Zip', form.shipToCityStateZip)}
        ${row('Receiving Information', form.receivingInfo)}
        ${row('Contact Name', form.receivingContactName)}
        ${row('Contact Phone', form.receivingContactPhone)}

        ${sectionHeader('Freight')}
        ${row('Freight Description', form.freightDesc)}
        ${row('Carrier Bill To', form.carrierBillTo)}
        ${row('Freight Price to MPH', form.freightPriceToMPH ? `$${form.freightPriceToMPH}` : '')}
        ${row('Delivery Date(s)', form.deliveryDates)}
        ${row('Order Confirmation Contact', form.confirmContact)}
        ${row('Confirmation Email', form.confirmEmail)}
        ${row('Confirmation Phone', form.confirmPhone)}

        ${sectionHeader('Bill To')}
        ${row('Company Name', form.billToCompany)}
        ${row('Street Address', form.billToAddress)}
        ${row('City, State, Zip', form.billToCityStateZip)}
        ${row('Contact Name', form.billToContact)}
        ${row('Email', form.billToEmail)}
        ${row('Phone', form.billToPhone)}
      </table>
      <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px">
        MPH United · PO Box 1270 · Fairhope, AL 36532 · Generated by the MPH Sales App
      </p>
    </div>
  `
}

// ── Main component ───────────────────────────────────────────────────────────

export default function OrderForm({ userProfile, activeTab, onTabChange }) {
  const { instance, accounts } = useMsal()

  const [form, setForm]           = useState(EMPTY)
  const [sending, setSending]     = useState(false)
  const [sent, setSent]           = useState(false)
  const [sendError, setSendError] = useState(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [extraEmail, setExtraEmail]       = useState('')

  function field(key) {
    return {
      value: form[key],
      onChange: e => setForm(prev => ({ ...prev, [key]: e.target.value })),
    }
  }

  // ── IBC row helpers ──────────────────────────────────────────────────────

  function updateIbcRow(index, col, value) {
    setForm(prev => {
      const rows = [...prev.ibcRows]
      rows[index] = { ...rows[index], [col]: value }
      return { ...prev, ibcRows: rows }
    })
  }

  function addIbcRow() {
    setForm(prev => ({
      ...prev,
      ibcRows: [...prev.ibcRows, { ...EMPTY_IBC_ROW }],
    }))
  }

  function removeIbcRow(index) {
    setForm(prev => ({
      ...prev,
      ibcRows: prev.ibcRows.filter((_, i) => i !== index),
    }))
  }

  // ── Send ─────────────────────────────────────────────────────────────────

  function handleOpenSendModal() {
    if (!form.customerName.trim()) {
      setSendError('Customer Name is required.')
      return
    }
    setSendError(null)
    setExtraEmail('')
    setShowSendModal(true)
  }

  async function handleConfirmSend() {
    setShowSendModal(false)
    setSending(true)
    try {
      const tokenResponse = await instance.acquireTokenSilent({
        scopes: graphScopes.mail,
        account: accounts[0],
      })

      const salespersonEmail = userProfile?.mail || userProfile?.userPrincipalName
      const recipients = []
      if (salespersonEmail) recipients.push(salespersonEmail)
      if (extraEmail.trim()) recipients.push(extraEmail.trim())

      const subject = `New Customer Order – ${form.customerName || 'Unknown Customer'}`
      const html = buildEmailHtml(form, userProfile?.displayName || salespersonEmail)

      await sendQuoteEmail(tokenResponse.accessToken, recipients, subject, html)

      setSent(true)
      setForm(EMPTY)
      setExtraEmail('')
    } catch (err) {
      console.error('Order email failed:', err)
      setSendError('Failed to send order. Please try again or contact IT.')
    } finally {
      setSending(false)
    }
  }

  function handleReset() {
    setForm(EMPTY)
    setSent(false)
    setSendError(null)
  }

  // ── Nav bar ───────────────────────────────────────────────────────────────

  const tabBtn = (tabKey, label, icon) => (
    <button
      onClick={() => onTabChange?.(tabKey)}
      className={`px-5 py-2.5 rounded text-sm font-bold transition-colors ${
        activeTab === tabKey
          ? 'bg-mph-amber text-mph-navy'
          : 'bg-blue-500 text-white hover:bg-blue-400'
      }`}
    >
      {icon} {label}
    </button>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top nav */}
      <nav className="bg-mph-navy text-white px-6 py-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white rounded px-2 py-1">
            <img src="/MPH_Logo.png" alt="MPH United" className="h-10 object-contain" />
          </div>
          <div className="flex gap-2 ml-3 flex-wrap">
            {tabBtn('calculator', 'Sales Margins Calculator', '📊')}
            {tabBtn('quote',      'Create a Customer Quote',  '📄')}
            {tabBtn('order',      'Order Form for New Customers', '📋')}
            {tabBtn('ibcspec',    'IBC Spec Order Form',          '🔧')}
          </div>
        </div>
        <div className="text-sm text-blue-200 text-right">
          <div className="font-semibold">{userProfile?.displayName}</div>
          <div className="text-blue-300/70 text-xs">{userProfile?.mail}</div>
        </div>
      </nav>

      {/* Page content */}
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-mph-navy">Order Form for New Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Fill in the order details below and click <strong>Send Order</strong>. The completed form will be emailed to you.
          </p>
        </div>

        {/* Success banner */}
        {sent && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-green-800 font-semibold">✅ Order sent successfully!</p>
              <p className="text-green-700 text-sm mt-0.5">A copy was emailed to you.</p>
            </div>
            <button
              onClick={handleReset}
              className="ml-4 px-4 py-2 bg-mph-navy text-white text-sm font-bold rounded hover:bg-blue-900 transition-colors"
            >
              New Order
            </button>
          </div>
        )}

        {/* Error banner */}
        {sendError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-6">
            <p className="text-red-700 text-sm font-semibold">⚠️ {sendError}</p>
          </div>
        )}

        <div className="space-y-5">

          {/* ── Order Details ── */}
          <Section title="Order Details" fullGrid>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Customer Name" required {...field('customerName')} placeholder="Customer company name" />
              <TextInput label="Vendor Name" {...field('vendorName')} placeholder="e.g. RRG, Clean Environmental" />
              <SelectInput label="Empties Coming Back" {...field('emptiesBack')} options={['Yes', 'No']} />
              <SelectInput label="Delivered Price" {...field('deliveredPrice')} options={['Yes', 'No']} />
              <TextInput label="Customer PO(s)" {...field('customerPO')} placeholder="PO number(s)" />
              <TextInput label="Buy Price ($)" type="number" {...field('buyPrice')} placeholder="0.00" />
              <TextInput label="Sell Price ($)" type="number" {...field('sellPrice')} placeholder="0.00" />
              <TextInput label="Freight Line Bill to Customer ($)" type="number" {...field('freightBillCustomer')} placeholder="0.00" />
            </div>

            {/* IBC Lines sub-table */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <FieldLabel>IBC Lines (Qty &amp; SPEC Description)</FieldLabel>
                {form.ibcRows.length < MAX_IBC_ROWS && (
                  <button
                    type="button"
                    onClick={addIbcRow}
                    className="text-xs font-bold text-mph-navy border border-mph-navy rounded px-2 py-1 hover:bg-mph-navy hover:text-white transition-colors"
                  >
                    + Add Line
                  </button>
                )}
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[80px_1fr_32px] gap-2 mb-1 px-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SPEC Description</span>
                <span />
              </div>

              <div className="space-y-2">
                {form.ibcRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[80px_1fr_32px] gap-2 items-center">
                    <input
                      type="number"
                      className="field-input text-center"
                      value={row.qty}
                      onChange={e => updateIbcRow(i, 'qty', e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                    <input
                      type="text"
                      className="field-input"
                      value={row.spec}
                      onChange={e => updateIbcRow(i, 'spec', e.target.value)}
                      placeholder="e.g. 275 Gal IBC, Rebottle"
                    />
                    {form.ibcRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeIbcRow(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none font-bold"
                        title="Remove line"
                      >
                        ×
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>

              {form.ibcRows.length < MAX_IBC_ROWS && (
                <p className="text-xs text-gray-400 mt-2">
                  {MAX_IBC_ROWS - form.ibcRows.length} line{MAX_IBC_ROWS - form.ibcRows.length !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>

            {/* Special Notes */}
            <div className="mt-4">
              <FieldLabel>Special Notes</FieldLabel>
              <textarea
                className="field-input min-h-[80px] resize-y w-full"
                value={form.specialNotes}
                onChange={e => setForm(prev => ({ ...prev, specialNotes: e.target.value }))}
                placeholder="Any special instructions or notes for this order…"
              />
            </div>
          </Section>

          {/* ── Ship To ── */}
          <Section title="Ship To">
            <TextInput label="Company Name" {...field('shipToCompany')} placeholder="Ship-to company" />
            <TextInput label="Street Address" {...field('shipToAddress')} placeholder="123 Main St" />
            <TextInput label="City, State, Zip" {...field('shipToCityStateZip')} placeholder="Springfield, IL 62701" />
            <TextInput label="Receiving Information" {...field('receivingInfo')} placeholder="Dock hours, gate code, etc." />
            <TextInput label="Contact Name" {...field('receivingContactName')} placeholder="John Smith" />
            <TextInput label="Contact Number" {...field('receivingContactPhone')} placeholder="555-555-5555" />
          </Section>

          {/* ── Freight ── */}
          <Section title="Freight">
            <TextInput label="Freight Description" {...field('freightDesc')} placeholder="e.g. Flatbed, full truckload" />
            <SelectInput label="Carrier Bill To" {...field('carrierBillTo')} options={['MPH', 'Customer']} />
            <TextInput label="Freight Price to MPH ($)" type="number" {...field('freightPriceToMPH')} placeholder="0.00" />
            <TextInput label="Delivery Date(s)" {...field('deliveryDates')} placeholder="e.g. 04/15/2026 or flexible" />
            <TextInput label="Order Confirmation Contact" {...field('confirmContact')} placeholder="Name for order confirmation" />
            <div /> {/* spacer to keep grid aligned before the two split fields */}
            <TextInput label="Confirmation Email" type="email" {...field('confirmEmail')} placeholder="name@company.com" />
            <TextInput label="Confirmation Phone" {...field('confirmPhone')} placeholder="555-555-5555" />
          </Section>

          {/* ── Bill To ── */}
          <Section title="Bill To">
            <TextInput label="Company Name" {...field('billToCompany')} placeholder="Billing company name" />
            <TextInput label="Street Address" {...field('billToAddress')} placeholder="PO Box or street" />
            <TextInput label="City, State, Zip" {...field('billToCityStateZip')} placeholder="City, ST 00000" />
            <TextInput label="Contact Name" {...field('billToContact')} placeholder="Accounts payable contact" />
            <TextInput label="Email" type="email" {...field('billToEmail')} placeholder="ap@company.com" />
            <TextInput label="Phone" {...field('billToPhone')} placeholder="555-555-5555" />
          </Section>

        </div>

        {/* Send / Clear buttons */}
        <div className="mt-8 flex gap-4 justify-end">
          <button
            onClick={handleReset}
            className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Clear Form
          </button>
          <button
            onClick={handleOpenSendModal}
            disabled={sending}
            className="px-8 py-3 bg-mph-navy text-white rounded-lg text-sm font-bold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending…
              </>
            ) : (
              '📧 Send Order'
            )}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          MPH United · PO Box 1270 · Fairhope, AL 36532
        </p>
      </div>

      {/* ── Send Confirmation Modal ── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="bg-mph-navy px-6 py-4">
              <h2 className="text-white font-bold text-base">Send Order</h2>
              <p className="text-blue-200 text-xs mt-0.5">
                Order for <span className="font-semibold text-mph-amber">{form.customerName}</span>
              </p>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">
                The order will be emailed to <span className="font-semibold text-mph-navy">{userProfile?.mail || userProfile?.userPrincipalName}</span>.
              </p>

              <div>
                <label className="block text-xs font-bold text-mph-navy uppercase tracking-wider mb-1">
                  Additional Email <span className="text-gray-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="email"
                  className="field-input"
                  value={extraEmail}
                  onChange={e => setExtraEmail(e.target.value)}
                  placeholder="orders@mphunited.com"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Leave blank to send only to yourself.
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSend}
                className="px-6 py-2 bg-mph-navy text-white rounded-lg text-sm font-bold hover:bg-blue-900 transition-colors flex items-center gap-2"
              >
                📧 Send Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
