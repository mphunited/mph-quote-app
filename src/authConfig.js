/**
 * MSAL Authentication Configuration
 * Microsoft Authentication Library for Microsoft 365 / Azure AD
 */

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

/**
 * Scopes required by the app.
 * - User.Read        : read logged-in user's profile (name, email)
 * - Sites.Read.All   : read SharePoint Freight Quotes list
 * - Mail.Send        : send email from user's account via Graph
 */
export const loginRequest = {
  scopes: ['User.Read', 'Sites.Read.All', 'Mail.Send'],
}

/**
 * Graph API scopes used at runtime (acquired silently after login)
 */
export const graphScopes = {
  user:      ['User.Read'],
  sharePoint:['Sites.Read.All'],
  mail:      ['Mail.Send'],
}

/**
 * Users who can see the Commission field.
 * All comparisons are lower-cased.
 */
export const COMMISSION_VISIBLE_EMAILS = [
  'renee@mphunited.com',
  'jack@mphunited.com',
  'jack2@mphunited.com',
  'david@mphunited.com',
  'mike@mphunited.com',
]
