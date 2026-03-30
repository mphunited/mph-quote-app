import { useState, useEffect } from 'react'
import { useMsal } from '@azure/msal-react'
import { COMMISSION_VISIBLE_EMAILS } from '../authConfig'
import { VENDORS, CUSTOMERS, IBC_DESCRIPTIONS } from '../vendorConfig'
import { calculateQuote } from '../calculations'
import FreightLookup from './FreightLookup'
import ResultsPanel from './ResultsPanel'
import EmailModal from './EmailModal'

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM = {
  quoteDate:          today,
  salesperson:        '',
  customer:           '',
  vendorId:           '',
  coreLocation:       '',        // only for Core-IBCS
  ibcDescription:     '',
  ibcQty:             '',
  buyPrice:           '',
  sellPrice:          '',
  bottleCost:         '',
  bottleQty:          '',
  bottleFreightRate:  '',
  originCity:         '',
  originState:        '',
  destCity:           '',
  destState:          '',
  freightCarrier:     '',
  mphFreight:         '',
  customerFreight:    '0',
  commission:         '0',
  additionalCosts:    '0',
}

/** Number input with label */
function NumberField({ label, name, value, onChange, placeholder, hint, required, isCost }) {
  return (
    <div>
      <label className={`field-label${isCost ? ' text-red-600' : ''}`}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-gray-400 ml-1 font-normal text-xs">({hint})</span>}
      </label>
      <input
        type="number"
        name={name}
        className="field-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder || '0'}
        min="0"
        step="any"
      />
    </div>
  )
}

