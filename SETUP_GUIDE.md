# MPH Quote App — Setup & Deployment Guide

Follow these steps in order. The whole process takes about 30–45 minutes the first time.

---

## Step 1 — Create the Azure AD App Registration (one-time)

This tells Microsoft that your web app is allowed to sign in MPH United users
and read the SharePoint Freight Quotes list.

1. Go to **https://portal.azure.com** and sign in with your @mphunited.com admin account.
2. In the left sidebar click **Azure Active Directory** → **App registrations** → **+ New registration**.
3. Fill in:
   - **Name:** `MPH Quote App`
   - **Supported account types:** *Accounts in this organizational directory only (mphunited.com)*
   - **Redirect URI:** Platform = **Single-page application (SPA)**, URI = `http://localhost:5173`
4. Click **Register**. You'll land on the app's Overview page.
5. Copy the **Application (client) ID** — you'll need it in Step 3.
6. Click **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**.
   Add all three:
   - `User.Read`
   - `Sites.Read.All`
   - `Mail.Send`
7. Click **Grant admin consent for mphunited.com** (requires admin role).
8. Click **Authentication** in the left menu → under **Single-page application**, add a second redirect URI:
   - `https://YOUR-VERCEL-URL.vercel.app`  ← add this after Vercel deployment (Step 6)

---

## Step 2 — Install Node.js (if not already installed)

Download from **https://nodejs.org** — choose the LTS version.
Verify with: `node -v` in a terminal. You need version 18 or higher.

---

## Step 3 — Configure environment variables

1. Inside the `mph-quote-app` folder, copy `.env.example` to a new file named `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` in any text editor and fill in your Client ID:
   ```
   VITE_AZURE_CLIENT_ID=paste-your-client-id-here
   VITE_AZURE_TENANT_ID=3abf2937-e518-43e5-b2a4-456eecfa8b00
   VITE_SHAREPOINT_HOST=mphunited.sharepoint.com
   VITE_SHAREPOINT_SITE_PATH=/sites/MPHOrders
   VITE_FREIGHT_LIST_NAME=Freight Quotes
   ```
3. Save the file. **Never commit `.env` to GitHub** — it is already in `.gitignore`.

---

## Step 4 — Run locally (test before deploying)

Open a terminal, navigate to the `mph-quote-app` folder, and run:

```bash
npm install        # installs all dependencies (~1 minute)
npm run dev        # starts the local dev server
```

Open **http://localhost:5173** in your browser. You should see the MPH login screen.
Sign in with your @mphunited.com account and test all features.

---

## Step 5 — Push to GitHub

```bash
# From inside the mph-quote-app folder:
git init
git add .
git commit -m "Initial MPH Quote App"
git branch -M main
git remote add origin https://github.com/mphunited/mph-quote-app.git
git push -u origin main
```

> Create the `mph-quote-app` repository on GitHub first at https://github.com/mphunited

---

## Step 6 — Deploy to Vercel

1. Go to **https://vercel.com/mphuniteds-projects** and click **Add New Project**.
2. Import the `mph-quote-app` repository from GitHub.
3. Vercel will auto-detect Vite. Framework preset = **Vite**.
4. Under **Environment Variables**, add each line from your `.env` file:
   - `VITE_AZURE_CLIENT_ID` → your client ID
   - `VITE_AZURE_TENANT_ID` → `3abf2937-e518-43e5-b2a4-456eecfa8b00`
   - `VITE_SHAREPOINT_HOST` → `mphunited.sharepoint.com`
   - `VITE_SHAREPOINT_SITE_PATH` → `/sites/MPHOrders`
   - `VITE_FREIGHT_LIST_NAME` → `Freight Quotes`
5. Click **Deploy**. Vercel gives you a URL like `https://mph-quote-app.vercel.app`.
6. Go back to **Azure Portal → App registrations → MPH Quote App → Authentication**
   and add that Vercel URL as a second redirect URI (SPA type).

---

## Step 7 — Share the URL with your team

Send the Vercel URL to your sales team. They sign in once with their @mphunited.com
Microsoft account and they're ready to go.

---

## Updating the App Later

To change vendor prices, add vendors, or update the customer list:
- Edit `src/vendorConfig.js` locally
- `git commit` and `git push`
- Vercel auto-deploys within ~1 minute

---

## Adding the MPH Logo

1. Drop your logo file (PNG or SVG) into the `public/` folder (e.g., `public/mph-logo.png`)
2. Open `src/components/LoginPage.jsx` and `src/components/QuoteCalculator.jsx`
3. Replace the placeholder `<div>` with `<img src="/mph-logo.png" ... />`
4. Update the two color values in `tailwind.config.js` (`mph.navy` and `mph.amber`)
   to match your logo's exact hex codes.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "AADSTS700054: response_type 'token' is not enabled" | Make sure the redirect URI is set as **SPA** type in Azure, not Web |
| Freight lookup returns no results | Check that the SharePoint list field names match `FIELD_MAP` in `src/graphService.js` |
| "Sites.Read.All: Access denied" | An admin needs to grant tenant-wide consent in Azure Portal |
| Commission field not showing | Verify your email is in the `COMMISSION_VISIBLE_EMAILS` list in `src/authConfig.js` |
| Email fails to send | Ensure `Mail.Send` permission was granted admin consent in Azure |
