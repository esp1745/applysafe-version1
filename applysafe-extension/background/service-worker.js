/**
 * ApplySafe - Background Service Worker
 * Handles AI analysis, API calls, and extension coordination
 */

console.log('🔵 SERVICE WORKER FILE LOADING...');

// Import modules
try {
  importScripts('database.js');
  console.log('✅ database.js loaded');
} catch (e) {
  console.error('❌ Failed to load database.js:', e);
}

try {
  importScripts('subscription.js');
  console.log('✅ subscription.js loaded');
} catch (e) {
  console.error('❌ Failed to load subscription.js:', e);
}

try {
  importScripts('auth.js');
  console.log('✅ auth.js loaded');
} catch (e) {
  console.error('❌ Failed to load auth.js:', e);
}

try {
  importScripts('h1b.js');
  console.log('✅ h1b.js loaded');
} catch (e) {
  console.error('❌ Failed to load h1b.js:', e);
}

// Configuration
const CONFIG = {
  BACKEND_URL: 'https://applysafe-version1.vercel.app',
  API_ENDPOINT: 'https://applysafe-version1.vercel.app/api/analyze-job',
  MODEL: 'claude-haiku-4-5-20251001', // Fast and cost-effective for this use case
  MAX_TOKENS: 1024,
  CACHE_DURATION: 3600000, // 1 hour in ms
  RATE_LIMIT_DELAY: 500, // 500ms between API calls (only for auto-analysis)
  API_TIMEOUT: 15000 // 15 second timeout (backend proxy needs more time)
};

// State
let lastApiCall = 0;

function isSupportedJobUrl(url) {
  if (!url || !/^https?:/i.test(url)) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();
    const path = parsedUrl.pathname.toLowerCase();

    if (host.includes('linkedin.com')) return path.includes('/jobs/');
    if (host.includes('indeed.com')) return true;
    if (host.includes('glassdoor.com')) return path.includes('/job-listing/') || path.includes('/job/');
    if (host.includes('ziprecruiter.com')) return path.includes('/jobs/');
    if (host.includes('monster.com')) return path.includes('/job-openings/');
    if (host.includes('simplyhired.com')) return path.includes('/job/');
    if (host.includes('dice.com')) return path.includes('/job-detail/');
    if (host.includes('careerbuilder.com')) return path.includes('/job-');
    if (host.includes('angel.co') || host.includes('wellfound.com')) return path.includes('/jobs/');
    if (host.includes('upwork.com')) return path.includes('/jobs/');
    if (host.includes('flexjobs.com')) return path.includes('/job/');
    if (host.includes('remote.co')) return path.includes('/job/');
    if (host.includes('weworkremotely.com')) return path.includes('/remote-jobs/');
    if (host.includes('remoteok.com')) return true;
    if (host.includes('careers.google.com')) return path.includes('/jobs/');
    if (host.includes('google.com')) return path.includes('/about/careers/applications/jobs/');
    if (host === 'boards.greenhouse.io' || host.endsWith('greenhouse.io')) return true;
    if (host === 'jobs.lever.co' || host.endsWith('lever.co')) return true;
    if (host.includes('myworkdayjobs.com')) return true;
    if (host.endsWith('bamboohr.com')) return path.includes('/careers/');
    if (host.endsWith('icims.com')) return path.includes('/jobs/');
    if (host.endsWith('smartrecruiters.com')) return path.includes('/jobs/');
    if (
      host.endsWith('jobvite.com') ||
      host.endsWith('taleo.net') ||
      host.endsWith('breezy.hr') ||
      host.endsWith('ashbyhq.com') ||
      host.endsWith('recruitee.com')
    ) {
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

async function ensureContentScriptReady(tabId, url) {
  if (!tabId || !isSupportedJobUrl(url)) {
    return false;
  }

  try {
    const ping = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    if (ping?.alive) {
      return true;
    }
  } catch (error) {
    console.log('ApplySafe: Content script ping failed, attempting reinjection');
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/content.css']
    }).catch(() => {});

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content.js']
    });

    console.log('ApplySafe: Content script injected into tab', tabId);
    return true;
  } catch (error) {
    console.log('ApplySafe: Could not inject content script into tab', tabId, error?.message || error);
    return false;
  }
}

async function refreshOpenJobTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.map(tab => ensureContentScriptReady(tab.id, tab.url)));
  } catch (error) {
    console.log('ApplySafe: Could not refresh open job tabs', error?.message || error);
  }
}

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
    
    // Don't open landing page - just keep popup as the main interface
  } else if (details.reason === 'update') {
    // Clear old cache on extension update to refresh H1B data
    console.log('ApplySafe: Extension updated, clearing old caches');
    await chrome.storage.local.remove(['analysisCache', 'h1bCache']);
  }

  await refreshOpenJobTabs();
});

chrome.runtime.onStartup.addListener(() => {
  refreshOpenJobTabs().catch(error => {
    console.log('ApplySafe: Startup refresh skipped', error?.message || error);
  });
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await ensureContentScriptReady(tabId, tab?.url);
  } catch (error) {
    console.log('ApplySafe: Could not inspect active tab', error?.message || error);
  }
});

