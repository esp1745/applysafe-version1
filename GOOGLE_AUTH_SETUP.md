# Google OAuth Setup Guide for ApplySafe

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "NEW PROJECT"
3. Name: `ApplySafe`
4. Click "CREATE"

## Step 2: Enable APIs

1. Go to "APIs & Services" → "Enable APIs and Services"
2. Search for "Google+ API" → Click → Enable
3. Search for "Identity Toolkit API" → Click → Enable

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" → Click "CREATE"
3. Fill out:
   - **App name**: ApplySafe
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click "SAVE AND CONTINUE"
5. **Scopes**: Click "ADD OR REMOVE SCOPES"
   - Select: `userinfo.email`
   - Select: `userinfo.profile`
6. Click "SAVE AND CONTINUE"
7. **Test users**: Add your email (for testing)
8. Click "SAVE AND CONTINUE"

## Step 4: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "CREATE CREDENTIALS" → "OAuth client ID"
3. Application type: **Chrome extension**
4. Name: `ApplySafe Extension`
5. **Item ID**: 
   - If published: Use your Chrome Web Store extension ID
   - If testing: Get ID from `chrome://extensions` (turn on Developer mode)
6. Click "CREATE"
7. **Copy the Client ID** (looks like: `123456789-abc...apps.googleusercontent.com`)

## Step 5: Update Extension

Replace in `manifest.json`:
```json
"client_id": "YOUR_ACTUAL_CLIENT_ID_HERE.apps.googleusercontent.com"
```

Replace in `background/auth.js`:
```javascript
CLIENT_ID: 'YOUR_ACTUAL_CLIENT_ID_HERE.apps.googleusercontent.com'
```

## Step 6: Update Backend

Add to `backend/.env`:
```
GOOGLE_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID_HERE.apps.googleusercontent.com
JWT_SECRET=generate_random_secret_key_here
```

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 7: Install Backend Dependencies

```bash
cd backend
npm install jsonwebtoken google-auth-library
```

## Step 8: Add Auth Endpoints to Server

In `backend/server.js`, add:
```javascript
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// Copy all endpoints from auth-endpoints.js
```

## Step 9: Test Authentication

1. Load unpacked extension
2. Click extension icon
3. Click "Sign in with Google"
4. Authorize the app
5. Check that user info appears

## Step 10: Deploy to Production

1. Update Vercel environment variables:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   JWT_SECRET=your_jwt_secret
   ```

2. Redeploy:
   ```bash
   cd backend
   vercel --prod
   ```

3. Update Chrome Web Store submission with new permissions

## New User Flow

### Anonymous Users (No Sign-In):
- ✅ 7-day free trial
- ✅ 10 scans per day
- ✅ Local storage only
- ⚠️ Data lost if extension removed

### Signed-In Users (Free):
- ✅ 7-day free trial
- ✅ 10 scans per day
- ✅ Server-side tracking
- ✅ Data synced across devices
- ✅ Can upgrade to Pro anytime

### Pro Users (Paid):
- ✅ Unlimited scans
- ✅ Priority support
- ✅ All features unlocked
- ✅ No daily limits

## Benefits of This Approach

1. **Lower Barrier**: Users can try without payment
2. **Better Tracking**: Server knows each user's usage
3. **Cross-Device**: Usage syncs across Chrome installs
4. **Stripe Still Used**: Only for Pro upgrades
5. **Google Sign-In**: Users already have Google accounts

## Testing Checklist

- [ ] Anonymous user can use free trial
- [ ] Sign in with Google works
- [ ] Daily limits enforced for free users
- [ ] Pro upgrade creates Stripe session
- [ ] Webhook activates Pro status
- [ ] Pro users have unlimited access
- [ ] Sign out clears data

## Next Steps

1. Get Google OAuth Client ID
2. Update manifest.json and auth.js
3. Add JWT_SECRET to backend
4. Merge auth endpoints into server.js
5. Test locally
6. Deploy to Vercel
7. Update Chrome Web Store listing
