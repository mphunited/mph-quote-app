/**
 * Microsoft Graph API service
 *
 * Handles:
 *  1. Fetching the logged-in user's profile
 *  2. Querying the SharePoint Freight Quotes list
 *  3. Sending quote emails via /me/sendMail
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// SharePoint config from .env
const SP_HOST      = import.meta.env.VITE_SHAREPOINT_HOST      // e.g. mphunited.sharepoint.com
const SP_SITE_PATH = import.meta.env.VITE_SHAREPOINT_SITE_PATH // e.g. /sites/MPHOrders
const FREIGHT_LIST = import.meta.env.VITE_FREIGHT_LIST_NAME    // e.g. Freight Quotes

/**
 * Generic authenticated Graph fetch helper.
 * Passes the MSAL-issued Bearer token on every request.
 */
async function graphFetch(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      `Graph API error ${response.status}: ${err.error?.message || response.statusText}`
    )
  }

  // 204 No Content (e.g. sendMail) has no body – return null instead of crashing
  if (response.status === 204) return null

  return response.json()
}

/** ----------------------------------------------------------------
 *  1. User Profile
 * ---------------------------------------------------------------- */
export async function getUserProfile(accessToken) {
  return graphFetch(
    accessToken,
    `${GRAPH_BASE}/me?$select=displayName,mail,userPrincipalName`
  )
}

/** ----------------------------------------------------------------
 *  2. SharePoint – Freight Quotes lookup
 *
 *  NOTE ON SHAREPOINT FIELD NAMES:
 *  SharePoint stores column names with spaces as "Column_x0020_Name".
 *  If your list columns have different internal names, update the
 *  FIELD_MAP object below to match exactly.
 * ---------------------------------------------------------------- */

// Maps logical names → SharePoint internal field names
// Adjust these if the Graph API returns different field keys
export const FIELD_MAP = {
  status:           'Status',
  lane:             'Lane',
  originCity:       'OriginCity',
  originState:      'OriginState',
  destCity:         'DestinationCity',
  destState:        'DestinationState',
  carrier:          'FreightCarrier',
  quoteAmount:      'QuoteAmount',
  mileage:          'Mileage',
  quoteDate:        'QuoteDate',
  notes:            'Notes',
}

/**
 * Cache the SharePoint site ID to avoid repeated lookups.
 */
let _siteId = null

async function getSiteId(accessToken) {
  if (_siteId) return _siteId
  const data = await graphFetch(
    accessToken,
    `${GRAPH_BASE}/sites/${SP_HOST}:${SP_SITE_PATH}`
  )
  _siteId = data.id
  return _siteId
}

/**
 * Cache the list ID for Freight Quotes.
 */
let _listId = null

async function getListId(accessToken, siteId) {
  if (_listId) return _listId
  const data = await graphFetch(
    accessToken,
    `${GRAPH_BASE}/sites/${siteId}/lists?$filter=displayName eq '${encodeURIComponent(FREIGHT_LIST)}'&$select=id,displayName`
  )
  if (!data.value?.length) {
    throw new Error(`List "${FREIGHT_LIST}" not found on SharePoint site.`)
  }
  _listId = data.value[0].id
  return _listId
}

/**
 * Query the Freight Quotes SharePoint list for all active quotes
 * matching origin and destination.
 *
 * Returns an array of:
 * {
 *   carrier: string,
 *   quoteAmount: number,
 *   mileage: number | null,
 *   quoteDate: string | null,
 *   notes: string | null,
 *   originCity: string,
 *   originState: string,
 *   destCity: string,
 *   destState: string,
 * }
 */
