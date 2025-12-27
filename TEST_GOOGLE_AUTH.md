# Testing Google Authentication

## Changes Made:
1. ✅ Added `oauth2` configuration to [manifest.json](applysafe-extension/manifest.json)
2. ✅ Fixed auth export in [auth.js](applysafe-extension/background/auth.js) to make it globally available

## Testing Steps:

### 1. Load the Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `applysafe-extension` folder

### 2. Test Google Sign-In
1. Click the ApplySafe extension icon in toolbar
2. In the popup, you should see "Sign in with Google" button
3. Click the button
4. Google OAuth popup should appear
5. Sign in with your Google account
6. After authentication, you should see:
   - Your profile picture and name
   - "Successfully signed in!" message

### 3. Verify Authentication
Open Chrome DevTools Console and check for:
- `User signed in: your-email@gmail.com`
- No errors related to OAuth or identity

### 4. Test Sign Out
1. Click the sign out button (in the popup)
2. Should return to "Sign in with Google" button

## Troubleshooting:

### If you get "OAuth2 not granted" error:
This means your Client ID needs to be added to Chrome Web Store:
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Find your extension
3. Go to **OAuth consent screen** in Google Cloud Console
4. Add the extension ID to authorized domains

### If you get "identity API error":
1. Make sure `"identity"` permission is in manifest.json ✅ (already added)
2. Reload the extension after changes

### If nothing happens when clicking sign-in:
1. Open browser console (F12)
2. Look for errors
3. Check Network tab for blocked requests

## Expected Result:
✅ Google sign-in popup appears
✅ User can authenticate
✅ User data is stored
✅ UI updates to show signed-in state

## Next Steps After Testing:
- If working: Update version number and publish to Chrome Web Store
- If issues: Check browser console for specific error messages
