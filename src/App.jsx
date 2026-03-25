import { useEffect, useState } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { graphScopes } from './authConfig'
import { getUserProfile } from './graphService'
import LoginPage from './components/LoginPage'
import QuoteCalculator from './components/QuoteCalculator'

export default function App() {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  const [userProfile, setUserProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)

  // Fetch the user's M365 profile after login
  useEffect(() => {
    if (!isAuthenticated || inProgress !== InteractionStatus.None || accounts.length === 0) return

    async function fetchProfile() {
      try {
        const tokenResponse = await instance.acquireTokenSilent({
          scopes: graphScopes.user,
          account: accounts[0],
        })
        const profile = await getUserProfile(tokenResponse.accessToken)
        setUserProfile(profile)
      } catch (err) {
        console.error('Failed to fetch user profile:', err)
        setProfileError('Could not load your profile. Please sign out and sign in again.')
      }
    }

    fetchProfile()
  }, [isAuthenticated, inProgress, accounts, instance])

  // Show spinner while MSAL is initializing
  if (inProgress !== InteractionStatus.None) {
    return (
      <div className="min-h-screen bg-mph-navy flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-10 h-10 border-4 border-mph-amber border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-blue-200">Signing in…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  if (profileError) {
    return (
      <div className="min-h-screen bg-mph-navy flex items-center justify-center px-4">
        <div className="bg-white rounded-xl p-8 max-w-sm w-full text-center shadow-xl">
          <p className="text-red-600 text-sm mb-4">{profileError}</p>
          <button
            onClick={() => instance.logoutRedirect()}
            className="btn-primary w-full"
          >
            Sign Out and Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-mph-navy flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-10 h-10 border-4 border-mph-amber border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-blue-200">Loading your profile…</p>
        </div>
      </div>
    )
  }

  return <QuoteCalculator userProfile={userProfile} />
}
