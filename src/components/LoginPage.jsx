import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'

export default function LoginPage() {
  const { instance } = useMsal()

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch(console.error)
  }

  return (
    <div className="min-h-screen bg-mph-navy flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">

        {/* Logo */}
        <div className="mb-6">
          <img
            src="/MPH-Logo.png"
            alt="MPH United"
            className="h-16 mx-auto mb-3 object-contain"
          />
          <p className="text-gray-500 text-sm mt-1">Sales Quote Calculator</p>
        </div>

        <p className="text-gray-600 text-sm mb-8">
          Sign in with your MPH United Microsoft 365 account to access the quote tool.
        </p>

        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-mph-navy hover:bg-mph-navyDark
                     text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-150
                     focus:outline-none focus:ring-2 focus:ring-mph-amber focus:ring-offset-2"
        >
          {/* Microsoft logo SVG */}
          <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0"  y="0"  width="10" height="10" fill="#F25022"/>
            <rect x="11" y="0"  width="10" height="10" fill="#7FBA00"/>
            <rect x="0"  y="11" width="10" height="10" fill="#00A4EF"/>
            <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
          </svg>
          Sign in with Microsoft 365
        </button>

        <p className="text-xs text-gray-400 mt-6">
          Access restricted to @mphunited.com accounts
        </p>
      </div>
    </div>
  )
}