// Listen for successful payment completion
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check if user landed on success page after payment (local or production)
  if (changeInfo.status === 'complete' && tab.url && (tab.url.includes('/success') || tab.url.includes('session_id'))) {
    console.log('Payment success page detected!', tab.url);
    
    // Extract session_id from URL
    try {
      const urlParams = new URLSearchParams(new URL(tab.url).search);
      const sessionId = urlParams.get('session_id');
      
      if (sessionId) {
        console.log('Session ID found:', sessionId);
        
        // Sync subscription status immediately
        await syncSubscriptionStatus();
        console.log('🔄 Subscription status synced after payment success.');
        
        // Notify any open popups/dashboards to refresh
        chrome.runtime.sendMessage({ action: 'subscriptionSynced' }).catch(() => {});
      }
    } catch (e) {
      console.error('Error processing payment success:', e);
    }
  }

  if (tab.url && (changeInfo.status === 'complete' || changeInfo.url)) {
    await ensureContentScriptReady(tabId, tab.url);
  }
});

// Create context menu (do this on startup, not just on install)
try {
  // Remove existing menu first to avoid duplicate error
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'analyzeJob',
      title: 'Analyze this job with ApplySafe',
      contexts: ['page', 'link']
    });
  });
} catch (e) {
  console.log('Context menu setup:', e.message);
}

