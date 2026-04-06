import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { graphScopes } from '../authConfig'
import { sendQuoteEmail } from '../graphService'

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
      <select
        className="field-input"
        value={value}
        onChange={onChange}
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

// ── Empty form state ─────────────────────────────────────────────────────────

const EMPTY = {
  customerName:         '',
  vendorName:           '',
  ibcQty:               '',
  ibcSpec:              '',
  emptiesBack:          '',
  specialNotes:         '',
  customerPO:           '',
  buyPrice:             '',
  sellPrice:            '',
  deliveredPrice:       '',
  freightBillCustomer:  '',
  shipToCompany:        '',
  shipToAddress:        '',
  shipToCityStateZip:   '',
  receivingInfo:        '',
  receivingContact:     '',
  freightDesc:          '',
  carrierBillTo:        '',
  freightPriceToMPH:    '',
  deliveryDates:        '',
  confirmContact:       '',
  confirmEmailPhone:    '',
  billToCompany:        '',
  billToAddress:        '',
  billToCityStateZip:   '',
  billToContact:        '',
  billToEmailPhone:     '',
}

// ── Email HTML builder ───────────────────────────────────────────────────────

function buildEmailHtml(form, senderName) {
  const row = (label, value) =>
    value
      ? `<tr>
           <td style="padding:6px 12px;font-weight:600;color:#002850;white-space:nowrap;width:220px;vertical-align:top">${label}</td>
           <td style="padding:6px 12px;color:#333">${value || '—'}</td>
         </tr>`
      : ''

  const section = (title, rows) => `
    <tr><td colspan="2" style="padding:16px 12px 4px;font-size:12px;font-weight:700;color:#ffffff;background:#002850;text-transform:uppercase;letter-spacing:0.08em">${title}</td></tr>
    ${rows}
  `

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
        ${section('Order Details',
          row('Customer Name', form.customerName) +
          row('Vendor Name', form.vendorName) +
          row('IBC Quantity', form.ibcQty) +
          row('SPEC Description', form.ibcSpec) +
          row('Empties Coming Back', form.emptiesBack) +
          row('Customer PO(s)', form.customerPO) +
          row('Buy Price', form.buyPrice ? `$${form.buyPrice}` : '') +
          row('Sell Price', form.sellPrice ? `$${form.sellPrice}` : '') +
          row('Delivered Price', form.deliveredPrice) +
          row('Freight Line Bill to Customer', form.freightBillCustomer ? `$${form.freightBillCustomer}` : '') +
          row('Special Notes', form.specialNotes)
        )}
        ${section('Ship To',
          row('Company Name', form.shipToCompany) +
          row('Street Address', form.shipToAddress) +
          row('City, State, Zip', form.shipToCityStateZip) +
          row('Receiving Information', form.receivingInfo) +
          row('Contact Name & Number', form.receivingContact)
        )}
        ${section('Freight',
          row('Freight Description', form.freightDesc) +
          row('Carrier Bill To', form.carrierBillTo) +
          row('Freight Price to MPH', form.freightPriceToMPH ? `$${form.freightPriceToMPH}` : '') +
          row('Delivery Date(s)', form.deliveryDates) +
          row('Order Confirmation Contact', form.confirmContact) +
          row('Email & Phone', form.confirmEmailPhone)
        )}
        ${section('Bill To',
          row('Company Name', form.billToCompany) +
          row('Street Address', form.billToAddress) +
          row('City, State, Zip', form.billToCityStateZip) +
          row('Contact Name', form.billToContact) +
          row('Email & Phone', form.billToEmailPhone)
        )}
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

  const [form, setForm]         = useState(EMPTY)
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [sendError, setSendError] = useState(null)

  function field(key) {
    return {
      value: form[key],
      onChange: e => setForm(prev => ({ ...prev, [key]: e.target.value })),
    }
  }

  async function handleSend() {
    if (!form.customerName.trim()) {
      setSendError('Customer Name is required.')
      return
    }
    setSendError(null)
    setSending(true)
    try {
      const tokenResponse = await instance.acquireTokenSilent({
        scopes: graphScopes.mail,
        account: accounts[0],
      })

      const salespersonEmail = userProfile?.mail || userProfile?.userPrincipalName
      const recipients = []
      if (salespersonEmail) {
        recipients.push(salespersonEmail)
      }

      const subject = `New Customer Order – ${form.customerName || 'Unknown Customer'}`
      const html = buildEmailHtml(form, userProfile?.displayName || salespersonEmail)

      await sendQuoteEmail(tokenResponse.accessToken, recipients, subject, html)

      setSent(true)
      setForm(EMPTY)
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

  // ── Nav bar (matches QuoteCalculator / QuoteBuilder style) ─────────────────
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top nav ── */}
      <nav className="bg-mph-navy text-white px-6 py-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white rounded px-2 py-1">
            <img src="/MPH_Logo.png" alt="MPH United" className="h-10 object-contain" />
          </div>
          <div className="flex gap-2 ml-3 flex-wrap">
            {tabBtn('calculator', 'Sales Margins Calculator', '📊')}
            {tabBtn('quote',      'Create a Customer Quote',  '📄')}
            {tabBtn('order',      'Order Form for New Customers', '📋')}
          </div>
        </div>
        <div className="text-sm text-blue-200 text-right">
          <div className="font-semibold">{userProfile?.displayName}</div>
          <div className="text-blue-300/70 text-xs">{userProfile?.mail}</div>
        </div>
      </nav>

      {/* ── Page content ── */}
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-mph-navy">Order Form for New Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Fill in the order details below and click <strong>Send Order</strong>. The completed form will be emailed to you.
          </p>
        </div>

        {/* Success message */}
        {sent && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-green-800 font-semibold">✅ Order sent successfully!</p>
              <p className="text-green-700 text-sm mt-0.5">
                A copy was emailed to you.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="ml-4 px-4 py-2 bg-mph-navy text-white text-sm font-bold rounded hover:bg-blue-900 transition-colors"
            >
              New Order
            </button>
          </div>
        )}

        {/* Error message */}
        {sendError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-6">
            <p className="text-red-700 text-sm font-semibold">⚠️ {sendError}</p>
          </div>
        )}

        {/* ── Form sections ── */}
        <div className="space-y-5">

          {/* Order Details */}
          <Section title="Order Details">
            <TextInput label="Customer Name" required {...field('customerName')} placeholder="Customer company name" />
            <TextInput label="Vendor Name" {...field('vendorName')} placeholder="e.g. RRG, Clean Environmental" />
            <TextInput label="IBC Quantity" type="number" {...field('ibcQty')} placeholder="e.g. 48" />
            <TextInput label="SPEC Description" {...field('ibcSpec')} placeholder="e.g. 275 Gal IBC, Rebottle" />
            <SelectInput
              label="Empties Coming Back"
              {...field('emptiesBack')}
              options={['Yes', 'No']}
            />
            <SelectInput
              label="Delivered Price"
              {...field('deliveredPrice')}
              options={['Yes', 'No']}
            />
            <TextInput label="Customer PO(s)" {...field('customerPO')} placeholder="PO number(s)" />
            <TextInput label="Buy Price ($)" type="number" {...field('buyPrice')} placeholder="0.00" />
            <TextInput label="Sell Price ($)" type="number" {...field('sellPrice')} placeholder="0.00" />
            <TextInput label="Freight Line Bill to Customer ($)" type="number" {...field('freightBillCustomer')} placeholder="0.00" />
            {/* Special Notes spans full width */}
            <div className="sm:col-span-2">
              <FieldLabel>Special Notes</FieldLabel>
              <textarea
                className="field-input min-h-[80px] resize-y"
                value={form.specialNotes}
                onChange={e => setForm(prev => ({ ...prev, specialNotes: e.target.value }))}
                placeholder="Any special instructions or notes for this order…"
              />
            </div>
          </Section>

          {/* Ship To */}
          <Section title="Ship To">
            <TextInput label="Company Name" {...field('shipToCompany')} placeholder="Ship-to company" />
            <TextInput label="Street Address" {...field('shipToAddress')} placeholder="123 Main St" />
            <TextInput label="City, State, Zip" {...field('shipToCityStateZip')} placeholder="Springfield, IL 62701" />
            <TextInput label="Receiving Information" {...field('receivingInfo')} placeholder="Dock hours, gate code, etc." />
            <TextInput label="Contact Name & Number" {...field('receivingContact')} placeholder="John Smith · 555-555-5555" />
          </Section>

          {/* Freight */}
          <Section title="Freight">
            <TextInput label="Freight Description" {...field('freightDesc')} placeholder="e.g. Flatbed, full truckload" />
            <SelectInput
              label="Carrier Bill To"
              {...field('carrierBillTo')}
              options={['MPH', 'Customer']}
            />
            <TextInput label="Freight Price to MPH ($)" type="number" {...field('freightPriceToMPH')} placeholder="0.00" />
            <TextInput label="Delivery Date(s)" {...field('deliveryDates')} placeholder="e.g. 04/15/2026 or flexible" />
            <TextInput label="Order Confirmation Contact" {...field('confirmContact')} placeholder="Name for order confirmation" />
            <TextInput label="Confirmation Email & Phone" {...field('confirmEmailPhone')} placeholder="email@example.com · 555-555-5555" />
          </Section>

          {/* Bill To */}
          <Section title="Bill To">
            <TextInput label="Company Name" {...field('billToCompany')} placeholder="Billing company name" />
            <TextInput label="Street Address" {...field('billToAddress')} placeholder="PO Box or street" />
            <TextInput label="City, State, Zip" {...field('billToCityStateZip')} placeholder="City, ST 00000" />
            <TextInput label="Contact Name" {...field('billToContact')} placeholder="Accounts payable contact" />
            <TextInput label="Email & Phone" {...field('billToEmailPhone')} placeholder="ap@company.com · 555-555-5555" />
          </Section>

        </div>

        {/* ── Send button ── */}
        <div className="mt-8 flex gap-4 justify-end">
          <button
            onClick={handleReset}
            className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Clear Form
          </button>
          <button
            onClick={handleSend}
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
    </div>
  )
}
