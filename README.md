# ApplySafe — Job Scam Detector

A Chrome extension that helps job seekers spot fraudulent job postings before they apply.

## Features

- Real-time scam detection on LinkedIn, Indeed, Glassdoor, and 30+ job sites
- Risk scoring (0–100) with color-coded badges (green / yellow / red)
- Google Sign-In with free guest scans and Pro subscription via Stripe
- Dashboard to track scan history, whitelist companies, and export data
- Falls back to heuristic detection when no API key is configured

## Setup

### Load the extension

1. Open `chrome://extensions/` and enable **Developer mode**
2. Click **Load unpacked** and select the `applysafe-extension/` folder
3. After reload, this repo should keep the stable extension ID `flfknohnjagnocbkeedkokpllmlmomlp`

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. Enable the **Google Identity** API and create an OAuth 2.0 Client ID of type **Chrome Extension**
3. In the Google client setup, use the extension ID `flfknohnjagnocbkeedkokpllmlmomlp` as the Item ID
4. Replace `oauth2.client_id` in `applysafe-extension/manifest.json` with your Chrome Extension Client ID
5. Reload the extension after updating the manifest

If you see `redirect_uri_mismatch`, the Google OAuth client usually belongs to a different extension ID than the one currently loaded in Chrome. The redirect for this build should resolve to `https://flfknohnjagnocbkeedkokpllmlmomlp.chromiumapp.org/`.

### Claude API (optional)

Get a key from [console.anthropic.com](https://console.anthropic.com/) and enter it in the extension settings. Without it, heuristic detection is used.

### Backend

```bash
cd backend
npm install
npm start
```

Requires PostgreSQL. For Supabase, use the Transaction pooler connection string in `DATABASE_URL`:

`postgresql://postgres.[project-ref]:[url-encoded-password]@aws-[region].pooler.supabase.com:6543/postgres`

If you get `Tenant or user not found`, re-copy the exact pooler URI from Supabase Dashboard > Connect, keep the username in the form `postgres.[project-ref]`, and URL-encode any special characters in the password.

## Project Structure

```
applysafe-extension/
├── manifest.json
├── background/        # Service worker — AI analysis & auth
├── content/           # Page scanning & warning overlays
├── popup/             # Extension popup UI
├── dashboard/         # Full dashboard page
├── options/           # Settings page
└── icons/
backend/               # Node.js API (auth, subscriptions, scan history)
website/               # Marketing site
```

## Risk Scores

| Score | Meaning |
|-------|---------|
| 0–30  | Appears safe |
| 31–60 | Proceed with caution |
| 61–100 | High risk — likely a scam |
