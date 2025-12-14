/**
 * ApplySafe - Background Service Worker
 * Handles AI analysis, API calls, and extension coordination
 */

// Import modules
importScripts('database.js');
importScripts('subscription.js');

// Configuration
const CONFIG = {
  API_ENDPOINT: 'https://api.anthropic.com/v1/messages',
  MODEL: 'claude-3-haiku-20240307', // Fast and cost-effective for this use case
  MAX_TOKENS: 1024,
  CACHE_DURATION: 3600000, // 1 hour in ms
  RATE_LIMIT_DELAY: 500, // 500ms between API calls (only for auto-analysis)
  API_TIMEOUT: 5000 // 5 second timeout for faster response
};

// State
let lastApiCall = 0;
let apiKey = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Initialize subscription (start free trial)
    await initializeSubscription();
    
    // Set default settings
    await chrome.storage.local.set({
      settings: {
        autoAnalyze: true,
        showBadges: true,
        notifyHighRisk: true,
        apiKey: ''
      },
      stats: {
        scamsBlocked: 0,
        jobsScanned: 0,
        reportsSubmitted: 0
      },
      whitelist: [],
      recentScans: [],
      analysisCache: {},
      reports: []
    });
    
    // Open options page for API key setup
    chrome.runtime.openOptionsPage();
  }
});

// Listen for successful payment completion
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check if user landed on success page after payment
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('localhost:3000/success')) {
    console.log('Payment success page detected!');
    
    // Extract session_id from URL
    const urlParams = new URLSearchParams(new URL(tab.url).search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      console.log('Session ID found:', sessionId);
      
      // Wait a moment for Stripe to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Retrieve session details from backend
      try {
        const response = await fetch(`http://localhost:3000/api/get-session?session_id=${sessionId}`);
        const data = await response.json();
        
        if (data.customerId) {
          console.log('Activating subscription with customer ID:', data.customerId);
          await activateSubscription(data.customerId, sessionId);
        }
      } catch (error) {
        console.error('Error retrieving session:', error);
      }
    }
  }
});

// Create context menu (do this on startup, not just on install)
try {
  chrome.contextMenus.create({
    id: 'analyzeJob',
    title: 'Analyze this job with ApplySafe',
    contexts: ['page', 'link']
  });
} catch (e) {
  // Menu might already exist
  console.log('Context menu setup:', e.message);
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(response => {
      sendResponse(response);
    })
    .catch(error => {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });
  return true; // Keep channel open for async response
});

// Handle incoming messages
async function handleMessage(request, sender) {
  try {
    switch (request.action) {
      case 'analyzeJob':
        return await analyzeJob(request.jobData, request.url, request.autoAnalysis);
        
      case 'reportScam':
        return await reportScam(request.data);
        
      case 'jobDetected':
        // Log job detection for analytics
        console.log('Job detected:', request.jobData?.title);
        return { success: true };
        
      case 'getApiKey':
        return { apiKey: await getApiKey() };
        
      case 'setApiKey':
        await setApiKey(request.apiKey);
        return { success: true };
        
      case 'openPopup':
        // Can't programmatically open popup, but can open options
        chrome.runtime.openOptionsPage();
        return { success: true };
        
      case 'getJobHistory':
        return { jobs: await getAllJobs(request.limit || 100) };
        
      case 'searchJobs':
        return { jobs: await searchJobs(request.query) };
        
      case 'getStats':
        return { stats: await getStats() };
        
      case 'addToWhitelist':
        await addToWhitelist(request.company, request.reason);
        return { success: true };
        
      case 'checkWhitelist':
        return { isWhitelisted: await isWhitelisted(request.company) };
        
      case 'getJobsByCompany':
        return { jobs: await getJobsByCompany(request.company) };
        
      case 'getSubscription':
        return { subscription: await getSubscriptionStatus() };
        
      case 'getTrialInfo':
        return { trialInfo: await getTrialInfo() };
        
      case 'startCheckout':
        return await createCheckoutSession();
        
      case 'validateLicense':
        return await validateLicenseKey(request.licenseKey);
        
      case 'cancelSubscription':
        return await cancelSubscription();
        
      case 'syncSubscription':
        await syncSubscriptionStatus();
        return { success: true };
        
      case 'activateSubscription':
        return await activateSubscription(request.customerId, request.sessionId);
        
      default:
        return { error: 'Unknown action' };
    }
  } catch (error) {
    console.error('Error in handleMessage:', error);
    return { success: false, error: error.message };
  }
}