export async function getFreightQuotes(accessToken, originCity, originState, destCity, destState) {
  const siteId = await getSiteId(accessToken)
  const listId = await getListId(accessToken, siteId)

  const fm = FIELD_MAP

  // Fetch all items without an OData filter – SharePoint list columns are not
  // indexed so server-side filtering throws a 400 error. We fetch everything
  // (804 rows is fast) and filter client-side instead.
  // The Prefer header suppresses the "non-indexed query" warning for any
  // future server-side filters we may add.
  let allItems = []
  let url =
    `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/items` +
    `?$expand=fields&$top=999`

  while (url) {
    const data = await graphFetch(accessToken, url, {
      headers: {
        Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
      },
    })
    allItems = allItems.concat(data.value || [])
    url = data['@odata.nextLink'] || null   // follow pagination if >999 rows
  }

  // All filtering is done client-side
  const originCityLower  = originCity.trim().toLowerCase()
  const originStateLower = originState.trim().toUpperCase()
  const destCityLower    = destCity.trim().toLowerCase()
  const destStateLower   = destState.trim().toUpperCase()

  const results = allItems
    .map(item => item.fields)
    .filter(f => {
      const status = (f[fm.status] || '').toUpperCase()
      const oCity  = (f[fm.originCity]  || '').toLowerCase()
      const oState = (f[fm.originState] || '').toUpperCase()
      const dCity  = (f[fm.destCity]    || '').toLowerCase()
      const dState = (f[fm.destState]   || '').toUpperCase()
      return (
        status === 'ACTIVE' &&
        oState === originStateLower &&
        dState === destStateLower &&
        oCity.includes(originCityLower) &&
        dCity.includes(destCityLower)
      )
    })
    .map(f => ({
      carrier:     f[fm.carrier]      || 'Unknown Carrier',
      quoteAmount: parseFloat(f[fm.quoteAmount]) || 0,
      mileage:     f[fm.mileage]      ? parseInt(f[fm.mileage]) : null,
      quoteDate:   f[fm.quoteDate]    || null,
      notes:       f[fm.notes]        || null,
      originCity:  f[fm.originCity]   || originCity,
      originState: f[fm.originState]  || originState,
      destCity:    f[fm.destCity]     || destCity,
      destState:   f[fm.destState]    || destState,
    }))
    .sort((a, b) => a.quoteAmount - b.quoteAmount)

  return results
}

/** ----------------------------------------------------------------
 *  3. Destination Cities – unique list from SharePoint for combo box
 * ---------------------------------------------------------------- */

/**
 * Returns a sorted array of unique destination city+state objects
 * from the Freight Quotes list, e.g. [{ city: 'Ames', state: 'IA' }, ...]
 * Used to populate the datalist suggestion in FreightLookup.
 */
export async function getDestinationCities(accessToken) {
  const siteId = await getSiteId(accessToken)
  const listId = await getListId(accessToken, siteId)

  const fm = FIELD_MAP
  let allItems = []
  let url =
    `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/items` +
    `?$expand=fields&$select=fields/${fm.destCity},fields/${fm.destState}&$top=999`

  while (url) {
    const data = await graphFetch(accessToken, url, {
      headers: { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' },
    })
    allItems = allItems.concat(data.value || [])
    url = data['@odata.nextLink'] || null
  }

  const seen = new Set()
  const cities = []
  for (const item of allItems) {
    const f = item.fields || {}
    const city  = (f[fm.destCity]  || '').trim()
    const state = (f[fm.destState] || '').trim()
    if (!city) continue
    const key = `${city}|${state}`
    if (!seen.has(key)) {
      seen.add(key)
      cities.push({ city, state })
    }
  }

  return cities.sort((a, b) =>
    a.city.localeCompare(b.city) || a.state.localeCompare(b.state)
  )
}

/** ----------------------------------------------------------------
 *  4. Send Email via /me/sendMail
 * ---------------------------------------------------------------- */

/**
 * Sends the quote summary email from the logged-in user's M365 account.
 *
 * @param {string} accessToken  - MSAL token with Mail.Send scope
 * @param {string[]} toAddresses - Recipient email addresses
 * @param {string} subject
 * @param {string} htmlBody     - HTML content for the email body
 */
export async function sendQuoteEmail(accessToken, toAddresses, subject, htmlBody) {
  const message = {
    subject,
    body: {
      contentType: 'HTML',
      content: htmlBody,
    },
    toRecipients: toAddresses.map(addr => ({
      emailAddress: { address: addr },
    })),
  }

  await graphFetch(accessToken, `${GRAPH_BASE}/me/sendMail`, {
    method: 'POST',
    body: JSON.stringify({ message, saveToSentItems: true }),
  })
}
