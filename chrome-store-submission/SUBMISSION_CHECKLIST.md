# Chrome Web Store Submission Checklist

## Pre-Submission Requirements ✅

### 1. Developer Account Setup
- [ ] Create/login to Chrome Developer Dashboard (https://chrome.google.com/webstore/devconsole/)
- [ ] Verify your email address
- [ ] Set up payment method ($5 one-time developer registration fee)
- [ ] Accept Chrome Web Store policies

### 2. Extension Files Ready
- [x] manifest.json configured (Manifest V3)
- [x] All icons included (16px, 32px, 48px, 128px)
- [x] HTML/CSS/JavaScript files
- [x] Service worker (background/service-worker.js)
- [x] Content script (content/content.js)
- [x] Popup and dashboard files

### 3. Store Listing Assets

#### Screenshots (Required - at least 1, max 5)
- [ ] Screenshot 1: Main popup interface (1280x800 recommended)
- [ ] Screenshot 2: Dashboard Overview tab
- [ ] Screenshot 3: Scan History tab
- [ ] Screenshot 4: AI Tools tab
- [ ] Screenshot 5: Settings/Security features

**Screenshot Guidelines:**
- PNG or JPG format
- 1280x800 pixels (5:3 ratio)
- Show key features, not code
- Include UI that's easy to understand
- Add text overlays explaining features (optional but helpful)

#### Promotional Tile (Required)
- Size: 440x280 pixels
- Format: PNG or JPG
- Shows extension icon and brief benefit

#### Small Tile (Optional)
- Size: 128x128 pixels
- Format: PNG or JPG

### 4. Privacy & Legal
- [x] Privacy Policy created (PRIVACY_POLICY.md exists)
- [x] Terms of Service (optional but recommended)
- [ ] Privacy policy hosted on public website or submitted
- [ ] Comply with Chrome Web Store policies
- [ ] No tracking/analytics that violates privacy

### 5. Content Review
- [x] Name: "ApplySafe - AI Job Scam Detector"
- [x] Description reviewed and accurate
- [x] Keywords relevant (job scam, AI, safety, protection)
- [ ] No misleading claims
- [ ] No prohibited content (malware, unauthorized access, etc.)
- [ ] Rate content appropriately (if needed)

### 6. Technical Review
- [x] No permissions beyond what's necessary
- [x] Manifest V3 compliant
- [x] No eval() or dynamic script injection
- [x] No homepage_url required for enterprise extensions
- [x] API keys not exposed in code
- [x] External API calls to trusted services only

### 7. Security & Safety
- [ ] No malware scanner alerts
- [ ] No security vulnerabilities
- [ ] HTTPS connections for API calls
- [ ] Secure authentication (OAuth2)
- [ ] Data encryption for sensitive information
- [ ] Regular security updates

## Step-by-Step Submission Guide

### Step 1: Create Extension ZIP
```bash
cd /Users/esparancetuyishime/Documents/APPLYSAFE-VERSION-1
zip -r applysafe-extension.zip applysafe-extension/ \
  -x "applysafe-extension/node_modules/*" \
  "applysafe-extension/.git/*" \
  "applysafe-extension/.*"
```

### Step 2: Log Into Chrome Developer Dashboard
1. Go to https://chrome.google.com/webstore/devconsole/
2. Sign in with your Google account
3. Click "Create new item" or "New item"

### Step 3: Upload Extension
1. Click "Choose file" and select `applysafe-extension.zip`
2. Click "Upload"
3. Wait for automated validation (usually 1-5 minutes)

### Step 4: Fill Store Listing
1. **Package** tab:
   - View your uploaded package info
   - Note the Extension ID (save for manifest updates if needed)

2. **Store Listing** tab:
   - Title: "ApplySafe - AI Job Scam Detector"
   - Short description: (see STORE_LISTING.md)
   - Detailed description: (see STORE_LISTING.md)
   - Language: English
   - Category: Productivity

3. **Graphic Assets** tab:
   - Upload screenshots (5 recommended)
   - Upload promotional tile (440x280)
   - Add alt text for each image

4. **Additional Fields** tab:
   - Websites: Your official website (if available)
   - Privacy policy: Link to privacy policy
   - Support email: support@applysafe.com (or your email)
   - Category: Productivity
   - Language: English

5. **Content Rating** tab:
   - Answer questionnaire honestly
   - No sensitive content expected

### Step 5: Review Policies
- [ ] Read "Policies" section
- [ ] Confirm you agree to Chrome Web Store policies
- [ ] Confirm you own the extension
- [ ] Confirm no prohibited content

### Step 6: Submit for Review
1. Review all information
2. Click "Submit for review"
3. Pay $5 developer registration fee (if first time)
4. Confirm submission

### Step 7: Wait for Review
- **Timeline**: Usually 1-3 business days (can be longer)
- **Updates**: You'll receive email updates
- **Rejection**: If rejected, review feedback and resubmit

## Important Chrome Web Store Policies

### Prohibited
❌ Malware, spyware, or unauthorized data collection
❌ Deceptive functionality (different from description)
❌ Eval() and dynamic code execution
❌ Unauthorized access to accounts
❌ Copyright/trademark infringement
❌ Hate speech or discriminatory content
❌ Non-consensual intimate content
❌ Gambling or illegal activities
❌ Content targeting minors inappropriately

### Required
✅ Clear, accurate description
✅ Privacy policy if collecting data
✅ Proper permissions (only what you need)
✅ No external scripts except APIs
✅ Regular updates and maintenance
✅ User support mechanism

## Keywords for Store Listing

Primary: job scam, scam detector, job safety
Secondary: AI, H1B, LinkedIn, Indeed, job search, protection
Long-tail: job scam detector chrome extension, AI job analyzer

## Updating After Launch

1. Version bumps in manifest.json
2. Re-upload ZIP with new version
3. Update changelog in store listing
4. Submit for review again (usually faster)
5. New version goes live when approved

## Support & Maintenance

- Monitor Chrome Web Store reviews and ratings
- Respond to user feedback
- Fix bugs quickly
- Regular feature updates
- Keep privacy policy current
- Monitor for security issues

## Resources

- Chrome Web Store Developer Docs: https://developer.chrome.com/docs/webstore/
- Manifest V3 Guide: https://developer.chrome.com/docs/extensions/mv3/
- Privacy Policy Generator: https://www.privacypolicygenerator.info/
- Screenshot Tools: https://www.screenshottocode.com/