/** Collapsible section wrapper */
function Section({ title, children, accent }) {
  return (
    <div className={`rounded-xl border ${accent ? 'border-mph-amber/40 bg-amber-50/30' : 'border-gray-200 bg-white'} p-4 shadow-sm`}>
      <h3 className="text-sm font-bold text-mph-navy uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

export default function QuoteCalculator({ userProfile, activeTab, onTabChange }) {
  const { accounts } = useMsal()
  const userEmail = (userProfile?.mail || userProfile?.userPrincipalName || accounts[0]?.username || '').toLowerCase()
  const showCommission = COMMISSION_VISIBLE_EMAILS.includes(userEmail)

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    salesperson: userProfile?.displayName || '',
  })

  const [selectedVendor,  setSelectedVendor]  = useState(null)
  const [selectedQuote,   setSelectedQuote]   = useState(null)
  const [emailOpen,       setEmailOpen]       = useState(false)
  const [freightKey,      setFreightKey]      = useState(0)

  // Populate vendor defaults when vendor changes
  useEffect(() => {
    if (!form.vendorId) { setSelectedVendor(null); return }
    const vendor = VENDORS.find(v => v.id === form.vendorId)
    if (!vendor) return
    setSelectedVendor(vendor)
    setSelectedQuote(null)

    const origin = vendor.multipleLocations
      ? (form.coreLocation ? vendor.locations.find(l => `${l.city},${l.state}` === form.coreLocation) : null)
      : vendor.origin

    const defaultDesc = vendor.defaultDescriptions?.[0] || ''
    const defaultQty  = defaultDesc && vendor.defaultQtyByDescription?.[defaultDesc]
      ? String(vendor.defaultQtyByDescription[defaultDesc])
      : ''

    setForm(prev => ({
      ...prev,
      buyPrice:          String(vendor.defaultBuyPrice),
      bottleCost:        vendor.usesBottles ? String(vendor.defaultBottleCost)        : '0',
      bottleFreightRate: vendor.usesBottles ? String(vendor.defaultBottleFreightRate) : '0',
      bottleQty:         vendor.usesBottles ? (defaultQty || prev.bottleQty) : '0',
      ibcDescription:    defaultDesc,
      ibcQty:            defaultQty,
      originCity:        origin?.city  || '',
      originState:       origin?.state || '',
      mphFreight:        '',
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vendorId])

  // Update origin when Core-IBCS location changes
  useEffect(() => {
    if (!selectedVendor?.multipleLocations || !form.coreLocation) return
    const loc = selectedVendor.locations.find(l => `${l.city},${l.state}` === form.coreLocation)
    if (loc) {
      setForm(prev => ({ ...prev, originCity: loc.city, originState: loc.state }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.coreLocation])

  // Auto-update buy price and qty when description changes
  useEffect(() => {
    if (!selectedVendor || !form.ibcDescription) return
    const updates = {}
    // Update buy price if vendor has per-description pricing
    if (selectedVendor.buyPriceByDescription) {
      const price = selectedVendor.buyPriceByDescription[form.ibcDescription]
      if (price !== undefined) updates.buyPrice = String(price)
    }
    // Update ibcQty (and bottleQty for bottle vendors) if vendor has per-description qty defaults
    if (selectedVendor.defaultQtyByDescription) {
      const qty = selectedVendor.defaultQtyByDescription[form.ibcDescription]
      if (qty !== undefined) {
        updates.ibcQty = String(qty)
        if (selectedVendor.usesBottles) updates.bottleQty = String(qty)
      }
    }
    if (Object.keys(updates).length > 0) {
      setForm(prev => ({ ...prev, ...updates }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ibcDescription])

  // Auto-calculate commission when ibcQty changes (for eligible users)
  useEffect(() => {
    if (!showCommission) return
    const qty = parseFloat(form.ibcQty) || 0
    setForm(prev => ({ ...prev, commission: qty > 0 ? String(qty * 3) : '0' }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ibcQty, showCommission])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleFreightSelect(quote) {
    setSelectedQuote(quote)
    setForm(prev => ({
      ...prev,
      customerFreight: String(quote.quoteAmount), // freight cost MPH pays carrier → Column L (subtracted from profit)
      mphFreight:      '0',                       // reset Column M (freight billed TO customer, usually $0)
      freightCarrier:  quote.carrier,
      destCity:        quote.destCity,
      destState:       quote.destState,
    }))
  }

  function handleReset() {
    setForm({ ...EMPTY_FORM, salesperson: userProfile?.displayName || '' })
    setSelectedVendor(null)
    setSelectedQuote(null)
    setFreightKey(k => k + 1)   // remounts FreightLookup, clearing its internal state
  }

  // Build inputs object for the calculation engine
  const calcInputs = {
    bottleCost:         form.bottleCost,
    bottleQty:          form.bottleQty,
    bottleFreightRate:  form.bottleFreightRate,
    ibcQty:             form.ibcQty,
    buyPrice:           form.buyPrice,
    sellPrice:          form.sellPrice,
    customerFreight:    form.customerFreight,
    mphFreight:         form.mphFreight,
    commission:         showCommission ? form.commission : '0',
    additionalCosts:    form.additionalCosts,
  }
  const result = calculateQuote(calcInputs)

  const vendorName   = selectedVendor?.name || ''
  const customerName = form.customer

  return (
    <div className="min-h-screen bg-mph-gray">
      {/* Top nav */}
      <nav className="bg-mph-navy text-white px-6 py-5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white rounded px-2 py-1">
            <img
              src="/MPH-Logo.png"
              alt="MPH United"
              className="h-10 object-contain"
            />
          </div>
          {/* Tab buttons */}
          <div className="flex gap-2 ml-3">
            <button
              onClick={() => onTabChange?.('calculator')}
              className={`px-5 py-2.5 rounded text-sm font-bold transition-colors ${
                activeTab === 'calculator'
                  ? 'bg-mph-amber text-mph-navy'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              📊 Sales Margins Calculator
            </button>
            <button
              onClick={() => onTabChange?.('quote')}
              className={`px-5 py-2.5 rounded text-sm font-bold transition-colors ${
                activeTab === 'quote'
                  ? 'bg-mph-amber text-mph-navy'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              📄 Create a Customer Quote
            </button>
          </div>
        </div>
        <div className="text-sm text-blue-200 text-right">
          <div className="font-semibold">{userProfile?.displayName}</div>
          <div className="text-blue-300/70 text-xs">{userProfile?.mail}</div>
        </div>
      </nav>

      {/* Instructions banner */}
      <div className="bg-blue-50 border-b border-blue-100 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs font-bold text-mph-navy uppercase tracking-wider mb-2">How to Use</p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-1 text-sm text-gray-700 list-decimal list-inside">
            <li>In the header, choose to determine <strong>Sales Margin</strong> or <strong>Create a Customer Quote</strong>.</li>
            <li>Below, choose a current customer or enter a new customer.</li>
            <li>Choose a vendor and IBC product along with quantity, buy price, and sell price. If the IBC has a bottle cost, enter it below along with freight rate.</li>
            <li>Under Freight, enter the destination city/state and click <strong>Look Up Freight Quotes</strong>. If there are no freight quotes, enter the freight costs manually.</li>
            <li>If there are additional costs, add them below.</li>
            <li>You may email the margins quote to yourself and/or to Mike.</li>
          </ol>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN: Form ─────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">

          {/* A: Transaction Info */}
          <Section title="A · Transaction Info">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="field-label">Quote Date</label>
                <input type="date" name="quoteDate" className="field-input"
                  value={form.quoteDate} onChange={handleChange} />
              </div>
              <div>
                <label className="field-label">Salesperson</label>
                <input type="text" name="salesperson" className="field-input"
                  value={form.salesperson} onChange={handleChange} placeholder="Name" />
              </div>
              <div>
                <label className="field-label">Customer<span className="text-red-400 ml-0.5">*</span></label>
                <input
                  list="customer-list"
                  name="customer"
                  className="field-input"
                  value={form.customer}
                  onChange={handleChange}
                  placeholder="Type to search or enter new…"
                  autoComplete="off"
                />
                <datalist id="customer-list">
                  {CUSTOMERS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
          </Section>

          {/* B: Vendor & Product */}
          <Section title="B · Vendor & Product">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">Vendor<span className="text-red-400 ml-0.5">*</span></label>
                <select name="vendorId" className="field-input" value={form.vendorId} onChange={handleChange}>
                  <option value="">— Select Vendor —</option>
                  {VENDORS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              {/* Core-IBCS location picker */}
              {selectedVendor?.multipleLocations && (
                <div>
                  <label className="field-label">{selectedVendor.name} Location<span className="text-red-400 ml-0.5">*</span></label>
                  <select name="coreLocation" className="field-input" value={form.coreLocation} onChange={handleChange}>
                    <option value="">— Select Location —</option>
                    {selectedVendor.locations.map(l => (
                      <option key={`${l.city},${l.state}`} value={`${l.city},${l.state}`}>
                        {l.city}, {l.state}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="field-label">IBC Product Description<span className="text-red-400 ml-0.5">*</span></label>
                <select name="ibcDescription" className="field-input" value={form.ibcDescription} onChange={handleChange}>
                  <option value="">— Select Product —</option>
                  {(selectedVendor?.defaultDescriptions || IBC_DESCRIPTIONS).map(d =>
                    <option key={d} value={d}>{d}</option>
                  )}
                  {selectedVendor && IBC_DESCRIPTIONS
                    .filter(d => !selectedVendor.defaultDescriptions?.includes(d))
                    .map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <NumberField label="IBC Quantity" name="ibcQty"        value={form.ibcQty}    onChange={handleChange} required placeholder="e.g. 60" />
              <NumberField label="Buy Price / Unit"  name="buyPrice"  value={form.buyPrice}  onChange={handleChange} required hint="from vendor" isCost />
              <NumberField label="Sell Price / Unit" name="sellPrice" value={form.sellPrice} onChange={handleChange} required hint="quoted to customer" />
            </div>
          </Section>

          {/* C: Bottle Costs (hidden if vendor doesn't use bottles) */}
          {selectedVendor?.usesBottles && (
            <Section title="C · Bottle Costs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumberField label="Bottle Cost / Unit" name="bottleCost"         value={form.bottleCost}        onChange={handleChange} hint="pre-filled" isCost />
                <NumberField label="Bottle Quantity"    name="bottleQty"          value={form.bottleQty}         onChange={handleChange} />
                <NumberField label="MPH Freight Rate Bottles" name="bottleFreightRate" value={form.bottleFreightRate} onChange={handleChange} hint="total rate ÷ 90 per unit" isCost />
              </div>
            </Section>
          )}

          {/* D: Freight */}
          <Section title="D · Freight">
            <FreightLookup
              key={freightKey}
              originCity={form.originCity}
              originState={form.originState}
              onSelect={handleFreightSelect}
              selectedQuote={selectedQuote}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
              <NumberField
                label="Freight Cost (MPH Pays Carrier)"
                name="customerFreight"
                value={form.customerFreight}
                onChange={handleChange}
                hint="auto-fills from selection above"
                isCost
              />
              <NumberField
                label="Freight Billed to Customer"
                name="mphFreight"
                value={form.mphFreight}
                onChange={handleChange}
                hint="only if customer pays freight separately"
              />
            </div>
          </Section>

          {/* E: Additional Costs & Commission */}
          <Section title="E · Additional Costs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField label="Additional Costs" name="additionalCosts" value={form.additionalCosts} onChange={handleChange} isCost />
              {showCommission && (
                <div>
                  <NumberField
                    label="Commission"
                    name="commission"
                    value={form.commission}
                    onChange={handleChange}
                    hint="auto: qty × $3"
                    isCost
                  />
                  <p className="text-xs text-gray-400 mt-1">Auto-calculated as IBC Qty × $3. You may override.</p>
                </div>
              )}
            </div>
          </Section>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pb-4">
            <button
              onClick={() => setEmailOpen(true)}
              disabled={!result}
              className="btn-primary flex-1 text-base py-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              📧 Email This Quote
            </button>
            <button onClick={handleReset} className="btn-ghost flex-1 text-base py-3">
              🔄 New Quote
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Live Results ────────────────────────── */}
        <div className="xl:col-span-1">
          <div className="sticky top-6">
            <ResultsPanel
              inputs={calcInputs}
              vendorName={vendorName}
              customerName={customerName}
              ibcDescription={form.ibcDescription}
              ibcQty={form.ibcQty}
            />
          </div>
        </div>
      </div>

      {/* Email modal */}
      <EmailModal
        isOpen={emailOpen}
        onClose={() => setEmailOpen(false)}
        userEmail={userProfile?.mail || userProfile?.userPrincipalName || ''}
        formData={{ ...form, freightCarrier: selectedQuote?.carrier || form.freightCarrier }}
        result={result}
        vendorName={vendorName}
        customerName={customerName}
      />
    </div>
  )
}
