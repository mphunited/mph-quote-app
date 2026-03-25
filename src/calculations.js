/**
 * Profit Margin Calculation Engine
 *
 * Replicates the five Excel formulas from Tracking MPH Deals.xlsx exactly.
 *
 * Variable mapping (matches Excel columns):
 *   D = bottleCost          – per-unit bottle cost
 *   E = bottleQty           – number of bottles
 *   F = bottleFreightRate   – total freight rate for bottles (divided by 90 per unit)
 *   H = ibcQty              – number of IBCs (MUST be > 0)
 *   I = buyPrice            – per-unit IBC purchase price from vendor
 *   K = sellPrice           – per-unit IBC sell price to customer
 *   L = customerFreight     – Customer Freight Costs (what customer pays)
 *   M = mphFreight          – MPH Freight Costs (actual freight paid to carrier)
 *   N = commission          – Renee commission (ibcQty × $3, eligible users only)
 *   O = additionalCosts     – any other costs
 */

/**
 * Parses a value as a float, returning 0 for blank / non-numeric input.
 */
function n(val) {
  const parsed = parseFloat(val)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Rounds to 2 decimal places (mirrors Excel ROUND(...,2)).
 */
function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

/**
 * Main calculation function.
 * Returns all five computed values plus the inputs echoed back.
 *
 * @param {Object} inputs
 * @returns {Object|null}  null if ibcQty is 0 or sellPrice is blank
 */
export function calculateQuote(inputs) {
  const {
    bottleCost,
    bottleQty,
    bottleFreightRate,
    ibcQty,
    buyPrice,
    sellPrice,
    customerFreight,
    mphFreight,
    commission,
    additionalCosts,
  } = inputs

  const D = n(bottleCost)
  const E = n(bottleQty)
  const F = n(bottleFreightRate)
  const H = n(ibcQty)
  const I = n(buyPrice)
  const K = n(sellPrice)
  const L = n(customerFreight)
  const M = n(mphFreight)
  const N = n(commission)
  const O = n(additionalCosts)

  // Guard: IBC Qty must be > 0 and Sell Price must be entered
  if (H <= 0 || K === 0) return null

  // ── Formula 1: IBC Total Cost (all-in cost per unit) ──────────────────────
  // =((D*E)+((F/90)*E)+(H*I)+L+N+O)/H
  const ibcTotalCost = round2(
    ((D * E) + ((F / 90) * E) + (H * I) + L + N + O) / H
  )

  // ── Formula 2: IBC Total Sell Price (blended revenue per unit) ────────────
  // =((H*K)+M)/H
  const ibcTotalSellPrice = round2(((H * K) + M) / H)

  // ── Formula 3: Gross Margin per Unit ─────────────────────────────────────
  // =ROUND(P-J,2)
  const grossMarginPerUnit = round2(ibcTotalSellPrice - ibcTotalCost)

  // ── Formula 4: Total Profit ($) ──────────────────────────────────────────
  // =ROUND((K-I)*H+M-(D*E)-((F/90)*E)-L-O-N,2)
  const profit = round2(
    (K - I) * H + M - (D * E) - ((F / 90) * E) - L - O - N
  )

  // ── Formula 5: Profit Percentage ─────────────────────────────────────────
  // =R/((K*H)+M)
  const totalRevenue = (K * H) + M
  const profitPct = totalRevenue !== 0 ? profit / totalRevenue : 0

  // ── Cost & Revenue breakdown for the summary panel ───────────────────────
  const bottleCostTotal        = round2(D * E)
  const bottleFreightTotal     = round2((F / 90) * E)
  const ibcPurchaseCostTotal   = round2(H * I)
  const totalCost              = round2(bottleCostTotal + bottleFreightTotal + ibcPurchaseCostTotal + L + N + O)
  const ibcSalesRevenue        = round2(H * K)

  return {
    // Per-unit
    ibcTotalCost,
    ibcTotalSellPrice,
    grossMarginPerUnit,
    // Totals
    profit,
    profitPct,
    totalRevenue: round2(totalRevenue),
    totalCost,
    // Breakdown
    bottleCostTotal,
    bottleFreightTotal,
    ibcPurchaseCostTotal,
    ibcSalesRevenue,
    commissionTotal: round2(N),
    additionalCostsTotal: round2(O),
    customerFreightTotal: round2(L),
    mphFreightTotal: round2(M),
  }
}

/**
 * Determines the profit margin rating for colour-coded display.
 * @param {number} profitPct  (decimal, e.g. 0.17 for 17%)
 * @returns {'excellent'|'good'|'acceptable'|'thin'|'loss'}
 */
export function marginRating(profitPct) {
  if (profitPct >= 0.15) return 'green'
  if (profitPct >= 0.10) return 'yellow'
  if (profitPct >= 0.05) return 'orange'
  return 'red'                            // below 5% and losses
}

/**
 * Formats a number as USD currency string.
 */
export function fmtCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

/**
 * Formats a decimal as a percentage string.
 */
export function fmtPercent(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${(val * 100).toFixed(1)}%`
}
