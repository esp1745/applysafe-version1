# 🔍 ApplySafe Job Extraction Troubleshooting Guide

## Problem: Job Extraction Not Working

You're signed in with Google ✅, but jobs aren't being analyzed.

---

## 🚀 Quick Diagnostic

### Step 1: Check if Content Script is Loaded

1. Open a LinkedIn job posting page
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Look for logs starting with "ApplySafe:"
   - ✅ If you see them, content script is loaded
   - ❌ If you don't see them, there's an injection problem

### Step 2: Check Job Data Extraction

Use the **Job Extraction Debugger**:

1. Open [job-extraction-debugger.html](job-extraction-debugger.html)
2. Click **"Get Job Data from Active Tab"**
3. Check the results:
   - ✅ If you see job title and company, extraction is working
   - ❌ If no data, extraction selectors need updating

---

## 📋 Troubleshooting Steps

### Issue 1: Content Script Not Injecting

**Symptoms:**
- No "ApplySafe:" logs in console
- Page appears to have no extension

**Solutions:**

1. **Reload Extension**:
   ```
   - Go to chrome://extensions/
   - Find ApplySafe
   - Click the reload icon (↻)
   - Return to job posting page
   - Refresh the page (Ctrl+R)
   ```

2. **Check Manifest Permissions**:
   - The manifest should have these permissions:
     ```json
     "host_permissions": [
       "https://www.linkedin.com/*",
       "https://indeed.com/*",
       "https://www.glassdoor.com/*",
       ...
     ]
     ```

3. **Check Extension ID**:
   - Go to `chrome://extensions/`
   - Is the extension enabled? (toggle should be ON)
   - Is there an error message? Fix it first

### Issue 2: Job Data Not Extracting

**Symptoms:**
- Content script loads (see "ApplySafe:" logs)
- But no job title/company found
- Dashboard shows "No job detected"

**Solutions:**

1. **Update LinkedIn Selectors**:
   LinkedIn frequently updates HTML. The selectors in `SITE_SELECTORS` might be outdated.
   
   Debug the page structure:
   ```javascript
   // In DevTools Console on a LinkedIn job page:
   
   // Check for job title element
   document.querySelector('h1')?.textContent
   
   // Check for company element
   document.querySelector('[class*="company"]')?.textContent
   
   // Check available classes with "job"
   Array.from(document.querySelectorAll('[class*="job"]'))
     .map(el => el.className)
     .slice(0, 10)
   ```

2. **Use Job Extraction Debugger**:
   - Open the debugger while viewing a job posting
   - Click "Test Page Selectors"
   - This will show what elements were found/not found

