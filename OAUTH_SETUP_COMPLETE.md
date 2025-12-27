# ApplySafe OAuth Integration - Complete Setup

## ✅ Completed Steps

### 1. Google Cloud Setup
- **Project Created**: ApplySafe
- **OAuth Consent Screen**: Configured (External)
- **Client ID Generated**: `683690946308-elfap4mi2oisga47asrl73l16leh11gl.apps.googleusercontent.com`
- **Scopes**: profile, email
- **Test Users**: Added your email for testing

### 2. Backend Changes
- **Dependencies Installed**: `jsonwebtoken`, `google-auth-library`
- **Environment Variables**: Added `GOOGLE_CLIENT_ID` and `JWT_SECRET` to `.env`
- **New Endpoints Added to server.js**:
  - `POST /api/auth/google` - Google OAuth login/registration
  - `POST /api/usage/check` - Feature usage validation (with JWT auth)
  - `GET /api/user/profile` - User profile and stats
  - `POST /api/user/upgrade` - Create Stripe checkout for Pro

### 3. Extension Changes
- **manifest.json**: 
  - Added `identity` and `identity.email` permissions
  - Added `oauth2` configuration with Client ID
  - Added `"type": "module"` to background script
- **background/auth.js**: Created complete OAuth flow
- **background/service-worker.js**:
  - Imports auth.js
  - Updated `analyzeJob()` to use new auth system
  - Added message handlers for auth actions
- **popup.html**: Added sign-in/sign-out UI
- **popup.css**: Added styles for user account section
- **popup.js**: Added auth status loading and sign-in handlers

### 4. Testing
- **Backend Running**: Port 3001 locally
- **Health Check**: ✅ Working
- **Test Page**: Created `test-auth.html` for OAuth flow testing

## 📋 Next Steps

### Step 1: Test Locally
1. Load extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `/Users/esparancetuyishime/Documents/APPLYSAFE-VERSION-1/applysafe-extension`

2. Open the test page:
   - Navigate to `file:///Users/esparancetuyishime/Documents/APPLYSAFE-VERSION-1/test-auth.html`
   - Or open it from the extensions folder

3. Test the flow:
   - Click extension icon to open popup
   - Click "Sign in with Google"
   - Complete OAuth flow
   - Verify user info appears
   - Test sign out

### Step 2: Update Vercel Environment Variables
Add these environment variables in Vercel dashboard:

```
GOOGLE_CLIENT_ID=683690946308-elfap4mi2oisga47asrl73l16leh11gl.apps.googleusercontent.com
JWT_SECRET=4c90b1e97cbcfcecf1cd292aa62335f18d89d542ceb6a96dbf197bb417ba3fbf
```

Keep existing:
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_ID`

### Step 3: Deploy to Production
```bash
cd /Users/esparancetuyishime/Documents/APPLYSAFE-VERSION-1/backend
git add .
git commit -m "Add Google OAuth authentication"
git push
```

Vercel will auto-deploy from your GitHub repo.

### Step 4: Update Chrome Web Store
After OAuth is tested and working:

1. Create new ZIP with OAuth-enabled extension
2. Upload to Chrome Web Store as new version
3. Add permission justification for `identity`:
   > "Enables Google sign-in for user authentication and usage tracking across devices"
4. Update privacy policy to mention Google OAuth
5. Wait for approval

### Step 5: Production Database (Important!)
Current implementation uses in-memory Maps which will lose data on server restart.

**Recommended**: Supabase (PostgreSQL)
- Free tier available
- 500MB database
- Built-in authentication
- Easy to integrate

## 🔄 New User Flow

### Anonymous User (First Time)
1. Installs extension → Gets 7-day trial (local tracking)
2. 10 scans per day
3. Sees "Sign in with Google" prompt
4. Trial info stored locally

### Signed-In User
1. Clicks "Sign in with Google"
2. OAuth flow → Backend creates user + JWT token
3. Server tracks usage (syncs across devices)
4. 7-day trial from sign-in date
5. 10 scans per day
6. Can upgrade to Pro via Stripe

### Pro User (Paid)
1. Clicks "Upgrade to Pro"
2. Stripe checkout → $9.99/month
3. Backend receives webhook → Activates Pro
4. Unlimited scans
5. H1B verification
6. Priority support

## 🏗️ Architecture

### Client Side (Extension)
```
popup.js → service-worker.js → auth.js → Google OAuth
   ↓           ↓                    ↓
Storage    Job Analysis         JWT Token
```

### Server Side (Backend)
```
/api/auth/google → Verify Token → Create User → Generate JWT
      ↓
/api/usage/check → Verify JWT → Check Limits → Allow/Deny
      ↓
/api/user/upgrade → Create Stripe Checkout → Redirect
      ↓
Stripe Webhook → Activate Pro → Update User
```

## 🐛 Troubleshooting

### OAuth Not Working
- Check Google Cloud Console → APIs & Services → Credentials
- Verify Client ID matches in manifest.json and auth.js
- Ensure test user email is added to OAuth consent screen
- Check browser console for errors

### Backend Errors
- Verify environment variables in `.env`
- Check `GOOGLE_CLIENT_ID` matches
- Ensure `JWT_SECRET` is set
- Test with `curl http://localhost:3001/health`

### Token Verification Failed
- Google token may have expired (1 hour lifetime)
- JWT token expires after 30 days
- Clear extension storage: `chrome.storage.local.clear()`

## 📊 Usage Limits

| User Type | Daily Scans | Trial Period | Cost |
|-----------|------------|--------------|------|
| Anonymous | 10 | 7 days (local) | Free |
| Signed In | 10 | 7 days (synced) | Free |
| Pro | Unlimited | N/A | $9.99/mo |

## 🔐 Security Notes

- JWT tokens expire after 30 days
- Google tokens verified server-side
- User passwords never stored (OAuth only)
- Stripe handles all payment processing
- CORS enabled for extension origin
- Environment variables never exposed to client

## 📁 Modified Files

### Backend
- ✅ `backend/server.js` - Added auth endpoints
- ✅ `backend/.env` - Added Google credentials
- ✅ `backend/package.json` - Added dependencies

### Extension
- ✅ `applysafe-extension/manifest.json` - OAuth config
- ✅ `applysafe-extension/background/auth.js` - Created
- ✅ `applysafe-extension/background/service-worker.js` - Updated
- ✅ `applysafe-extension/popup/popup.html` - Added UI
- ✅ `applysafe-extension/popup/popup.css` - Added styles
- ✅ `applysafe-extension/popup/popup.js` - Added handlers

## 🎯 Success Criteria

- [ ] User can sign in with Google from popup
- [ ] User info (name, email, picture) displays correctly
- [ ] Usage limits enforced server-side
- [ ] Anonymous users still get local trial
- [ ] Sign-out clears tokens
- [ ] Upgrade to Pro flow works
- [ ] Backend deployed to Vercel
- [ ] Chrome Web Store updated

## 🚀 Ready to Test!

The OAuth integration is complete. Start with local testing, then deploy to production, and finally update the Chrome Web Store listing.

Good luck! 🎉
