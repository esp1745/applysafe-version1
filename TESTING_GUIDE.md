# 🧪 ApplySafe OAuth Testing Guide

## Quick Start Testing

### 1. Load Extension in Chrome

```bash
# Open Chrome and navigate to:
chrome://extensions/

# Enable "Developer mode" (top right)
# Click "Load unpacked"
# Select folder:
/Users/esparancetuyishime/Documents/APPLYSAFE-VERSION-1/applysafe-extension
```

### 2. Verify Extension Loaded

You should see:
- ✅ Extension icon in Chrome toolbar
- ✅ Extension ID: `fpbafilphhghfhhlaifidkngjnppjmcb`
- ✅ No errors in console

### 3. Test Sign-In Flow

**Step 1: Open Popup**
- Click extension icon
- Should see "Sign in with Google" button
- User section shows anonymous state

**Step 2: Click Sign In**
- Click "Sign in with Google" button
- Google OAuth consent screen appears
- Select your test user account
- Grant permissions (email, profile)

**Step 3: Verify Sign-In**
- Popup should update to show:
  - Your profile picture
  - Your name
  - Your email address
  - Sign out button

**Step 4: Check Console**
```javascript
// Open DevTools on popup (right-click popup → Inspect)
// Check console for:
"ApplySafe: Signed in successfully"
"User: your-email@gmail.com"
```

### 4. Test Usage Limits

**Anonymous User Testing:**
```javascript
// Before signing in, test local trial:

// 1. Open Chrome DevTools
// 2. Go to Application → Storage → Local Storage
// 3. Find extension storage
// 4. Check values:
{
  trialStartDate: 1702665600000,
  scansToday: 0,
  lastScanDate: "2024-12-15"
}

// 5. Test 10 scans (analyze jobs until limit)
// 6. Verify "Daily limit reached" message
```

**Signed-In User Testing:**
```javascript
// After signing in:

// 1. Analyze a job posting
// 2. Check backend logs (terminal):
"Usage check: user_123... - scansToday: 1/10"

// 3. Analyze 9 more jobs
// 4. On 11th attempt, should see:
"Daily limit reached (10/10)"
```

### 5. Test Sign Out

**Step 1: Click Sign Out**
- Click sign out button in popup
- Popup should return to anonymous state

**Step 2: Verify Storage Cleared**
```javascript
// DevTools → Application → Storage
// Check that these are removed:
- authToken
- user
```

**Step 3: Verify Anonymous Mode**
- Should see "Sign in with Google" button again
- Local trial should resume

### 6. Test Pro Upgrade Flow

**Prerequisites:**
- Must be signed in with Google
- Need Stripe test mode enabled

**Step 1: Click Upgrade**
- Click "Upgrade to Pro" button in popup
- Should open Stripe checkout page

**Step 2: Complete Test Payment**
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

**Step 3: Verify Pro Activation**
- Redirect to success page
- Check backend logs:
```
"User upgraded to Pro: your-email@gmail.com"
"Subscription status: active"
```

**Step 4: Test Unlimited Scans**
- Analyze more than 10 jobs in one day
- Should work without limits
- No "daily limit" message

### 7. Test Error Handling

**Test 1: Backend Offline**
```bash
# Stop backend server
pkill -f "node server.js"

# Try to sign in
# Should see error message
# Extension should fallback to local trial
```

**Test 2: Invalid Token**
```javascript
// Manually corrupt token in storage
chrome.storage.local.set({
  authToken: 'invalid_token_123'
});

// Try to analyze job
// Should sign out user automatically
// Fallback to anonymous mode
```

**Test 3: Expired Trial**
```javascript
// Set trial start date to 8 days ago
const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
chrome.storage.local.set({
  trialStartDate: eightDaysAgo
});

// Try to analyze job
// Should see "Trial expired" message
```

## Debugging Tips

### Check Extension Logs
```javascript
// Service Worker Console:
chrome://extensions/
→ Find ApplySafe
→ Click "Inspect views: service worker"
→ Check Console tab

// Popup Console:
→ Click extension icon
→ Right-click popup
→ Inspect
→ Check Console tab
```