3. **Check Current URL Patterns**:
   LinkedIn job URLs might have changed. Common patterns:
   - `/jobs/view/123456/` - Old format
   - `/jobs/view/?currentJobId=123456&position=1` - New format
   - Just `/jobs/` - Job search results (shouldn't analyze)

### Issue 3: Specific Job Sites Not Working

#### LinkedIn Not Working

1. Check the URL:
   ```
   ✅ Good: linkedin.com/jobs/view/123456/
   ✅ Good: linkedin.com/jobs/view/?id=123456
   ❌ Bad: linkedin.com/in/username/
   ❌ Bad: linkedin.com/feed/
   ```

2. Check element availability:
   ```javascript
   // DevTools Console
   document.querySelector('[class*="job-title"]')  // Should exist
   document.querySelector('[class*="company-name"]')  // Should exist
   ```

3. Update selectors in [content.js](applysafe-extension/content/content.js):
   ```javascript
   'linkedin.com': {
     title: 'h1, [class*="job-title"]',
     company: '[class*="company-name"]',
     description: '[class*="description"]',
     ...
   }
   ```

#### Indeed Not Working

1. Check URL:
   ```
   ✅ Good: indeed.com/viewjob?jk=abc123
   ✅ Good: indeed.com/jobs?q=...
   ❌ Bad: indeed.com (home page)
   ```

2. Find the right selectors:
   ```javascript
   // DevTools Console
   document.querySelector('h1')?.textContent  // Job title
   document.querySelector('[class*="company"]')?.textContent
   ```

#### Glassdoor Not Working

1. Check URL:
   ```
   ✅ Good: glassdoor.com/job-listing/123456
   ❌ Bad: glassdoor.com (search results)
   ```

---

## 🔧 How to Fix Extraction Selectors

### Step 1: Identify the Correct Element

1. Open a job posting page on the failing site
2. Press F12 → Elements tab
3. Click the element picker (top-left icon)
4. Click on the job title to highlight it
5. Note the HTML classes/IDs in the Inspector
6. Example: `<h1 class="jobs-details__title">Software Engineer</h1>`

### Step 2: Create a CSS Selector

From the example above, possible selectors:
- `h1.jobs-details__title`
- `.jobs-details__title`
- `h1[class*="title"]`
- Just `h1` (if it's unique)

### Step 3: Test the Selector

In DevTools Console:
```javascript
// Test your selector
document.querySelector('YOUR_SELECTOR_HERE')?.textContent

// If it works, use it in SITE_SELECTORS
```

### Step 4: Update content.js

Edit [applysafe-extension/content/content.js](applysafe-extension/content/content.js), find `SITE_SELECTORS`:

```javascript
'linkedin.com': {
  title: 'YOUR_SELECTOR_1, FALLBACK_SELECTOR_2',
  company: 'YOUR_COMPANY_SELECTOR',
  description: 'YOUR_DESCRIPTION_SELECTOR',
  // ... other fields
}
```

**Important**: Always provide multiple selectors separated by commas as fallbacks!

### Step 5: Reload Extension

1. Go to `chrome://extensions/`
2. Click reload on ApplySafe
3. Go back to the job page
4. Refresh the page
5. Check console for success logs

---

## 📊 Testing Checklist

- [ ] Content script logs appear in DevTools console
- [ ] Job title is extracted (see in "Get Job Data" debug)
- [ ] Company name is extracted
- [ ] Description is extracted (or shows as empty)
- [ ] Clicking "Analyze" button triggers backend analysis
- [ ] AI analysis results appear in popup
- [ ] H1B sponsorship status shows correctly

---

## 🛠️ Debug Script for Content Script

Run this in DevTools Console on any job posting page to test extraction:

```javascript
// Copy and paste this in DevTools Console:

console.log('=== ApplySafe Job Extraction Test ===');

// Check if content script is loaded
if (window.__APPLYSAFE_LOADED) {
  console.log('✅ Content script is loaded');
} else {
  console.log('❌ Content script is NOT loaded');
}

// Check for job title
const titles = document.querySelectorAll('h1, h2, [class*="title"], [class*="Title"]');
console.log(`Found ${titles.length} potential title elements:`);
Array.from(titles).slice(0, 5).forEach((el, i) => {
  const text = el.textContent.trim();
  if (text.length > 10 && text.length < 150) {
    console.log(`  ${i}: "${text.substring(0, 50)}..."`);
  }
});

// Check for company
const companies = document.querySelectorAll('[class*="company"], [class*="Company"]');
console.log(`Found ${companies.length} potential company elements:`);
Array.from(companies).slice(0, 5).forEach((el, i) => {
  const text = el.textContent.trim();
  if (text.length > 2 && text.length < 100) {
    console.log(`  ${i}: "${text.substring(0, 50)}..."`);
  }
});

// Check page URL
console.log('Current URL:', window.location.href);
console.log('Hostname:', window.location.hostname);
```

---

## 📞 Need More Help?

### Check These Files

1. **Content Script**: [applysafe-extension/content/content.js](applysafe-extension/content/content.js)
   - Look for `SITE_SELECTORS` object
   - Contains CSS selectors for each job site

2. **Popup Logic**: [applysafe-extension/popup/popup.js](applysafe-extension/popup/popup.js)
   - Look for `refreshAnalysis()` function
   - This is what runs when you click "Analyze"

3. **Manifest**: [applysafe-extension/manifest.json](applysafe-extension/manifest.json)
   - Check `host_permissions`
   - Should include all job sites

### Enable Verbose Logging

Edit [applysafe-extension/content/content.js](applysafe-extension/content/content.js), add at top:

```javascript
const DEBUG = true;  // Set to true

// Then use:
if (DEBUG) console.log('Your debug message');
```

This will show more details in DevTools console.

---

## 🎯 Common Issues & Quick Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "No job detected" | URL not recognized | Check URL pattern in `isJobPostingPage()` |
| Empty job fields | Selectors outdated | Use Job Extraction Debugger to find new selectors |
| Content script not loading | Manifest issue | Check `host_permissions` in manifest.json |
| Extension not showing | Extension disabled | Enable at `chrome://extensions/` |
| "Analyze" button does nothing | Background script issue | Reload extension and refresh page |

---

## Next Steps

1. **Use the Job Extraction Debugger** to diagnose the problem
2. **Check DevTools Console** for error messages
3. **Update selectors** if extraction is failing
4. **Reload extension** after making changes
5. **Test with multiple job sites** to isolate the issue

Good luck! 🚀