// Analyze job posting with AI
async function analyzeJob(jobData, url, autoAnalysis = false) {
  try {
    // Check subscription status first
    const canAnalyze = await canUseFeature('scan');
    
    if (!canAnalyze) {
      const trialInfo = await getTrialInfo();
      
      if (trialInfo.isExpired) {
        showUpgradePrompt('trial_expired');
        return {
          success: false,
          error: 'trial_expired',
          message: 'Your 7-day trial has ended. Upgrade to Pro for unlimited scans!',
          trialInfo
        };
      } else if (!trialInfo.isPaid) {
        // Only show limit error for non-paid users
        showUpgradePrompt('limit_reached');
        return {
          success: false,
          error: 'limit_reached',
          message: `Daily scan limit reached (${trialInfo.totalScansToday}/10). Upgrade to Pro for unlimited scans!`,
          trialInfo
        };
      }
      // If paid user and canAnalyze is false, something is wrong - proceed anyway
      console.log('Warning: Paid user but canAnalyze returned false, proceeding...');
    }
    
    // Get API key first to check if we should use cache
    const key = await getApiKey();
    console.log('ApplySafe: API key present:', !!key);
    console.log('ApplySafe: API key length:', key ? key.length : 0);
    
    if (!key) {
      // Return a heuristic-based analysis if no API key (instant)
      console.log('ApplySafe: Using heuristic analysis (no API key)');
      return {
        success: true,
        result: performHeuristicAnalysis(jobData)
      };
    }
    
    console.log('ApplySafe: API key found, will use AI analysis');
    
    // Check cache after confirming we have API key
    const cached = await getCachedAnalysis(url);
    if (cached && (Date.now() - cached.timestamp < CONFIG.CACHE_DURATION)) {
      console.log('ApplySafe: Using cached analysis');
      return { success: true, result: cached };
    }
    
    // Rate limiting (only for auto-analysis, skip for user-initiated)
    if (autoAnalysis) {
      const now = Date.now();
      if (now - lastApiCall < CONFIG.RATE_LIMIT_DELAY) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_DELAY));
      }
      lastApiCall = Date.now();
    }
    
    console.log('ApplySafe: Starting AI analysis...');
    
    // Perform company verification (includes H1B check)
    const companyVerification = await verifyCompany(
      jobData.company,
      jobData.companyWebsite,
      jobData.title
    );
    
    // Build the analysis prompt
    const prompt = buildAnalysisPrompt(jobData);
    
    // Log what we're sending to AI
    console.log('ApplySafe: Sending to AI:', {
      title: jobData.title,
      company: jobData.company,
      descriptionLength: jobData.description?.length || 0,
      salary: jobData.salary,
      location: jobData.location,
      emails: jobData.contactEmail,
      domain: jobData.companyDomain,
      companyVerification: companyVerification
    });
    
    // Call Claude API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
    
    let response;
    let data;
    let analysisText;
    
    console.log('ApplySafe: Calling Claude API...');
    const apiStartTime = Date.now();
    
    try {
      response = await fetch(CONFIG.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: CONFIG.MODEL,
          max_tokens: CONFIG.MAX_TOKENS,
          messages: [{
            role: 'user',
            content: prompt
          }]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const apiDuration = Date.now() - apiStartTime;
      console.log(`ApplySafe: API response received in ${apiDuration}ms`);
    
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', errorData);
        
        // Fallback to heuristic analysis
        return {
          success: true,
          result: performHeuristicAnalysis(jobData)
        };
      }
      
      data = await response.json();
      analysisText = data.content[0].text;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.log('ApplySafe: API timeout, using heuristic analysis');
      } else {
        console.error('ApplySafe: API fetch error:', fetchError);
      }
      // Fallback to heuristic analysis
      return {
        success: true,
        result: performHeuristicAnalysis(jobData)
      };
    }
    
    console.log('ApplySafe: AI response received, parsing...');
    
    // Parse AI response
    const analysis = parseAIResponse(analysisText, jobData);
    
    // Add verification info to analysis for display
    if (companyVerification) {
      analysis.companyVerification = companyVerification;
    }
    
    console.log('ApplySafe: Final analysis:', analysis);
    
    // Cache the result for future use
    await saveCachedAnalysis(url, analysis);
    
    // Save to database
    try {
      await saveJob(jobData, analysis);
      console.log('ApplySafe: Job saved to database');
    } catch (dbError) {
      console.error('ApplySafe: Database save failed:', dbError);
    }
    
    // Show notification for high-risk jobs
    if (analysis.riskScore > 60 && !autoAnalysis) {
      showNotification(analysis, jobData);
    }
    
    // Send warning to content script if high risk
    if (analysis.riskScore > 30) {
      try {
        const tabs = await chrome.tabs.query({ url: url });
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'showWarning',
            analysis: analysis
          }).catch(() => {});
        }
      } catch (e) {
        console.log('Could not send warning to content script');
      }
    }
    
    return { success: true, result: analysis };
    
  } catch (error) {
    console.error('Analysis error:', error);
    
    // Fallback to heuristic analysis
    return {
      success: true,
      result: performHeuristicAnalysis(jobData)
    };
  }
}

