# ApplySafe — AI Job Scam Detector

A Chrome extension that protects job seekers from fraudulent job postings using AI-powered analysis.

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

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. Enable the **Google Identity** API and create an OAuth 2.0 Client ID (Chrome extension type)
3. Replace `client_id` in `manifest.json` with your Client ID

### Claude API (optional)

Get a key from [console.anthropic.com](https://console.anthropic.com/) and enter it in the extension settings. Without it, heuristic detection is used.

### Backend

```bash
cd backend
npm install
npm start
```

Requires PostgreSQL. Set `DATABASE_URL` and `STRIPE_SECRET_KEY` in your environment.

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