### Check Backend Logs
```bash
# Terminal running backend shows:
"New user created: email@example.com"
"User logged in: email@example.com"  
"Usage check: user_123... - scansToday: 5/10"
"User upgraded to Pro: email@example.com"
```

### Check Storage
```javascript
// View all extension storage:
chrome.storage.local.get(null, (data) => {
  console.log('Storage:', data);
});

// Clear all storage:
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
});
```

### Check Backend API
```bash
# Health check
curl http://localhost:3001/health

# Test auth endpoint (need valid Google token)
curl -X POST http://localhost:3001/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"googleToken":"ya29...","email":"test@example.com","name":"Test User","picture":""}'

# Test usage check (need JWT token)
curl -X POST http://localhost:3001/api/usage/check \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"feature":"scan"}'
```

## Common Issues & Solutions

### Issue: "Sign in with Google" Does Nothing

**Solution:**
1. Check manifest.json has `identity` permission
2. Verify Client ID in manifest matches Google Cloud Console
3. Check if test user is added in OAuth consent screen
4. Look for errors in service worker console

### Issue: Backend Returns 401 "No token provided"

**Solution:**
1. Check authToken is in chrome.storage.local
2. Verify token is being sent in Authorization header
3. Check backend authenticateToken middleware
4. Token may have expired (30-day limit)

### Issue: Usage Limits Not Working

**Solution:**
1. Check backend userUsage Map has user entry
2. Verify daily reset logic (midnight check)
3. Check scansToday counter incrementing
4. Look for errors in backend logs

### Issue: Pro Upgrade Doesn't Work

**Solution:**
1. Verify Stripe keys in .env are correct
2. Check STRIPE_PRICE_ID matches your product
3. Ensure webhook is configured (or comment out signature verification for testing)
4. Check Stripe dashboard for payment events

## Test Checklist

Print this and check off as you test:

- [ ] Extension loads without errors
- [ ] Popup opens and displays correctly
- [ ] Anonymous user can analyze jobs (local trial)
- [ ] Daily limit enforced (10 scans)
- [ ] "Sign in with Google" button works
- [ ] OAuth flow completes successfully
- [ ] User info displays (name, email, picture)
- [ ] Signed-in user scans tracked server-side
- [ ] Sign out button works
- [ ] Storage cleared after sign out
- [ ] Upgrade button appears for signed-in users
- [ ] Stripe checkout opens
- [ ] Test payment processes
- [ ] Pro subscription activates
- [ ] Pro users have unlimited scans
- [ ] Trial expiration works (7 days)
- [ ] Error messages display correctly
- [ ] Fallback to local trial on backend failure
- [ ] Extension works on multiple job sites
- [ ] H1B verification works for Pro users

## Production Testing

Before deploying to production:

1. **Deploy Backend to Vercel**
   ```bash
   cd backend
   git add .
   git commit -m "Add OAuth"
   git push
   ```

2. **Update Environment Variables in Vercel**
   - Add GOOGLE_CLIENT_ID
   - Add JWT_SECRET
   - Keep existing Stripe keys

3. **Test Production Backend**
   ```bash
   curl https://applysafe-version1.vercel.app/health
   ```

4. **Update Extension to Use Production URL**
   - Verify API_ENDPOINT in auth.js points to:
   - `https://applysafe-version1.vercel.app/api`

5. **Create Production ZIP**
   ```bash
   cd applysafe-extension
   zip -r ../applysafe-oauth.zip * -x "*.git*" -x "*node_modules*"
   ```

6. **Upload to Chrome Web Store**
   - Log in to Chrome Web Store Developer Dashboard
   - Upload new ZIP
   - Update description (already done)
   - Add permission justification for `identity`
   - Submit for review

7. **Monitor First Users**
   - Watch backend logs for sign-ins
   - Check error rates
   - Monitor Stripe dashboard for payments

## Success Metrics

Track these after deployment:

- **User Acquisition**: Anonymous → Sign-in conversion rate
- **Engagement**: Average scans per user per day
- **Revenue**: Free → Pro conversion rate
- **Retention**: 7-day trial completion rate
- **Technical**: API response times, error rates

---

**Happy Testing! 🚀**

If you encounter any issues, check:
1. Service worker console
2. Popup console
3. Backend terminal logs
4. Chrome DevTools → Application → Storage