// Build analysis prompt for Claude
function buildAnalysisPrompt(jobData) {
  const verification = jobData.companyVerification;
  let verificationText = '';
  
  if (verification) {
    const h1bText = verification.h1bSponsorship 
      ? `\n- H1B Sponsorship: ${verification.h1bSponsorship.sponsors ? 'YES ✓' : 'Not Found'} ${verification.h1bSponsorship.note ? '(' + verification.h1bSponsorship.note + ')' : ''}`
      : '';
      
    verificationText = `
Company Verification:
- Has Company Website: ${verification.hasWebsite ? 'Yes' : 'No'}
- Website Accessible & Verified: ${verification.websiteAccessible ? 'Yes' : 'No'}
- Has Career Page: ${verification.hasCareerPage ? 'Yes' : 'No'}
- Job Found on Career Site: ${verification.jobFoundOnCareerSite ? 'YES ✓✓✓' : 'No'}
- Verified URL: ${verification.verifiedUrl || 'Not found'}
- Confidence Level: ${verification.confidence}${h1bText}
${verification.websiteAccessible ? '- VERIFIED: Company website exists and is accessible (STRONG positive indicator)' : ''}
${verification.hasCareerPage ? '- VERIFIED: Company has an active career/jobs page (VERY STRONG positive indicator)' : ''}
${verification.jobFoundOnCareerSite ? '- ✓✓✓ VERIFIED: This exact job posting was found on the company\'s official career site (MAXIMUM confidence - reduce risk by 25 points)' : ''}`;
  }
  
  return `You are an expert job scam detector. Analyze this job posting and provide a balanced risk assessment.

JOB POSTING DATA:
Title: ${jobData.title || 'Not provided'}
Company: ${jobData.company || 'Not provided'}
Location: ${jobData.location || 'Not provided'}
Salary: ${jobData.salary || 'Not provided'}
Description: ${(jobData.description || '').substring(0, 3000)}

Contact Emails Found: ${(jobData.contactEmail || []).join(', ') || 'None'}
Company Domain: ${jobData.companyDomain || 'Unknown'}
${verificationText}

CRITICAL SCAM INDICATORS (High Risk - Score 60+):
1. Requests for upfront payment, fees, or "investment"
2. Requests for bank account, SSN, or credit card information
3. Promises of unrealistic pay (e.g., $500/day for simple tasks)
4. Severe grammar/spelling errors throughout
5. Strong pressure tactics (urgent, act now, limited time)
6. MLM/pyramid scheme language (recruit others, downline, be your own boss)
7. Wire transfer or cryptocurrency payment mentions
8. No verifiable company information at all

MODERATE CONCERNS (Medium Risk - Score 30-60):
9. Somewhat vague job responsibilities
10. Personal email domains for a large established company
11. Work-from-home with very high hourly rates
12. Missing salary or location (common for legitimate postings too)

IMPORTANT CONSIDERATIONS:
- Missing salary/location is NORMAL for many legitimate job postings
- Recruiters and staffing agencies often use company emails, not the hiring company's domain
- Job boards aggregate postings, so contact info may not be on the posting itself
- Focus on ACTUAL red flags, not just missing optional information
- If company name is clearly stated and description is professional, baseline risk should be LOW (15-25)
- If company verification shows a website/career page link, this is a STRONG positive indicator (reduce risk by 10-20 points)
- If job posting was found on company's official career site, this is MAXIMUM confidence (reduce risk by 25 points, should score 5-15)
- Having a verified company website with career page should result in LOW risk scores (10-20) unless there are severe red flags
- H1B sponsorship history is a positive indicator showing the company is established and legitimate

RESPOND IN THIS EXACT JSON FORMAT:
{
  "riskScore": <number 0-100, where 0 is completely safe and 100 is definitely a scam>,
  "jobTitle": "<extracted job title>",
  "company": "<extracted company name>",
  "redFlags": ["<specific concern 1>", "<specific concern 2>", ...],
  "positiveIndicators": ["<positive sign 1>", "<positive sign 2>", ...],
  "explanation": "<2-3 sentence summary of your assessment>"
}

Be balanced and evidence-based. Only flag serious concerns. Most legitimate postings should score 10-30.`;
}

