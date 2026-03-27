/**
 * Quote Builder Configuration
 *
 * Salesperson lookup by M365 email and quote number generation.
 */

export const SALESPERSON_DATA = {
  'jennifer@mphunited.com': {
    name: 'Jennifer Wilkes',
    phone: '251.367.7772',
    email: 'jennifer@mphunited.com',
    firstLetter: 'J',
  },
  'larry@mphunited.com': {
    name: 'Larry Mitchum',
    phone: '586.703.2555',
    email: 'larry@mphunited.com',
    firstLetter: 'L',
  },
  'mike@mphunited.com': {
    name: 'Michael Harding',
    phone: '251.269.7246',
    email: 'mike@mphunited.com',
    firstLetter: 'M',
  },
  'renee@mphunited.com': {
    name: 'Renee Sauvageau',
    phone: '763.453.1366',
    email: 'renee@mphunited.com',
    firstLetter: 'R',
  },
  'jack@mphunited.com': {
    name: 'Jack Schlaack',
    phone: '517.881.8309',
    email: 'jack@mphunited.com',
    firstLetter: 'J',
  },
  'jack2@mphunited.com': {
    name: 'Jack Schlaack',
    phone: '517.881.8309',
    email: 'jack@mphunited.com',
    firstLetter: 'J',
  },
}

/**
 * Look up salesperson record by email. Returns null if not found.
 */
export function getSalesperson(email) {
  return SALESPERSON_DATA[(email || '').toLowerCase()] || null
}

/**
 * Auto-generate a quote number.
 * Format: [FirstLetter][MMDDYY]-[n]
 * Example: J032626-1  (Jack, March 26, 2026, first quote of the day)
 *
 * Sequential counter is stored in localStorage per salesperson+date
 * so it survives page refreshes and increments properly through the day.
 */
export function generateQuoteNumber(firstLetter) {
  const letter = (firstLetter || 'X').toUpperCase()
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const dateStr = `${mm}${dd}${yy}`

  const storageKey = `mph_quote_seq_${letter}_${dateStr}`
  const current = parseInt(localStorage.getItem(storageKey) || '0') + 1
  localStorage.setItem(storageKey, String(current))

  return `${letter}${dateStr}-${current}`
}