console.log('🟢 ApplySafe Service Worker READY - Message listener active');

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action, 'from:', sender?.tab?.id || 'popup');
  handleMessage(request, sender)
    .then(response => {
      console.log('📤 Response sent for:', request.action);
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
        
      case 'openPopup':
        // Can't programmatically open popup, but can open options
        chrome.runtime.openOptionsPage();
        return { success: true };
      
      case 'openDashboard':
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
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
        
      case 'getAuthStatus':
        return { authStatus: await auth.getAuthStatus() };
        
      case 'signInWithGoogle':
        return await auth.signInWithGoogle();
        
      case 'signInWithEmail':
        return await auth.signInWithEmail(request.email, request.name);
        
      case 'signOut':
      case 'logout':
        return await auth.signOut();
        
      case 'refreshToken':
        // Manually refresh the authentication token
        console.log('🔄 Manual token refresh requested');
        return await auth.refreshToken();
        
      case 'clearCache':
        await clearAllCache();
        return { success: true };
      
      case 'getWidgetData':
        // Get user data and stats for floating widget
        try {
          const widgetAuthStatus = await auth.getAuthStatus();
          const widgetStorage = await chrome.storage.local.get(['stats', 'recentScans', 'user', 'subscription', 'guestScans']);
          // Try auth status first, then fallback to storage
          const user = widgetAuthStatus.isAuthenticated ? widgetAuthStatus.user : widgetStorage.user || null;
          const isSignedIn = !!user?.email;
          
          // Get subscription - default to 'trial' for new users
          let subscription = widgetStorage.subscription || { status: 'trial' };
          
          // Only consider 'active' if explicitly set - 'trial', 'expired', etc. are NOT active
          const isProUser = subscription.status === 'active';
          
          // For guests, don't show accumulated stats - only show their session data
          const guestScans = widgetStorage.guestScans || { count: 0 };
          
          console.log('getWidgetData: auth status:', widgetAuthStatus.isAuthenticated, 'user:', user?.email, 'subscription:', subscription.status, 'isPro:', isProUser);
          return {
            success: true,
            user: user,
            subscription: {
              status: isProUser ? 'active' : (subscription.status || 'trial'),
              planName: isProUser ? 'Pro' : 'Free Trial',
              scansToday: subscription.scansToday || 0,
              trialEnds: subscription.trialEnds
            },
            stats: isSignedIn ? {
              threatsBlocked: widgetStorage.stats?.scamsBlocked || 0,
              jobsScanned: widgetStorage.stats?.jobsScanned || 0,
              safetyRate: widgetStorage.stats?.jobsScanned > 0 
                ? Math.round(((widgetStorage.stats.jobsScanned - (widgetStorage.stats?.scamsBlocked || 0)) / widgetStorage.stats.jobsScanned) * 100) + '%'
                : '100%'
            } : {
              // Guest stats - only show current session
              threatsBlocked: 0,
              jobsScanned: guestScans.count || 0,
              safetyRate: '100%'
            },
            recentScans: isSignedIn ? (widgetStorage.recentScans || []).slice(0, 5).map(scan => ({
              title: scan.title || scan.jobTitle,
              company: scan.company,
              riskScore: scan.riskScore,
              time: getTimeAgo(scan.timestamp)
            })) : [] // Don't show recent scans for guests
          };
        } catch (e) {
          console.log('getWidgetData error:', e);
          return { success: false, error: e.message };
        }
      
      case 'signIn':
        return await auth.signInWithGoogle();
      
      // H1B Sponsorship Actions
      case 'checkH1BSponsorship':
        console.log('H1B check requested for:', request.companyName);
        const h1bResult = await self.h1bModule.checkH1BSponsorship(request.companyName);
        console.log('H1B result:', h1bResult);
        return { success: true, h1bData: h1bResult };
        
      case 'submitH1BFeedback':
        return await self.h1bModule.submitH1BFeedback(
          request.companyName, 
          request.isAccurate, 
          request.comment
        );
        
      case 'getH1BFeedback':
        const feedback = await self.h1bModule.getH1BFeedback(request.companyName);
        return { success: true, feedback: feedback };
      
      // V3 Features - AI & Cloud Sync
      case 'generateCoverLetter':
        return await generateCoverLetter(request.jobTitle, request.company, request.jobDescription, request.userSkills);
        
      case 'analyzeResume':
        return await analyzeResumeMatch(request.resumeText, request.jobDescription);
        
      case 'getInterviewPrep':
        return await getInterviewPrep(request.jobTitle, request.company, request.industry);
        
      case 'chatWithAI':
        return await chatWithAI(request.message, request.context);
        
      case 'syncToCloud':
        return await syncToCloud(request.applications, request.reminders, request.scanHistory);
        
      case 'syncFromCloud':
        return await syncFromCloud();
        
      case 'scheduleReminder':
        return await scheduleReminder(request.reminder);
        
      case 'cancelReminder':
        return await cancelReminder(request.reminderId);
        
      case 'getReminders':
        return await getReminders();
        
      default:
        return { error: 'Unknown action' };
    }
  } catch (error) {
    console.error('Error in handleMessage:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to format time ago
function getTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Clear all cached data (analysis and H1B cache)
async function clearAllCache() {
  try {
    await chrome.storage.local.remove(['analysisCache', 'h1bCache']);
    console.log('ApplySafe: All caches cleared');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

// Analyze job posting with AI
async function analyzeJob(jobData, url, autoAnalysis = false) {
  try {
    // Check auth status and feature access
    const authStatus = await auth.getAuthStatus();
    const canAnalyze = await auth.canUseFeature('scan', url);
    
    if (!canAnalyze.allowed) {
      // User has exceeded limits
      const scansToday = canAnalyze.usage?.scansToday || 0;
      if (authStatus.isAuthenticated) {
        // Signed in user - show server-synced limits
        showUpgradePrompt('limit_reached');
        return {
          success: false,
          error: 'limit_reached',
          message: `Daily scan limit reached (${scansToday}/10). Upgrade to Pro for unlimited scans!`,
          usage: canAnalyze.usage || { scansToday: 0 }
        };
      } else {
        // Anonymous user - check local trial
        const localTrial = await auth.getLocalTrialInfo();
        if (!localTrial.isTrialActive) {
          showUpgradePrompt('trial_expired');
          return {
            success: false,
            error: 'trial_expired',
            message: 'Your 7-day trial has ended. Sign in with Google or upgrade to Pro!',
            trialInfo: localTrial
          };
        } else {
          showUpgradePrompt('limit_reached');
          return {
            success: false,
            error: 'limit_reached',
            message: `Daily scan limit reached (${localTrial.totalScansToday}/10). Sign in with Google or upgrade to Pro!`,
            trialInfo: localTrial
          };
        }
      }
    }
    
    // Always perform company verification (includes H1B check) - do this early
    console.log('ApplySafe: Starting company verification and H1B check...');
    const companyVerification = await verifyCompany(
      jobData.company,
      jobData.companyWebsite,
      jobData.title
    );
    console.log('ApplySafe: Company verification complete:', companyVerification);
    
    // Check cache first - but validate that cached data matches current job
    const cached = await getCachedAnalysis(url);
    if (cached && (Date.now() - cached.timestamp < CONFIG.CACHE_DURATION)) {
      // IMPORTANT: Verify the cached data is for the same job (not just same URL)
      // This handles SPAs where URL might be reused or cached data might be stale
      const cachedTitle = cached.jobTitle || cached.title;
      const cachedCompany = cached.company;
      const currentTitle = jobData.title;
      const currentCompany = jobData.company;
      
      const titleMatches = cachedTitle && currentTitle && 
        (cachedTitle.toLowerCase().includes(currentTitle.toLowerCase()) || 
         currentTitle.toLowerCase().includes(cachedTitle.toLowerCase()));
      const companyMatches = cachedCompany && currentCompany &&
        cachedCompany.toLowerCase() === currentCompany.toLowerCase();
      
      if (titleMatches && companyMatches) {
        console.log('ApplySafe: Using cached analysis (job matches)');
        // Add fresh H1B data to cached result if available
        if (companyVerification && companyVerification.h1bSponsorship) {
          cached.companyVerification = cached.companyVerification || {};
          cached.companyVerification.h1bSponsorship = companyVerification.h1bSponsorship;
        }
        // Update stats even for cached results (counts as a scan view)
        await updateJobStats();
        return { success: true, result: cached };
      } else {
        console.log('ApplySafe: Cache exists but job data changed, fetching fresh analysis');
        console.log('  Cached:', { title: cachedTitle, company: cachedCompany });
        console.log('  Current:', { title: currentTitle, company: currentCompany });
      }
    }
    
    // Rate limiting (only for auto-analysis, skip for user-initiated)
    if (autoAnalysis) {
      const now = Date.now();
      if (now - lastApiCall < CONFIG.RATE_LIMIT_DELAY) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_DELAY));
      }
      lastApiCall = Date.now();
    }
    
    console.log('ApplySafe: Starting AI analysis via backend proxy...');
    
    // Log what we're sending to AI
    console.log('ApplySafe: Sending to backend:', {
      title: jobData.title,
      company: jobData.company,
      descriptionLength: jobData.description?.length || 0,
      salary: jobData.salary,
      location: jobData.location,
      emails: jobData.contactEmail,
      domain: jobData.companyDomain,
      companyVerification: companyVerification
    });
    
    // Call backend API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
    
    let response;
    let data;
    
    console.log('ApplySafe: Calling backend AI proxy...');
    const apiStartTime = Date.now();
    
    try {
      response = await fetch(CONFIG.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobData: {
            title: jobData.title,
            company: jobData.company,
            description: jobData.description,
            salary: jobData.salary,
            location: jobData.location,
            contactEmail: jobData.contactEmail,
            companyDomain: jobData.companyDomain,
            companyWebsite: jobData.companyWebsite
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const apiDuration = Date.now() - apiStartTime;
      console.log(`ApplySafe: Backend response received in ${apiDuration}ms`);
    
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Backend API Error:', errorData);
        
        // Fallback to heuristic analysis
        const heuristicResult = performHeuristicAnalysis(jobData);
        if (companyVerification) {
          heuristicResult.companyVerification = companyVerification;
        }
        await updateJobStats();
        return {
          success: true,
          result: heuristicResult
        };
      }
      
      data = await response.json();
      
      if (!data.success) {
        console.error('Backend returned error:', data.error);
        // Fallback to heuristic analysis
        const heuristicResult = performHeuristicAnalysis(jobData);
        if (companyVerification) {
          heuristicResult.companyVerification = companyVerification;
        }
        await updateJobStats();
        return {
          success: true,
          result: heuristicResult
        };
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.log('ApplySafe: Backend timeout, using heuristic analysis');
      } else {
        console.error('ApplySafe: Backend fetch error:', fetchError);
      }
      // Fallback to heuristic analysis
      const heuristicResult = performHeuristicAnalysis(jobData);
      if (companyVerification) {
        heuristicResult.companyVerification = companyVerification;
      }
      await updateJobStats();
      return {
        success: true,
        result: heuristicResult
      };
    }
    
    console.log('ApplySafe: Backend response received, processing...');
    
    // Use the analysis from backend
    const analysis = data.analysis;
    
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
    
    // Update stats
    await updateJobStats();
    
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

// Update job scan stats
async function updateJobStats() {
  try {
    const result = await chrome.storage.local.get(['stats']);
    const stats = result.stats || { scamsBlocked: 0, jobsScanned: 0, reportsSubmitted: 0 };
    stats.jobsScanned = (stats.jobsScanned || 0) + 1;
    await chrome.storage.local.set({ stats });
    console.log('ApplySafe: Stats updated, jobs scanned:', stats.jobsScanned);
  } catch (error) {
    console.error('Error updating stats:', error);
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
    
    // Clean company name for search - remove common suffixes
    let cleanName = companyName
      .replace(/,?\s*(Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Company|Co\.|Limited|L\.?P\.?|PLC|GmbH|S\.?A\.?|N\.?V\.?)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`Checking H1B sponsorship for: "${cleanName}"`);
    
    // First, check against known major H-1B sponsors (instant lookup)
    const knownSponsors = getKnownH1BSponsors();
    const lowerName = cleanName.toLowerCase();
    
    for (const [company, data] of Object.entries(knownSponsors)) {
      if (lowerName.includes(company) || company.includes(lowerName)) {
        console.log(`✓ Found in known H1B sponsors list: ${company}`);
        return {
          sponsors: true,
          note: data.note,
          totalApplications: data.approx,
          employer: companyName,
          source: 'known-sponsors'
        };
      }
    }
    
    // Try h1bdata.info for companies not in the known list
    try {
      console.log('Checking h1bdata.info for:', cleanName);
      const response = await fetch(
        `https://h1bdata.info/index.php?em=${encodeURIComponent(cleanName)}&job=&city=&year=All+Years`,
        {
          method: 'GET',
          headers: {
            'Accept': 'text/html'
          }
        }
      );
      
      if (response.ok) {
        const html = await response.text();
        console.log('H1B response received, length:', html.length);
        
        // Parse the HTML to find record count - matches "X records was found" or "X records were found"
        const recordMatch = html.match(/(\d[\d,]*)\s+records?\s+(?:was|were)\s+found/i);
        
        // Also check for salary info which indicates records exist
        const salaryMatch = html.match(/Median Salary is \$([\d,]+)/i);
        
        if (recordMatch) {
          const countStr = recordMatch[1].replace(/,/g, '');
          const count = parseInt(countStr);
          
          if (count > 0) {
            console.log(`✓ Found H1B sponsorship via h1bdata.info: ${count} records`);
            return {
              sponsors: true,
              note: `Has sponsored ${count.toLocaleString()} H-1B visa${count > 1 ? 's' : ''} (verified)`,
              totalApplications: count,
              employer: companyName,
              source: 'h1bdata.info'
            };
          }
        }
        
        if (salaryMatch) {
          console.log('✓ Found H1B salary data via h1bdata.info');
          return {
            sponsors: true,
            note: 'Company has H-1B sponsorship records (verified)',
            employer: companyName,
            source: 'h1bdata.info'
          };
        }
        
        console.log('No H1B records found in h1bdata.info response');
      } else {
        console.log('h1bdata.info returned status:', response.status);
      }
    } catch (fetchError) {
      console.log('h1bdata.info fetch error:', fetchError.message);
    }
    
    console.log(`No H1B sponsorship records found for "${cleanName}"`);
    return {
      sponsors: false,
      note: 'No H-1B sponsorship records found in database'
    };
  } catch (error) {
    console.log('H1B check error:', error.message);
    return null;
  }
}

// Known major H-1B sponsors (top sponsors by volume)
function getKnownH1BSponsors() {
  return {
    'amazon': { approx: 50000, note: 'Top H-1B sponsor - ~50,000+ visas sponsored' },
    'google': { approx: 35000, note: 'Major H-1B sponsor - ~35,000+ visas sponsored' },
    'microsoft': { approx: 30000, note: 'Major H-1B sponsor - ~30,000+ visas sponsored' },
    'meta': { approx: 15000, note: 'Major H-1B sponsor - ~15,000+ visas sponsored' },
    'facebook': { approx: 15000, note: 'Major H-1B sponsor - ~15,000+ visas sponsored' },
    'apple': { approx: 12000, note: 'Major H-1B sponsor - ~12,000+ visas sponsored' },
    'intel': { approx: 10000, note: 'Major H-1B sponsor - ~10,000+ visas sponsored' },
    'ibm': { approx: 15000, note: 'Major H-1B sponsor - ~15,000+ visas sponsored' },
    'infosys': { approx: 40000, note: 'Top H-1B sponsor - ~40,000+ visas sponsored' },
    'tata consultancy': { approx: 35000, note: 'Top H-1B sponsor - ~35,000+ visas sponsored' },
    'cognizant': { approx: 30000, note: 'Major H-1B sponsor - ~30,000+ visas sponsored' },
    'accenture': { approx: 15000, note: 'Major H-1B sponsor - ~15,000+ visas sponsored' },
    'deloitte': { approx: 12000, note: 'Major H-1B sponsor - ~12,000+ visas sponsored' },
    'walmart': { approx: 5000, note: 'H-1B sponsor - ~5,000+ visas sponsored' },
    'uber': { approx: 5000, note: 'H-1B sponsor - ~5,000+ visas sponsored' },
    'salesforce': { approx: 5000, note: 'H-1B sponsor - ~5,000+ visas sponsored' },
    'oracle': { approx: 8000, note: 'Major H-1B sponsor - ~8,000+ visas sponsored' },
    'cisco': { approx: 8000, note: 'Major H-1B sponsor - ~8,000+ visas sponsored' },
    'qualcomm': { approx: 5000, note: 'H-1B sponsor - ~5,000+ visas sponsored' },
    'nvidia': { approx: 4000, note: 'H-1B sponsor - ~4,000+ visas sponsored' },
    'adobe': { approx: 3500, note: 'H-1B sponsor - ~3,500+ visas sponsored' },
    'linkedin': { approx: 3000, note: 'H-1B sponsor - ~3,000+ visas sponsored' },
    'netflix': { approx: 2000, note: 'H-1B sponsor - ~2,000+ visas sponsored' },
    'airbnb': { approx: 1500, note: 'H-1B sponsor - ~1,500+ visas sponsored' },
    'stripe': { approx: 1500, note: 'H-1B sponsor - ~1,500+ visas sponsored' },
    'twitter': { approx: 2000, note: 'H-1B sponsor - ~2,000+ visas sponsored' },
    'x corp': { approx: 2000, note: 'H-1B sponsor - ~2,000+ visas sponsored' },
    'jpmorgan': { approx: 8000, note: 'Major H-1B sponsor - ~8,000+ visas sponsored' },
    'jp morgan': { approx: 8000, note: 'Major H-1B sponsor - ~8,000+ visas sponsored' },
    'goldman sachs': { approx: 5000, note: 'H-1B sponsor - ~5,000+ visas sponsored' },
    'morgan stanley': { approx: 4000, note: 'H-1B sponsor - ~4,000+ visas sponsored' },
    'bank of america': { approx: 4000, note: 'H-1B sponsor - ~4,000+ visas sponsored' },
    'capital one': { approx: 3000, note: 'H-1B sponsor - ~3,000+ visas sponsored' },
    'disney': { approx: 2500, note: 'H-1B sponsor - ~2,500+ visas sponsored' },
    'walt disney': { approx: 2500, note: 'H-1B sponsor - ~2,500+ visas sponsored' },
    'bloomberg': { approx: 2500, note: 'H-1B sponsor - ~2,500+ visas sponsored' },
    'spotify': { approx: 1000, note: 'H-1B sponsor - ~1,000+ visas sponsored' },
    'snap': { approx: 1000, note: 'H-1B sponsor - ~1,000+ visas sponsored' },
    'snapchat': { approx: 1000, note: 'H-1B sponsor - ~1,000+ visas sponsored' },
    'lyft': { approx: 1000, note: 'H-1B sponsor - ~1,000+ visas sponsored' },
    'doordash': { approx: 800, note: 'H-1B sponsor - ~800+ visas sponsored' },
    'instacart': { approx: 500, note: 'H-1B sponsor - ~500+ visas sponsored' },
    'palantir': { approx: 1500, note: 'H-1B sponsor - ~1,500+ visas sponsored' },
    'databricks': { approx: 1000, note: 'H-1B sponsor - ~1,000+ visas sponsored' },
    'snowflake': { approx: 800, note: 'H-1B sponsor - ~800+ visas sponsored' },
    'twilio': { approx: 500, note: 'H-1B sponsor - ~500+ visas sponsored' },
    'dropbox': { approx: 800, note: 'H-1B sponsor - ~800+ visas sponsored' },
    'zoom': { approx: 600, note: 'H-1B sponsor - ~600+ visas sponsored' },
    'servicenow': { approx: 1500, note: 'H-1B sponsor - ~1,500+ visas sponsored' },
    'workday': { approx: 1200, note: 'H-1B sponsor - ~1,200+ visas sponsored' },
    'vmware': { approx: 3000, note: 'H-1B sponsor - ~3,000+ visas sponsored' },
    'hpe': { approx: 2000, note: 'H-1B sponsor - ~2,000+ visas sponsored' },
    'hewlett packard': { approx: 2000, note: 'H-1B sponsor - ~2,000+ visas sponsored' },
    'dell': { approx: 2500, note: 'H-1B sponsor - ~2,500+ visas sponsored' },
    'paypal': { approx: 2000, note: 'H-1B sponsor - ~2,000+ visas sponsored' },
    'visa inc': { approx: 1500, note: 'H-1B sponsor - ~1,500+ visas sponsored' },
    'mastercard': { approx: 1200, note: 'H-1B sponsor - ~1,200+ visas sponsored' },
    'american express': { approx: 1500, note: 'H-1B sponsor - ~1,500+ visas sponsored' },
    'intuit': { approx: 1500, note: 'H-1B sponsor - ~1,500+ visas sponsored' },
    'square': { approx: 800, note: 'H-1B sponsor - ~800+ visas sponsored' },
    'block': { approx: 800, note: 'H-1B sponsor - ~800+ visas sponsored' },
    'robinhood': { approx: 400, note: 'H-1B sponsor - ~400+ visas sponsored' },
    'coinbase': { approx: 500, note: 'H-1B sponsor - ~500+ visas sponsored' },
    'epic games': { approx: 600, note: 'H-1B sponsor - ~600+ visas sponsored' },
    'electronic arts': { approx: 800, note: 'H-1B sponsor - ~800+ visas sponsored' },
    'ea': { approx: 800, note: 'H-1B sponsor - ~800+ visas sponsored' },
    'activision': { approx: 500, note: 'H-1B sponsor - ~500+ visas sponsored' },
    'riot games': { approx: 400, note: 'H-1B sponsor - ~400+ visas sponsored' },
    'pinterest': { approx: 800, note: 'H-1B sponsor - ~800+ visas sponsored' },
    'reddit': { approx: 400, note: 'H-1B sponsor - ~400+ visas sponsored' },
    'atlassian': { approx: 1000, note: 'H-1B sponsor - ~1,000+ visas sponsored' },
    'github': { approx: 600, note: 'H-1B sponsor - ~600+ visas sponsored' },
    'gitlab': { approx: 300, note: 'H-1B sponsor - ~300+ visas sponsored' },
    'openai': { approx: 500, note: 'H-1B sponsor - ~500+ visas sponsored' },
    'anthropic': { approx: 200, note: 'H-1B sponsor - ~200+ visas sponsored' }
  };
}

// Get cached H1B data for a company
async function getCachedH1B(companyName) {
  try {
    const result = await chrome.storage.local.get(['h1bCache']);
    const cache = result.h1bCache || {};
    const normalizedName = companyName.toLowerCase().trim();
    const cached = cache[normalizedName];
    
    // Check if cache is still valid (7 days)
    if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
      return cached;
    }
    return null;
  } catch (error) {
    console.error('Error reading H1B cache:', error);
    return null;
  }
}

// Cache H1B data for a company
async function cacheCompanyH1B(companyName, h1bData) {
  try {
    const result = await chrome.storage.local.get(['h1bCache']);
    const cache = result.h1bCache || {};
    const normalizedName = companyName.toLowerCase().trim();
    
    cache[normalizedName] = {
      ...h1bData,
      h1bSponsors: h1bData.sponsors,
      timestamp: Date.now()
    };
    
    await chrome.storage.local.set({ h1bCache: cache });
    console.log('H1B data cached for:', companyName);
  } catch (error) {
    console.error('Error caching H1B data:', error);
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
    
    // Check H1B sponsorship using the new module (with caching)
    // Validate company name is actually usable (not empty, not "Unknown", not too short)
    const isValidCompany = companyName && 
                           companyName.length >= 2 && 
                           companyName.toLowerCase() !== 'unknown' && 
                           companyName.toLowerCase() !== 'unknown company' &&
                           companyName.toLowerCase() !== 'not provided';
    
    if (isValidCompany) {
      console.log(`Starting H1B check for: ${companyName}`);
      
      // Use the new H1B module for comprehensive lookup
      verification.h1bSponsorship = await self.h1bModule.checkH1BSponsorship(companyName);
      console.log('H1B check result:', verification.h1bSponsorship);
    } else {
      console.log(`Skipping H1B check - invalid company name: "${companyName}"`);
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

// ==========================================
// V3 FEATURES - AI & Cloud Sync Functions
// ==========================================

/**
 * Helper function to make authenticated API calls with automatic token refresh
 */
async function makeAuthenticatedRequest(endpoint, body, retryCount = 0) {
  let authStatus = await auth.getAuthStatus();
  if (!authStatus.isAuthenticated) {
    console.log('❌ Not authenticated - no user or token in storage');
    return { success: false, error: 'not_authenticated', message: 'Please sign in to use AI features' };
  }

  console.log(`🔐 Making authenticated request to ${endpoint}...`);
  console.log(`🔐 Token preview: ${authStatus.token?.substring(0, 20)}...`);
  
  let response;
  try {
    response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStatus.token}`
      },
      body: JSON.stringify(body)
    });
  } catch (fetchError) {
    console.error('❌ Network error:', fetchError);
    return { success: false, error: 'network_error', message: 'Network error. Please check your connection.' };
  }

  console.log(`📡 Response status: ${response.status}`);

  // If 401 and we haven't retried yet, try refreshing the token
  if (response.status === 401 && retryCount === 0) {
    console.log('🔄 Token invalid (401), attempting refresh...');
    const refreshResult = await auth.refreshToken();
    
    if (refreshResult.success) {
      console.log('✅ Token refreshed successfully, retrying request...');
      return makeAuthenticatedRequest(endpoint, body, 1);
    } else {
      console.log('❌ Token refresh failed:', refreshResult.error);
      return { 
        success: false, 
        error: 'session_expired', 
        message: 'Session expired. Please sign out and sign back in.' 
      };
    }
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    console.error('❌ Failed to parse response JSON:', e);
    return { success: false, error: 'parse_error', message: 'Server returned invalid response' };
  }
  
  if (!response.ok) {
    console.log('❌ Request failed with error:', data.error);
    return { success: false, error: data.error || 'Request failed' };
  }

  return { success: true, data };
}

/**
 * Generate AI cover letter
 */
async function generateCoverLetter(jobTitle, company, jobDescription, userSkills) {
  try {
    const result = await makeAuthenticatedRequest('/api/v3/generate-cover-letter', {
      jobTitle,
      company,
      jobDescription,
      userSkills
    });

    if (!result.success) {
      return result;
    }

    return { success: true, coverLetter: result.data.coverLetter };
  } catch (error) {
    console.error('Cover letter generation error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Analyze resume match with job description
 */
async function analyzeResumeMatch(resumeText, jobDescription) {
  try {
    const result = await makeAuthenticatedRequest('/api/v3/analyze-resume', {
      resumeText,
      jobDescription
    });

    if (!result.success) {
      return result;
    }

    return { success: true, analysis: result.data.analysis };
  } catch (error) {
    console.error('Resume analysis error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get interview preparation tips
 */
async function getInterviewPrep(jobTitle, company, industry) {
  try {
    const result = await makeAuthenticatedRequest('/api/v3/interview-prep', {
      jobTitle,
      company,
      industry
    });

    if (!result.success) {
      return result;
    }

    return { success: true, prep: result.data.prep || result.data.prepMaterials };
  } catch (error) {
    console.error('Interview prep error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Chat with AI assistant
 */
async function chatWithAI(message, context = {}) {
  try {
    console.log('🤖 Calling AI chat API...');
    
    const result = await makeAuthenticatedRequest('/api/v3/chat', {
      message,
      context
    });

    if (!result.success) {
      return result;
    }

    return { success: true, reply: result.data.reply };
  } catch (error) {
    console.error('AI chat error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync data to cloud
 */
async function syncToCloud(applications, reminders, scanHistory) {
  try {
    // Check if user is authenticated first
    const authStatus = await auth.getAuthStatus();
    if (!authStatus.isAuthenticated || !authStatus.token) {
      console.log('⚠️ syncToCloud: User not authenticated, skipping sync');
      return { success: false, error: 'not_authenticated', message: 'Please sign in to sync data' };
    }
    
    console.log('🔄 syncToCloud called with:', {
      applications: applications?.length || 0,
      reminders: reminders?.length || 0,
      scanHistory: scanHistory?.length || 0
    });
    
    const result = await makeAuthenticatedRequest('/api/v3/sync', {
      applications,
      reminders,
      scanHistory,
      lastSyncedAt: Date.now()
    });

    if (!result.success) {
      console.warn('⚠️ Sync failed:', result.error || result.message);
      return result;
    }

    console.log('✅ Sync successful, updating local storage');
    
    // Update local storage with synced data
    await chrome.storage.local.set({
      applications: result.data.applications,
      reminders: result.data.reminders,
      recentScans: result.data.scanHistory,  // Save as recentScans for compatibility
      lastCloudSync: Date.now()
    });

    return { success: true, data: result.data };
  } catch (error) {
    console.warn('⚠️ Cloud sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function for authenticated GET requests with token refresh
 */
async function makeAuthenticatedGetRequest(endpoint, retryCount = 0) {
  let authStatus = await auth.getAuthStatus();
  if (!authStatus.isAuthenticated) {
    return { success: false, error: 'not_authenticated', message: 'Please sign in' };
  }

  const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authStatus.token}`
    }
  });

  // If 401 and we haven't retried yet, try refreshing the token
  if (response.status === 401 && retryCount === 0) {
    console.log('🔄 Token invalid on GET, attempting refresh...');
    const refreshResult = await auth.refreshToken();
    
    if (refreshResult.success) {
      return makeAuthenticatedGetRequest(endpoint, 1);
    } else {
      return { 
        success: false, 
        error: 'session_expired', 
        message: 'Session expired. Please sign out and sign back in.' 
      };
    }
  }

  const data = await response.json();
  
  if (!response.ok) {
    return { success: false, error: data.error || 'Request failed' };
  }

  return { success: true, data };
}

/**
 * Sync data from cloud
 */
async function syncFromCloud() {
  try {
    // Check if user is authenticated first
    const authStatus = await auth.getAuthStatus();
    if (!authStatus.isAuthenticated || !authStatus.token) {
      console.log('⚠️ syncFromCloud: User not authenticated, skipping sync');
      return { success: false, error: 'not_authenticated', message: 'Please sign in to sync data' };
    }
    
    const result = await makeAuthenticatedGetRequest('/api/v3/sync');
    
    if (!result.success) {
      console.warn('⚠️ Sync from cloud failed:', result.error || result.message);
      return result;
    }

    // Update local storage with cloud data
    await chrome.storage.local.set({
      applications: result.data.applications || [],
      reminders: result.data.reminders || [],
      lastCloudSync: Date.now()
    });

    return { success: true, data: result.data };
  } catch (error) {
    console.warn('⚠️ Cloud sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Schedule a reminder using Chrome alarms API
 */
async function scheduleReminder(reminder) {
  try {
    const { id, title, date, time, type } = reminder;
    
    // Calculate alarm time
    const alarmTime = new Date(`${date}T${time}`).getTime();
    const now = Date.now();
    
    if (alarmTime <= now) {
      return { success: false, error: 'Reminder time must be in the future' };
    }

    // Create Chrome alarm
    const alarmName = `reminder_${id}`;
    await chrome.alarms.create(alarmName, {
      when: alarmTime
    });

    // Store reminder in local storage
    const result = await chrome.storage.local.get(['reminders']);
    const reminders = result.reminders || [];
    
    // Check if reminder already exists
    const existingIndex = reminders.findIndex(r => r.id === id);
    if (existingIndex >= 0) {
      reminders[existingIndex] = reminder;
    } else {
      reminders.push(reminder);
    }
    
    await chrome.storage.local.set({ reminders });

    console.log('Reminder scheduled:', alarmName, 'for', new Date(alarmTime).toLocaleString());
    return { success: true, reminder };
  } catch (error) {
    console.error('Schedule reminder error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel a scheduled reminder
 */
async function cancelReminder(reminderId) {
  try {
    const alarmName = `reminder_${reminderId}`;
    await chrome.alarms.clear(alarmName);

    // Remove from local storage
    const result = await chrome.storage.local.get(['reminders']);
    const reminders = result.reminders || [];
    const filtered = reminders.filter(r => r.id !== reminderId);
    await chrome.storage.local.set({ reminders: filtered });

    console.log('Reminder cancelled:', alarmName);
    return { success: true };
  } catch (error) {
    console.error('Cancel reminder error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all reminders
 */
async function getReminders() {
  try {
    const result = await chrome.storage.local.get(['reminders']);
    return { success: true, reminders: result.reminders || [] };
  } catch (error) {
    console.error('Get reminders error:', error);
    return { success: false, error: error.message };
  }
}

// Listen for alarm events (reminders)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('reminder_')) {
    const reminderId = alarm.name.replace('reminder_', '');
    
    // Get reminder details
    const result = await chrome.storage.local.get(['reminders']);
    const reminders = result.reminders || [];
    const reminder = reminders.find(r => r.id === reminderId);
    
    if (reminder) {
      // Show notification
      chrome.notifications.create(`notification_${reminderId}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: '📅 ApplySafe Reminder',
        message: reminder.title,
        priority: 2,
        buttons: [
          { title: 'View Dashboard' },
          { title: 'Dismiss' }
        ]
      });
      
      // Mark reminder as triggered
      const updatedReminders = reminders.map(r => {
        if (r.id === reminderId) {
          return { ...r, triggered: true, triggeredAt: Date.now() };
        }
        return r;
      });
      await chrome.storage.local.set({ reminders: updatedReminders });
    }
  }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId.startsWith('notification_')) {
    if (buttonIndex === 0) {
      // Open dashboard
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    }
    // Dismiss notification
    chrome.notifications.clear(notificationId);
  }
});

// Create Stripe checkout session
async function createCheckoutSession() {
  try {
    console.log('🛒 Creating checkout session...');
    
    const authStatus = await auth.getAuthStatus();
    const email = authStatus.user?.email;
    
    console.log('📧 Auth status:', { authenticated: !!authStatus.authenticated, email });
    
    const payload = {
      priceId: 'price_1SeNEXRvKQf7z4L6T9GroSYi'
    };
    
    if (email) {
      payload.customerEmail = email;
    }
    
    console.log('📤 Sending payload to backend:', payload);
    
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('📬 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Checkout error:', errorData);
      return { error: errorData.error || `Server error: ${response.status}` };
    }
    
    const data = await response.json();
    console.log('✅ Got checkout URL:', data.url ? 'Yes' : 'No');
    
    if (data && data.url) {
      // Open checkout URL in new tab
      console.log('🔗 Opening Stripe checkout in new tab');
      chrome.tabs.create({ url: data.url });
      return { success: true, url: data.url };
    } else {
      console.error('❌ No URL in response:', data);
      return { error: 'No checkout URL returned', data };
    }
  } catch (e) {
    console.error('💥 Stripe checkout error:', e);
    return { error: e.message };
  }
}

console.log('ApplySafe background service worker loaded');