// Parse AI response into structured data
function parseAIResponse(responseText, jobData) {
  try {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        riskScore: Math.min(100, Math.max(0, parsed.riskScore || 50)),
        jobTitle: parsed.jobTitle || jobData.title || 'Unknown Position',
        company: parsed.company || jobData.company || 'Unknown Company',
        redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
        positiveIndicators: Array.isArray(parsed.positiveIndicators) ? parsed.positiveIndicators : [],
        explanation: parsed.explanation || 'Analysis complete.'
      };
    }
  } catch (error) {
    console.error('Error parsing AI response:', error);
  }
  
  // Fallback
  return performHeuristicAnalysis(jobData);
}

// Perform heuristic-based analysis (fallback when no API key)
function performHeuristicAnalysis(jobData) {
  const redFlags = [];
  const positiveIndicators = [];
  let riskScore = 20; // Base score
  
  const description = (jobData.description || '').toLowerCase();
  const title = (jobData.title || '').toLowerCase();
  const company = (jobData.company || '').toLowerCase();
  
  // Check for red flags
  
  // Payment requirements
  if (/upfront|payment|invest|fee|deposit|wire transfer|western union/i.test(description)) {
    redFlags.push('Mentions of upfront payments or fees');
    riskScore += 30;
  }
  
  // Unrealistic pay
  if (/\$\d{4,}.*(?:per|\/)\s*(?:week|day)|make.*\$\d{4,}.*(?:weekly|daily)/i.test(description)) {
    redFlags.push('Potentially unrealistic compensation claims');
    riskScore += 20;
  }
  
  // Urgency tactics
  if (/urgent|immediately|act now|limited.*positions?|don't miss|hurry/i.test(description)) {
    redFlags.push('Pressure tactics or urgency language detected');
    riskScore += 15;
  }
  
  // Personal email domains
  const emails = jobData.contactEmail || [];
  const personalDomains = emails.filter(e => /gmail|yahoo|hotmail|outlook|aol/i.test(e));
  if (personalDomains.length > 0) {
    redFlags.push('Contact uses personal email domain instead of company email');
    riskScore += 20;
  }
  
  // Work from home with high pay
  if (/work.*from.*home|remote|wfh/i.test(description) && 
      /\$\d{3,}.*(?:per|\/)\s*(?:hour|hr)/i.test(description)) {
    redFlags.push('Remote work with unusually high hourly rates');
    riskScore += 15;
  }
  
  // Personal info requests
  if (/bank.*account|ssn|social security|credit card|routing number/i.test(description)) {
    redFlags.push('Requests for sensitive personal or financial information');
    riskScore += 35;
  }
  
  // Vague description
  if (description.length < 200) {
    redFlags.push('Very short or vague job description');
    riskScore += 10;
  }
  
  // MLM/Pyramid indicators
  if (/mlm|network marketing|recruitment|downline|team building.*income|be your own boss/i.test(description)) {
    redFlags.push('Possible MLM or pyramid scheme indicators');
    riskScore += 25;
  }
  
  // Grammar issues (basic check)
  const grammarIssues = description.match(/\s{2,}|[A-Z]{3,}\s|!!!|\?\?/g);
  if (grammarIssues && grammarIssues.length > 3) {
    redFlags.push('Multiple grammar or formatting issues');
    riskScore += 10;
  }
  
  // Check for positive indicators
  
  // Clear company info
  if (company && company.length > 3 && !/unknown|confidential/i.test(company)) {
    positiveIndicators.push('Company name is clearly stated');
    riskScore -= 5;
  }
  
  // Company domain
  if (jobData.companyDomain && !/(gmail|yahoo|hotmail)/i.test(jobData.companyDomain)) {
    positiveIndicators.push('Company appears to have a dedicated website');
    riskScore -= 10;
  }
  
  // Detailed requirements
  if (/requirements?:|qualifications?:|experience:/i.test(description)) {
    positiveIndicators.push('Lists specific job requirements');
    riskScore -= 5;
  }
  
  // Benefits mentioned
  if (/benefits?:|401k|health insurance|pto|paid time off|dental|vision/i.test(description)) {
    positiveIndicators.push('Mentions standard employment benefits');
    riskScore -= 10;
  }
  
  // Professional posting site
  if (/linkedin|indeed|glassdoor/i.test(jobData.url || '')) {
    positiveIndicators.push('Posted on a major job platform');
    riskScore -= 5;
  }
  
  // Normalize score
  riskScore = Math.min(100, Math.max(0, riskScore));
  
  // Generate explanation
  let explanation = '';
  if (riskScore <= 30) {
    explanation = 'This job posting appears legitimate based on our analysis. However, always verify the company independently before sharing personal information.';
  } else if (riskScore <= 60) {
    explanation = 'We detected some concerning elements in this posting. Proceed with caution and research the company thoroughly before applying.';
  } else {
    explanation = 'This posting shows multiple red flags commonly associated with job scams. We strongly recommend avoiding this opportunity and reporting it.';
  }
  
  return {
    riskScore,
    jobTitle: jobData.title || 'Unknown Position',
    company: jobData.company || 'Unknown Company',
    redFlags,
    positiveIndicators,
    explanation
  };
}

