import { useState, useEffect } from 'react'
import { useMsal } from '@azure/msal-react'
import { graphScopes } from '../authConfig'
import { getFreightQuotes, getDestinationCities } from '../graphService'
import { fmtCurrency } from '../calculations'
import { US_STATES } from '../vendorConfig'

/**
 * FreightLookup component
 *
 * Props:
 *  originCity    {string}  – pre-filled from vendor selection
 *  originState   {string}  – pre-filled from vendor selection
 *  onSelect      {fn}      – called with { carrier, quoteAmount, mileage } when user picks a row
 *  selectedQuote {object}  – currently selected quote (for highlight)
 */
export default function FreightLookup({ originCity, originState, onSelect, selectedQuote }) {
  const { instance, accounts } = useMsal()

  const [destCity,   setDestCity]   = useState('')
  const [destState,  setDestState]  = useState('')
  const [originCityLocal,  setOriginCityLocal]  = useState(originCity  || '')
  const [originStateLocal, setOriginStateLocal] = useState(originState || '')
  const [quotes,     setQuotes]     = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [searched,   setSearched]   = useState(false)
  const [destCities, setDestCities] = useState([])  // for datalist suggestions

  // Load unique destination cities from SharePoint on mount
  useEffect(() => {
    async function loadCities() {
      try {
        const account = accounts[0]
        if (!account) return
        const tokenResponse = await instance.acquireTokenSilent({
          scopes: graphScopes.sharePoint,
          account,
        })
        const cities = await getDestinationCities(tokenResponse.accessToken)
        setDestCities(cities)
      } catch (err) {
        // Non-critical – suggestions just won't appear; user can still type freely
        console.warn('Could not load destination city suggestions:', err.message)
      }
    }
    loadCities()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep local origin in sync when parent vendor changes
  if (originCity !== undefined && originCity !== originCityLocal) {
    setOriginCityLocal(originCity)
  }
  if (originState !== undefined && originState !== originStateLocal) {
    setOriginStateLocal(originState)
  }

  async function handleLookup() {
    if (!originCityLocal || !originStateLocal || !destCity || !destState) {
      setError('Please fill in all four location fields before looking up freight.')
      return
    }
    setError(null)
    setLoading(true)
    setSearched(true)

    try {
      const account = accounts[0]
      const tokenResponse = await instance.acquireTokenSilent({
        scopes: graphScopes.sharePoint,
        account,
      })
      const results = await getFreightQuotes(
        tokenResponse.accessToken,
        originCityLocal, originStateLocal,
        destCity, destState
      )
      setQuotes(results)
      if (results.length === 0) {
        setError(`No active quotes found for ${originCityLocal}, ${originStateLocal} → ${destCity}, ${destState}.`)
      }
    } catch (err) {
      console.error(err)
      setError(`Error fetching quotes: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Location inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Origin City</label>
          <input
            type="text"
            className="field-input"
            value={originCityLocal}
            onChange={e => setOriginCityLocal(e.target.value)}
            placeholder="e.g. Stanwood"
          />
        </div>
        <div>
          <label className="field-label">Origin State</label>
          <select
            className="field-input"
            value={originStateLocal}
            onChange={e => setOriginStateLocal(e.target.value)}
          >
            <option value="">— State —</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Destination City</label>
          <input
            type="text"
            className="field-input"
            list="dest-city-list"
            value={destCity}
            onChange={e => {
              const val = e.target.value
              setDestCity(val)
              const match = destCities.find(({ city }) => city.toLowerCase() === val.toLowerCase())
              if (match) setDestState(match.state)
            }}
            placeholder="e.g. Ames"
            autoComplete="off"
          />
          <datalist id="dest-city-list">
            {destCities.map(({ city, state }) => (
              <option key={`${city}|${state}`} value={city}>
                {city}, {state}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="field-label">Destination State</label>
          <select
            className="field-input"
            value={destState}
            onChange={e => setDestState(e.target.value)}
          >
            <option value="">— State —</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Lookup button */}
      <button
        onClick={handleLookup}
        disabled={loading}
        className="btn-secondary w-full sm:w-auto"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Searching…
          </span>
        ) : '🔍  Look Up Freight Quotes'}
      </button>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Results table */}
      {searched && !loading && quotes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-mph-navy text-white">
              <tr>
                <th className="text-left px-4 py-2">Carrier</th>
                <th className="text-right px-4 py-2">Quote</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">Miles</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Quote Date</th>
                <th className="px-4 py-2">Select</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, idx) => {
                const isSelected =
                  selectedQuote &&
                  selectedQuote.carrier === q.carrier &&
                  selectedQuote.quoteAmount === q.quoteAmount
                return (
                  <tr
                    key={idx}
                    className={`border-t border-gray-100 cursor-pointer transition-colors
                      ${isSelected
                        ? 'bg-amber-50 border-l-4 border-l-mph-amber'
                        : 'hover:bg-gray-50'}`}
                    onClick={() => onSelect(q)}
                  >
                    <td className="px-4 py-2 font-medium text-gray-800">{q.carrier}</td>
                    <td className="px-4 py-2 text-right font-semibold text-mph-navy">
                      {fmtCurrency(q.quoteAmount)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500 hidden sm:table-cell">
                      {q.mileage ? `${q.mileage.toLocaleString()} mi` : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-500 hidden md:table-cell">
                      {q.quoteDate
                        ? new Date(q.quoteDate).toLocaleDateString('en-US')
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {isSelected
                        ? <span className="text-mph-amber font-bold">✓</span>
                        : <span className="text-gray-300">○</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected summary */}
      {selectedQuote && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          ✓ Selected: <strong>{selectedQuote.carrier}</strong> — {fmtCurrency(selectedQuote.quoteAmount)}
          {selectedQuote.mileage ? ` (${selectedQuote.mileage.toLocaleString()} mi)` : ''}
        </p>
      )}
    </div>
  )
}
