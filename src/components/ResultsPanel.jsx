import { calculateQuote, marginRating, fmtCurrency, fmtPercent } from '../calculations'

const RATING_STYLES = {
  green:  { bar: 'bg-green-500',  badge: 'bg-green-100  text-green-800',  label: '15%+' },
  yellow: { bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-800', label: '10–14%' },
  orange: { bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-800', label: '5–9%' },
  red:    { bar: 'bg-red-500',    badge: 'bg-red-100    text-red-800',    label: 'Below 5%' },
}

/**
 * type: 'cost'    → label & value in red
 *       'revenue' → label & value in black (default weight)
 *       undefined → neutral gray (totals, per-unit lines)
 */
function Row({ label, value, bold, indent, type }) {
  const valueColor =
    type === 'cost'    ? 'text-red-600' :
    type === 'revenue' ? 'text-gray-900' :
    bold               ? 'text-gray-900' : 'text-gray-700'

  const labelColor =
    type === 'cost'    ? 'text-red-600' :
    type === 'revenue' ? 'text-gray-900' :
    bold               ? 'text-gray-800' : ''

  return (
    <div className={`flex justify-between items-center py-1 ${indent ? 'pl-4 text-xs' : 'text-sm'}`}>
      <span className={`${labelColor} ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`${valueColor} ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  )
}

/**
 * ResultsPanel
 *
 * Reads the current form inputs, runs the calculation engine, and
 * renders the live profit summary. Updates on every keystroke.
 *
 * Props: all the raw form field values (numbers or strings)
 */
export default function ResultsPanel({ inputs, vendorName, customerName, ibcDescription, ibcQty }) {
  const result = calculateQuote(inputs)

  if (!result) {
    return (
      <div className="results-card flex items-center justify-center min-h-40 text-gray-400 text-sm">
        Fill in IBC Quantity and Sell Price to see the margin calculation.
      </div>
    )
  }

  const rating  = marginRating(result.profitPct)
  const styles  = RATING_STYLES[rating]
  const pctBar  = Math.min(Math.max(result.profitPct * 100, 0), 40) / 40 * 100 // scale bar to 40% max

  return (
    <div className="results-card space-y-4">
      <h3 className="text-base font-bold text-mph-navy uppercase tracking-wide">Quote Summary</h3>

      {/* Context line */}
      {(vendorName || customerName) && (
        <p className="text-xs text-gray-500">
          {[vendorName, customerName, ibcDescription, ibcQty ? `${ibcQty} units` : ''].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Per-unit metrics */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-1">
        <Row label="All-In Cost / Unit"  value={fmtCurrency(result.ibcTotalCost)}       type="cost" />
        <Row label="Sell Price / Unit"   value={fmtCurrency(result.ibcTotalSellPrice)}  type="revenue" />
        <Row label="Gross Margin / Unit" value={fmtCurrency(result.grossMarginPerUnit)} bold />
      </div>

      {/* Cost breakdown */}
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Cost Breakdown</p>
        {inputs.bottleQty > 0 && (
          <>
            <Row label="Bottle Cost"        value={fmtCurrency(result.bottleCostTotal)}    indent type="cost" />
            <Row label="Bottle Freight"     value={fmtCurrency(result.bottleFreightTotal)} indent type="cost" />
          </>
        )}
        <Row label="IBC Purchase Cost"      value={fmtCurrency(result.ibcPurchaseCostTotal)} indent type="cost" />
        {result.customerFreightTotal > 0 &&
          <Row label="Freight Cost (MPH Pays)" value={fmtCurrency(result.customerFreightTotal)} indent type="cost" />}
        {result.mphFreightTotal > 0 &&
          <Row label="Freight Billed to Customer" value={fmtCurrency(result.mphFreightTotal)} indent type="revenue" />}
        {result.commissionTotal > 0 &&
          <Row label="Commission"           value={fmtCurrency(result.commissionTotal)}   indent type="cost" />}
        {result.additionalCostsTotal > 0 &&
          <Row label="Additional Costs"     value={fmtCurrency(result.additionalCostsTotal)} indent type="cost" />}
        <div className="border-t border-gray-200 mt-1 pt-1">
          <Row label="Total Cost"    value={fmtCurrency(result.totalCost)}    bold type="cost" />
          <Row label="Total Revenue" value={fmtCurrency(result.totalRevenue)} bold type="revenue" />
        </div>
      </div>

      {/* Primary metrics */}
      <div className="bg-mph-navy rounded-xl p-4 text-white space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-blue-200">Total Profit</span>
          <span className={`text-2xl font-extrabold ${rating === 'red' ? 'text-red-300' : 'text-white'}`}>
            {fmtCurrency(result.profit)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-blue-200">Profit Margin</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${styles.badge}`}>
              {styles.label}
            </span>
            <span className="text-2xl font-extrabold">
              {fmtPercent(result.profitPct)}
            </span>
          </div>
        </div>

        {/* Visual bar */}
        <div className="h-2 bg-white/20 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all duration-500 ${styles.bar}`}
            style={{ width: `${pctBar}%` }}
          />
        </div>
        <p className="text-xs text-blue-200/70 text-right">Bar represents 0–40% range</p>
      </div>
    </div>
  )
}