// Report a scam
async function reportScam(data) {
  try {
    const result = await chrome.storage.local.get(['reports', 'stats']);
    const reports = result.reports || [];
    const stats = result.stats || { scamsBlocked: 0, jobsScanned: 0, reportsSubmitted: 0 };
    
    // Add report
    reports.push({
      ...data,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2)
    });
    
    // Update stats
    stats.reportsSubmitted = (stats.reportsSubmitted || 0) + 1;
    
    await chrome.storage.local.set({ reports, stats });
    
    // In a production app, you would send this to a server
    console.log('Scam reported:', data);
    
    return { success: true };
  } catch (error) {
    console.error('Error reporting scam:', error);
    return { success: false, error: error.message };
  }
}

// Show notification
function showNotification(analysis, jobData) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '⚠️ High Risk Job Detected',
    message: `${analysis.jobTitle} at ${analysis.company} has a risk score of ${analysis.riskScore}/100. Click to view details.`,
    priority: 2
  });
}

// API key management
async function getApiKey() {
  if (apiKey) return apiKey;
  
  const result = await chrome.storage.local.get(['settings']);
  apiKey = result.settings?.apiKey || '';
  return apiKey;
}

async function setApiKey(key) {
  apiKey = key;
  const result = await chrome.storage.local.get(['settings']);
  const settings = result.settings || {};
  settings.apiKey = key;
  await chrome.storage.local.set({ settings });
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyzeJob') {
    // Send message to content script to analyze
    chrome.tabs.sendMessage(tab.id, { action: 'forceAnalyze' }).catch(() => {});
  }
});

// Alarm for periodic cache cleanup
chrome.alarms.create('cacheCleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cacheCleanup') {
    await cleanupCache();
  }
});

// Check H1B sponsorship using h1bdata.info web scraping
async function checkH1BSponsorship(companyName) {
  try {
    if (!companyName || companyName === 'Unknown' || companyName === 'Unknown Company') {
      console.log('H1B check skipped: No valid company name');
      return null;
    }
    
    // Clean company name for search
    const cleanName = companyName
      .replace(/,?\s*(Inc\.|LLC|Ltd\.|Corp\.|Corporation|Company|Co\.)$/i, '')
      .trim();
    
    console.log(`Checking H1B sponsorship for: "${cleanName}"`);
    
    // Use h1bdata.info HTML page (they don't have a proper REST API)
    const response = await fetch(
      `https://h1bdata.info/index.php?em=${encodeURIComponent(cleanName)}&job=&city=&year=All+Years`,
      {
        method: 'GET',
        headers: {
          'Accept': 'text/html'
        }
      }
    );
    
    if (!response.ok) {
      console.log('H1B API returned status:', response.status);
      return null;
    }
    
    const html = await response.text();
    
    // Parse the HTML to find record count
    const recordMatch = html.match(/(\d+)\s+records?\s+(?:was|were)\s+found/i);
    
    if (recordMatch && parseInt(recordMatch[1]) > 0) {
      const count = parseInt(recordMatch[1]);
      console.log(`✓ Found H1B sponsorship: ${count} records`);
      return {
        sponsors: true,
        note: `Has sponsored ${count} H1B visa${count > 1 ? 's' : ''} (verified)`,
        totalApplications: count,
        employer: companyName
      };
    }
    
    console.log(`No H1B sponsorship records found for "${cleanName}"`);
    return {
      sponsors: false,
      note: 'No H1B sponsorship records found'
    };
  } catch (error) {
    console.log('H1B check error:', error.message);
    // Return null to indicate check was not possible, not that they don't sponsor
    return null;
  }
}

