import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { graphScopes } from '../authConfig'
import { sendQuoteEmail } from '../graphService'
import { fmtCurrency, fmtPercent } from '../calculations'

/**
 * EmailModal
 *
 * Opens a dialog to confirm recipients, then sends the quote summary
 * as an HTML email via Microsoft Graph /me/sendMail.
 *
 * Props:
 *  isOpen        {bool}
 *  onClose       {fn}
 *  userEmail     {string}   – logged-in user's email (default recipient)
 *  formData      {object}   – all form fields
 *  result        {object}   – calculation results
 *  vendorName    {string}
 *  customerName  {string}
 */
export default function EmailModal({ isOpen, onClose, userEmail, formData, result, vendorName, customerName }) {
  const { instance, accounts } = useMsal()
  const [recipients, setRecipients] = useState(userEmail || '')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const subject = `MPH Quote — ${customerName || 'Customer'} — ${today}`

  function buildHtml() {
    const fd = formData
    const r  = result
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #222; font-size: 14px; }
    .header { background: #0D2E6E; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; }
    .header h2 { margin: 0; font-size: 18px; }
    .header p  { margin: 4px 0 0; font-size: 12px; opacity: 0.8; }
    .body  { padding: 20px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
    table  { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    td     { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
    td.label { color: #64748b; width: 45%; }
    td.value { font-weight: 600; }
    .divider { border-top: 2px solid #e2e8f0; margin: 16px 0; }
    .total-row td { font-size: 16px; padding-top: 8px; }
    .profit    { color: #0D2E6E; font-size: 22px; font-weight: 800; }
    .pct       { font-size: 22px; font-weight: 800; }
    .footer    { font-size: 11px; color: #94a3b8; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>MPH United – Quote Summary</h2>
    <p>${today}</p>
  </div>
  <div class="body">
    <table>
      <tr><td class="label">Customer</td>      <td class="value">${customerName || '—'}</td></tr>
      <tr><td class="label">Vendor</td>         <td class="value">${vendorName   || '—'}</td></tr>
      <tr><td class="label">Salesperson</td>    <td class="value">${fd.salesperson || '—'}</td></tr>
      <tr><td class="label">Quote Date</td>      <td class="value">${fd.quoteDate  || today}</td></tr>
      <tr><td class="label">Product</td>        <td class="value">${fd.ibcDescription || '—'}</td></tr>
      <tr><td class="label">IBC Quantity</td>   <td class="value">${fd.ibcQty || 0} units</td></tr>
      <tr><td class="label">Buy Price / Unit</td><td class="value">${fmtCurrency(parseFloat(fd.buyPrice)||0)}</td></tr>
      <tr><td class="label">Sell Price / Unit</td><td class="value">${fmtCurrency(parseFloat(fd.sellPrice)||0)}</td></tr>
    </table>

    ${parseFloat(fd.bottleQty) > 0 ? `
    <table>
      <tr><td colspan="2" style="font-weight:700;color:#0D2E6E;padding-bottom:4px">Bottle Costs</td></tr>
      <tr><td class="label">Bottle Cost / Unit</td>   <td class="value">${fmtCurrency(parseFloat(fd.bottleCost)||0)}</td></tr>
      <tr><td class="label">Bottle Quantity</td>       <td class="value">${fd.bottleQty}</td></tr>
      <tr><td class="label">Bottle Freight Rate</td>   <td class="value">${fmtCurrency(parseFloat(fd.bottleFreightRate)||0)}</td></tr>
    </table>` : ''}

    <table>
      <tr><td colspan="2" style="font-weight:700;color:#0D2E6E;padding-bottom:4px">Freight</td></tr>
      <tr><td class="label">Origin</td>               <td class="value">${fd.originCity || '—'}, ${fd.originState || ''}</td></tr>
      <tr><td class="label">Destination</td>           <td class="value">${fd.destCity || '—'}, ${fd.destState || ''}</td></tr>
      ${fd.freightCarrier ? `<tr><td class="label">Carrier</td><td class="value">${fd.freightCarrier}</td></tr>` : ''}
      <tr><td class="label">Freight Cost (MPH Pays)</td>       <td class="value">${fmtCurrency(parseFloat(fd.customerFreight)||0)}</td></tr>
      <tr><td class="label">Freight Billed to Customer</td>  <td class="value">${fmtCurrency(parseFloat(fd.mphFreight)||0)}</td></tr>
    </table>

    ${(parseFloat(fd.commission) > 0 || parseFloat(fd.additionalCosts) > 0) ? `
    <table>
      ${parseFloat(fd.commission) > 0 ? `<tr><td class="label">Commission</td><td class="value">${fmtCurrency(parseFloat(fd.commission)||0)}</td></tr>` : ''}
      ${parseFloat(fd.additionalCosts) > 0 ? `<tr><td class="label">Additional Costs</td><td class="value">${fmtCurrency(parseFloat(fd.additionalCosts)||0)}</td></tr>` : ''}
    </table>` : ''}

    <div class="divider"></div>

    <table>
      <tr><td class="label">All-In Cost / Unit</td>   <td class="value">${fmtCurrency(r.ibcTotalCost)}</td></tr>
      <tr><td class="label">Sell Price / Unit</td>     <td class="value">${fmtCurrency(r.ibcTotalSellPrice)}</td></tr>
      <tr><td class="label">Gross Margin / Unit</td>   <td class="value">${fmtCurrency(r.grossMarginPerUnit)}</td></tr>
      <tr><td class="label">Total Revenue</td>          <td class="value">${fmtCurrency(r.totalRevenue)}</td></tr>
      <tr><td class="label">Total Cost</td>             <td class="value">${fmtCurrency(r.totalCost)}</td></tr>
    </table>

    <table class="total-row">
      <tr>
        <td class="label" style="font-size:15px;font-weight:700">TOTAL PROFIT</td>
        <td class="profit">${fmtCurrency(r.profit)}</td>
      </tr>
      <tr>
        <td class="label" style="font-size:15px;font-weight:700">PROFIT MARGIN</td>
        <td class="pct">${fmtPercent(r.profitPct)}</td>
      </tr>
    </table>

    <p class="footer">Generated by MPH United Quote Calculator · ${today}</p>
  </div>
</body>
</html>`
  }

  async function handleSend() {
    const addrs = recipients.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
    if (addrs.length === 0) { setError('Please enter at least one recipient.'); return }

    setSending(true)
    setError(null)
    try {
      const account = accounts[0]
      const tokenResponse = await instance.acquireTokenSilent({
        scopes: graphScopes.mail,
        account,
      })
      await sendQuoteEmail(tokenResponse.accessToken, addrs, subject, buildHtml())
      setSent(true)
    } catch (err) {
      console.error(err)
      setError(`Failed to send: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        {sent ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">✅</div>
            <h3 className="text-lg font-bold text-mph-navy mb-1">Email Sent!</h3>
            <p className="text-sm text-gray-500 mb-4">Quote emailed to {recipients}</p>
            <button onClick={() => { setSent(false); onClose() }} className="btn-primary">Close</button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-mph-navy mb-1">Email This Quote</h3>
            <p className="text-sm text-gray-500 mb-4">{subject}</p>

            <label className="field-label">Recipients <span className="text-gray-400">(comma-separated)</span></label>
            <input
              type="text"
              className="field-input mb-3"
              value={recipients}
              onChange={e => setRecipients(e.target.value)}
              placeholder="you@mphunited.com, other@company.com"
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
                {error}
              </p>
            )}

            <div className="flex gap-3 mt-2">
              <button onClick={onClose} className="btn-ghost flex-1" disabled={sending}>Cancel</button>
              <button onClick={handleSend} className="btn-primary flex-1" disabled={sending}>
                {sending ? 'Sending…' : '📧 Send Email'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