// Verify company legitimacy
async function verifyCompany(companyName, companyWebsite, jobTitle) {
  try {
    console.log(`verifyCompany called with: company="${companyName}", website="${companyWebsite}"`);
    
    // Create a simple verification object based on available data only
    const verification = {
      hasWebsite: false,
      hasCareerPage: false,
      websiteAccessible: false,
      verifiedUrl: null,
      jobFoundOnCareerSite: false,
      h1bSponsorship: null,
      confidence: 'unknown'
    };
    
    // If we have a company website link from the job posting
    if (companyWebsite) {
      verification.hasWebsite = true;
      verification.websiteUrl = companyWebsite;
      
      // Check if it's a career/jobs page
      if (/career|job|hiring|work-?with-?us|join-?us/i.test(companyWebsite)) {
        verification.hasCareerPage = true;
        verification.confidence = 'high';
        verification.verifiedUrl = companyWebsite;
      } else {
        verification.confidence = 'medium';
      }
      
      // Check for legitimate company domains (not free email providers)
      if (!/gmail|yahoo|hotmail|outlook|aol|protonmail|mail\.com/i.test(companyWebsite)) {
        verification.websiteAccessible = true; // Assume accessible if it's a real domain
      }
    }
    
    // Check H1B sponsorship (with caching)
    if (companyName) {
      console.log(`Starting H1B check for: ${companyName}`);
      
      // Try to get from cache first
      try {
        const cached = await getCachedH1B(companyName);
        if (cached) {
          console.log('H1B data loaded from cache:', cached);
          verification.h1bSponsorship = {
            sponsors: cached.h1bSponsors,
            totalApplications: cached.totalApplications,
            note: cached.note
          };
        } else {
          // Fetch fresh data and cache it
          verification.h1bSponsorship = await checkH1BSponsorship(companyName);
          console.log('H1B check result:', verification.h1bSponsorship);
          
          if (verification.h1bSponsorship) {
            await cacheCompanyH1B(companyName, verification.h1bSponsorship);
            console.log('H1B data cached for:', companyName);
          }
        }
      } catch (cacheError) {
        console.error('H1B cache error:', cacheError);
        // Fallback to direct check
        verification.h1bSponsorship = await checkH1BSponsorship(companyName);
      }
    } else {
      console.log('Skipping H1B check - no company name');
    }
    
    return verification;
  } catch (error) {
    console.log('Company verification error:', error);
    return null;
  }
}

// Get cached analysis
async function getCachedAnalysis(url) {
  try {
    const result = await chrome.storage.local.get(['analysisCache']);
    const cache = result.analysisCache || {};
    return cache[url];
  } catch (error) {
    return null;
  }
}

// Save analysis to cache
async function saveCachedAnalysis(url, analysis) {
  try {
    const result = await chrome.storage.local.get(['analysisCache']);
    const cache = result.analysisCache || {};
    cache[url] = { ...analysis, timestamp: Date.now() };
    await chrome.storage.local.set({ analysisCache: cache });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}

async function cleanupCache() {
  try {
    const result = await chrome.storage.local.get(['analysisCache']);
    const cache = result.analysisCache || {};
    const now = Date.now();
    
    // Remove entries older than cache duration
    for (const [url, data] of Object.entries(cache)) {
      if (now - data.timestamp > CONFIG.CACHE_DURATION) {
        delete cache[url];
      }
    }
    
    await chrome.storage.local.set({ analysisCache: cache });
  } catch (error) {
    console.error('Cache cleanup error:', error);
  }
}

console.log('ApplySafe background service worker loaded');
