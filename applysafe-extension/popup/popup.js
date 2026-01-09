/**
 * ApplySafe - Popup Script
 * Handles all popup UI interactions and communication with background service
 */

// DOM Elements
const elements = {
  // States
  loadingState: document.getElementById('loadingState'),
  noJobState: document.getElementById('noJobState'),
  riskCard: document.getElementById('riskCard'),
  
  // Risk Display
  riskCircle: document.getElementById('riskCircle'),
  riskProgress: document.getElementById('riskProgress'),
  riskScore: document.getElementById('riskScore'),
  riskVerdict: document.getElementById('riskVerdict'),
  
  // Job Details
  jobTitle: document.getElementById('jobTitle'),
  companyName: document.getElementById('companyName'),
  
  // Sections
  redFlagsSection: document.getElementById('redFlagsSection'),
  redFlagsList: document.getElementById('redFlagsList'),
  positiveSection: document.getElementById('positiveSection'),
  positiveList: document.getElementById('positiveList'),
  h1bSection: document.getElementById('h1bSection'),
  h1bStatus: document.getElementById('h1bStatus'),
  h1bIcon: document.getElementById('h1bIcon'),
  h1bText: document.getElementById('h1bText'),
  explanationText: document.getElementById('explanationText'),
  
  // H1B History Elements
  h1bHistory: document.getElementById('h1bHistory'),
  h1bTotalVisas: document.getElementById('h1bTotalVisas'),
  h1bYears: document.getElementById('h1bYears'),
  h1bMedianSalary: document.getElementById('h1bMedianSalary'),
  h1bSalaryContainer: document.getElementById('h1bSalaryContainer'),
  h1bTier: document.getElementById('h1bTier'),
  h1bTierBadge: document.getElementById('h1bTierBadge'),
  
  // H1B Feedback Elements
  h1bFeedback: document.getElementById('h1bFeedback'),
  h1bFeedbackYes: document.getElementById('h1bFeedbackYes'),
  h1bFeedbackNo: document.getElementById('h1bFeedbackNo'),
  h1bFeedbackThanks: document.getElementById('h1bFeedbackThanks'),
  
  // Buttons
  refreshAnalysis: document.getElementById('refreshAnalysis'),
  reportBtn: document.getElementById('reportBtn'),
  whitelistBtn: document.getElementById('whitelistBtn'),
  checkUrlBtn: document.getElementById('checkUrlBtn'),
  urlInput: document.getElementById('urlInput'),
  openSettings: document.getElementById('openSettings'),
  toggleTheme: document.getElementById('toggleTheme'),
  
  // Lists
  recentList: document.getElementById('recentList'),
  
  // Toast
  toast: document.getElementById('toast')
};

// State
let currentAnalysis = null;
let currentTabUrl = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ApplySafe v3.0 popup loading...');
  try {
    await loadTheme();
    await loadAuthStatus();
    await loadSubscriptionStatus();
    await loadStats();
    await cleanupBadRecentScans(); // Clean up any bad data first
    await loadRecentScans();
    setupEventListeners();
    await analyzeCurrentPage();
    console.log('ApplySafe popup loaded successfully');
  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to initialize extension');
  }
});

// Clean up any bad/invalid entries from recent scans
async function cleanupBadRecentScans() {
  try {
    const result = await chrome.storage.local.get(['recentScans']);
    let recentScans = result.recentScans || [];
    const originalCount = recentScans.length;
    
    // Filter out entries that look like LinkedIn profile headlines
    recentScans = recentScans.filter(scan => {
      const title = scan.jobTitle || '';
      
      // Check for profile headline indicators
      const pipeCount = (title.match(/\|/g) || []).length;
      const looksLikeHeadline = pipeCount >= 2 || 
        /passionate about|looking for|seeking|open to|helping|building|connecting/i.test(title);
      
      if (looksLikeHeadline) {
        console.log('Removing bad recent scan entry:', title.substring(0, 50));
        return false;
      }
      return true;
    });
    
    if (recentScans.length !== originalCount) {
      console.log(`Cleaned up ${originalCount - recentScans.length} bad recent scan entries`);
      await chrome.storage.local.set({ recentScans });
    }
  } catch (error) {
    console.error('Error cleaning up recent scans:', error);
  }
}

// Load and apply theme
async function loadTheme() {
  const result = await chrome.storage.local.get(['theme']);
  const theme = result.theme || 'light';
  applyTheme(theme);
}

function applyTheme(theme) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  
  // Update toggle button icons
  const sunIcon = document.querySelector('.header-btn .sun-icon');
  const moonIcon = document.querySelector('.header-btn .moon-icon');
  if (sunIcon && moonIcon) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    sunIcon.style.display = isDark ? 'none' : 'block';
    moonIcon.style.display = isDark ? 'block' : 'none';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  chrome.storage.local.set({ theme: newTheme });
}

// Setup event listeners
function setupEventListeners() {
  elements.emailSignInBtn.addEventListener('click', () => {
    console.log('📧 Email Sign In button clicked');
    handleEmailSignIn();
  });
  
  elements.emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleEmailSignIn();
  });
  
  elements.googleSignInBtn.addEventListener('click', () => {
    console.log('🔘 Sign In button clicked');
    handleGoogleSignIn();
  });
  elements.signOutBtn.addEventListener('click', () => {
    console.log('🔘 Sign Out button clicked');
    handleSignOut();
  });
  elements.upgradeBtn.addEventListener('click', handleUpgrade);
  elements.refreshAnalysis.addEventListener('click', handleRefresh);
  elements.checkUrlBtn.addEventListener('click', handleUrlCheck);
  elements.urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUrlCheck();
  });
  elements.reportBtn.addEventListener('click', handleReport);
  elements.whitelistBtn.addEventListener('click', handleWhitelist);
  
  // Theme toggle
  if (elements.toggleTheme) {
    elements.toggleTheme.addEventListener('click', toggleTheme);
  }
  
  // Add Refresh Status button event
  const refreshStatusBtn = document.getElementById('refreshStatusBtn');
  if (refreshStatusBtn) {
    refreshStatusBtn.addEventListener('click', async () => {
      showToast('Syncing subscription status...', 'info');
      await chrome.runtime.sendMessage({ action: 'syncSubscription' });
      await loadSubscriptionStatus();
      // Debug: print subscription object
      const sub = await chrome.storage.local.get(['subscription']);
      console.log('Subscription object after manual refresh:', sub.subscription);
      showToast('Subscription status refreshed! Check console for details.', 'success');
    });
  }
  elements.openSettings.addEventListener('click', openSettings);
}

// Load authentication status
async function loadAuthStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });
    
    if (response && response.authStatus) {
      const { isAuthenticated, user } = response.authStatus;
      
      if (isAuthenticated && user) {
        // Show signed-in UI
        elements.anonymousUser.style.display = 'none';
        elements.signedInUser.style.display = 'flex';
        elements.userName.textContent = user.name;
        elements.userEmail.textContent = user.email;
        elements.userAvatar.src = user.picture || '';
      } else {
        // Show anonymous UI
        elements.anonymousUser.style.display = 'flex';
        elements.signedInUser.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error loading auth status:', error);
    // Show anonymous UI on error
    elements.anonymousUser.style.display = 'flex';
    elements.signedInUser.style.display = 'none';
  }
}

// Handle Email Sign In
async function handleEmailSignIn() {
  const email = elements.emailInput.value.trim();
  
  if (!email) {
    alert('Please enter your email');
    return;
  }
  
  if (!email.includes('@')) {
    alert('Please enter a valid email');
    return;
  }
  
  console.log('📧 Email sign-in starting:', email);
  
  try {
    elements.emailSignInBtn.disabled = true;
    elements.emailSignInBtn.textContent = 'Signing in...';
    
    const response = await chrome.runtime.sendMessage({
      action: 'signInWithEmail',
      email: email,
      name: email.split('@')[0]
    });
    
    console.log('📧 Email sign-in response:', response);
    
    if (response && response.success) {
      console.log('✅ Email sign-in successful!');
      elements.emailInput.value = '';
      await loadAuthStatus();
    } else {
      alert(`Sign-in failed: ${response?.error || 'Unknown error'}`);
      elements.emailSignInBtn.disabled = false;
      elements.emailSignInBtn.textContent = 'Sign In';
    }
  } catch (error) {
    console.error('❌ Email sign-in error:', error);
    alert('Sign-in failed: ' + error.message);
    elements.emailSignInBtn.disabled = false;
    elements.emailSignInBtn.textContent = 'Sign In';
  }
}

// Handle Google Sign In
async function handleGoogleSignIn() {
  console.log('🚀 handleGoogleSignIn called');
  console.log('🔍 chrome.runtime available:', !!chrome.runtime);
  console.log('🔍 chrome.runtime.sendMessage available:', !!chrome.runtime?.sendMessage);
  try {
    elements.googleSignInBtn.disabled = true;
    elements.googleSignInBtn.textContent = 'Signing in...';
    
    console.log('📤 Sending signInWithGoogle message...');
    let response;
    try {
      response = await chrome.runtime.sendMessage({ action: 'signInWithGoogle' });
    } catch (msgError) {
      console.error('❌ Message sending failed:', msgError.message);
      // Reset button
      elements.googleSignInBtn.disabled = false;
      elements.googleSignInBtn.innerHTML = `<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Sign in with Google`;
      showError('Sign in failed: ' + msgError.message);
      throw msgError;
    }
    console.log('📥 Sign in response:', response);
    console.log('📥 Response type:', typeof response);
    console.log('📥 Response stringified:', JSON.stringify(response));
    
    if (response && response.success) {
      // Reload auth status
      await loadAuthStatus();
      await loadSubscriptionStatus();
      showSuccess('Successfully signed in!');
    } else {
      const errorMsg = response?.error || 'Failed to sign in';
      console.error('❌ Sign in failed:', errorMsg);
      showError(errorMsg);
      elements.googleSignInBtn.disabled = false;
      elements.googleSignInBtn.innerHTML = `
        <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Sign in with Google
      `;
    }
  } catch (error) {
    console.error('Sign in error:', error);
    showError('Failed to sign in');
    elements.googleSignInBtn.disabled = false;
  }
}

// Handle Sign Out
async function handleSignOut() {
  console.log('🚀 handleSignOut called');
  try {
    console.log('📤 Sending signOut message...');
    const response = await chrome.runtime.sendMessage({ action: 'signOut' });
    console.log('📥 Sign out response:', response);
    
    if (response && response.success) {
      await loadAuthStatus();
      await loadSubscriptionStatus();
      showSuccess('Successfully signed out');
    } else {
      showError('Failed to sign out');
    }
  } catch (error) {
    console.error('Sign out error:', error);
    showError('Failed to sign out');
  }
}

// Load subscription status
async function loadSubscriptionStatus() {
  console.log('loadSubscriptionStatus called');
  try {
    console.log('Sending getTrialInfo message...');
    const response = await chrome.runtime.sendMessage({ action: 'getTrialInfo' });
    console.log('Trial info response:', response);
    
    if (response && response.trialInfo) {
      const info = response.trialInfo;
      console.log('Trial info:', info);
      
      // Hide banner only if user is paid/active
      if (info.isPaid) {
        console.log('User is paid, hiding banner');
        elements.subscriptionBanner.style.display = 'none';
        return;
      }
      
      // Show banner for trial or expired users
      console.log('Showing banner for trial/expired user');
      elements.subscriptionBanner.style.display = 'flex';
      
      if (info.isExpired) {
        elements.subscriptionBanner.className = 'subscription-banner expired';
        elements.bannerTitle.textContent = 'Trial Expired';
        elements.bannerMessage.textContent = 'Upgrade to continue using ApplySafe';
        if (elements.bannerIcon) elements.bannerIcon.textContent = '🔒';
      } else {
        // Default to trial (including new users)
        elements.subscriptionBanner.className = 'subscription-banner trial';
        elements.bannerTitle.textContent = 'Free Trial';
        const daysLeft = info.daysLeft || 7;
        const scansLeft = info.scansLeft !== undefined ? info.scansLeft : 10;
        const plural = daysLeft === 1 ? 'day' : 'days';
        elements.bannerMessage.textContent = `${daysLeft} ${plural} left • ${scansLeft} scans remaining today`;
        if (elements.bannerIcon) elements.bannerIcon.textContent = '⏰';
      }
    } else {
      // No response - show default trial banner
      console.log('No trial info, showing default banner');
      elements.subscriptionBanner.style.display = 'flex';
      elements.subscriptionBanner.className = 'subscription-banner trial';
      elements.bannerTitle.textContent = 'Free Trial';
      elements.bannerMessage.textContent = '7 days left • 10 scans remaining today';
      if (elements.bannerIcon) elements.bannerIcon.textContent = '⏰';
    }
  } catch (error) {
    console.error('Error loading subscription:', error);
    // On error, show default trial banner
    elements.subscriptionBanner.style.display = 'flex';
    elements.subscriptionBanner.className = 'subscription-banner trial';
    elements.bannerTitle.textContent = 'Free Trial';
    elements.bannerMessage.textContent = '7 days left • 10 scans remaining today';
  }
}

// Handle upgrade button click
async function handleUpgrade() {
  try {
    console.log('🛒 Upgrade button clicked, sending to background...');
    const response = await chrome.runtime.sendMessage({ action: 'startCheckout' });
    console.log('📬 Background response:', response);
    
    if (response && response.success) {
      showToast('Opening checkout...', 'success');
    } else if (response && response.error) {
      console.error('Checkout error from background:', response.error);
      showToast(`Checkout failed: ${response.error}`, 'error');
    } else {
      console.error('Unknown response:', response);
      showToast('Failed to open checkout', 'error');
    }
  } catch (error) {
    console.error('Upgrade error:', error);
    showToast('Error starting checkout. Check console for details.', 'error');
  }
}

// Load statistics from storage (now using database)
async function loadStats() {
  try {
    // Get real-time stats from database
    const response = await chrome.runtime.sendMessage({ action: 'getStats' });
    
    if (response && response.stats) {
      const stats = response.stats;
      elements.scamsBlocked.textContent = stats.scamsCaught === 0 ? '✓' : stats.scamsCaught;
      elements.jobsScanned.textContent = stats.totalJobs;
      
      // Calculate safety rate
      if (stats.totalJobs > 0) {
        const safetyRate = Math.round(((stats.totalJobs - stats.scamsCaught) / stats.totalJobs) * 100);
        elements.safetyScore.textContent = `${safetyRate}%`;
      }
    } else {
      // Fallback to old storage method
      const result = await chrome.storage.local.get(['stats']);
      const oldStats = result.stats || { scamsBlocked: 0, jobsScanned: 0 };
      elements.scamsBlocked.textContent = oldStats.scamsBlocked;
      elements.jobsScanned.textContent = oldStats.jobsScanned;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Load recent scans
async function loadRecentScans() {
  try {
    const result = await chrome.storage.local.get(['recentScans']);
    const recentScans = result.recentScans || [];
    
    if (recentScans.length === 0) {
      elements.recentList.innerHTML = '<div class="empty-state"><p>No recent scans yet</p></div>';
      return;
    }
    
    elements.recentList.innerHTML = recentScans.slice(0, 5).map(scan => {
      const riskClass = getRiskClass(scan.riskScore);
      const timeAgo = getTimeAgo(scan.timestamp);
      
      return `
        <div class="recent-item" data-url="${scan.url}">
          <div class="recent-item-badge ${riskClass}">${scan.riskScore}</div>
          <div class="recent-item-info">
            <div class="recent-item-title">${escapeHtml(scan.jobTitle || 'Unknown Job')}</div>
            <div class="recent-item-company">${escapeHtml(scan.company || 'Unknown Company')}</div>
          </div>
          <div class="recent-item-time">${timeAgo}</div>
        </div>
      `;
    }).join('');
    
    // Add click handlers
    document.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        chrome.tabs.create({ url });
      });
    });
  } catch (error) {
    console.error('Error loading recent scans:', error);
  }
}

// Analyze current page
async function analyzeCurrentPage() {
  // Clear any previous analysis state
  console.log('========= ANALYZE CURRENT PAGE CALLED =========');
  currentAnalysis = null;
  
  showLoading();
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabUrl = tab.url;
    
    console.log('📍 Current tab URL:', tab.url);
    console.log('📍 Current tab title:', tab.title);
    
    // Check if it's a job posting site
    if (!isJobSite(tab.url)) {
      console.log('Not a job site');
      showNoJobState();
      return;
    }
    
    // Clear caches first to ensure fresh analysis
    await clearCachedAnalysis(tab.url);
    
    // Request analysis from content script with retry first
    let retries = 3;
    let response = null;
    
    while (retries > 0 && !response?.jobData) {
      try {
        console.log(`Attempting to get job data (${4 - retries}/3)...`);
        
        // First, ask content script to re-process the page
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'reprocessPage' });
          await new Promise(resolve => setTimeout(resolve, 300)); // Wait for processing
        } catch (e) {
          console.log('Could not trigger reprocess');
        }
        
        // Now get the job data - always request fresh data
        response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobData', forceRefresh: true });
        
        if (response?.jobData) {
          console.log('Job data received from content script:', {
            title: response.jobData.title,
            company: response.jobData.company,
            url: response.jobData.url
          });
          
          // Clear any existing cache for this URL to ensure fresh analysis
          await clearCachedAnalysis(response.jobData.url || tab.url);
          break;
        }
        
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
        }
      } catch (error) {
        console.log('Content script not responding:', error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // After getting job data, check cache using the job's URL (not tab URL)
    const cacheUrl = response?.jobData?.url || tab.url;
    console.log('Checking cache with URL:', cacheUrl);
    
    // Skip popup cache - always request fresh analysis from service worker
    // This ensures H1B data is always current
    // The service worker has its own smarter caching
    
    if (response && response.jobData) {
      // Validate the job data doesn't look like a profile headline
      const title = response.jobData.title || '';
      const pipeCount = (title.match(/\|/g) || []).length;
      const looksLikeHeadline = pipeCount >= 2 || 
        /passionate about|looking for|seeking|open to|helping|building|connecting/i.test(title);
      
      if (looksLikeHeadline) {
        console.warn('Job data looks like a LinkedIn profile headline, skipping analysis');
        console.log('Extracted title:', title);
        showNoJobState();
        return;
      }
      
      console.log('Sending job data for analysis...');
      
      // Use the job's URL from the job data (more accurate than tab.url)
      const jobUrl = response.jobData.url || tab.url;
      
      // Clear service worker cache for this URL to ensure fresh analysis
      try {
        await chrome.runtime.sendMessage({ action: 'clearCache' });
      } catch (e) {
        console.log('Could not clear service worker cache:', e);
      }
      
      // Send to background for AI analysis
      const analysis = await chrome.runtime.sendMessage({
        action: 'analyzeJob',
        jobData: response.jobData,
        url: jobUrl
      });
      
      if (analysis && analysis.success) {
        console.log('Analysis successful');
        displayAnalysis(analysis.result);
        await cacheAnalysis(jobUrl, analysis.result);
        await updateStats(analysis.result);
        await addToRecentScans(jobUrl, response.jobData, analysis.result);
        
        // Notify dashboard to refresh data
        try {
          chrome.runtime.sendMessage({ action: 'scanAdded' }).catch(() => {});
        } catch (e) {
          console.log('Could not notify dashboard:', e);
        }
        
        // Reload subscription status after scan
        await loadSubscriptionStatus();
      } else if (analysis && analysis.error) {
        // Handle subscription errors
        if (analysis.error === 'trial_expired' || analysis.error === 'limit_reached') {
          showError(analysis.message);
          await loadSubscriptionStatus(); // Update banner
        } else {
          console.error('Analysis failed:', analysis);
          showError(analysis?.message || 'Analysis failed');
        }
      } else {
        console.error('Analysis failed:', analysis);
        showError('Analysis failed');
      }
    } else {
      console.log('No job data available after retries');
      showNoJobState();
    }
  } catch (error) {
    console.error('Error analyzing page:', error);
    showError('Failed to analyze page');
  }
}

// Display analysis results
function displayAnalysis(analysis) {
  console.log('displayAnalysis called with:', {
    jobTitle: analysis.jobTitle,
    company: analysis.company,
    riskScore: analysis.riskScore,
    hasRedFlags: !!analysis.redFlags,
    hasPositiveIndicators: !!analysis.positiveIndicators
  });
  
  elements.loadingState.style.display = 'none';
  elements.noJobState.style.display = 'none';
  elements.riskCard.style.display = 'block';
  
  currentAnalysis = analysis;
  
  // Update risk score
  const riskScore = analysis.riskScore || 0;
  elements.riskScore.textContent = riskScore;
  
  // Animate circle progress
  const circumference = 283;
  const offset = circumference - (riskScore / 100) * circumference;
  elements.riskProgress.style.strokeDashoffset = offset;
  
  // Update colors based on risk
  const riskClass = getRiskClass(riskScore);
  updateRiskColors(riskClass, riskScore);
  
  // Update verdict
  updateVerdict(riskScore, riskClass);
  
  // Update job details
  const displayTitle = analysis.jobTitle || analysis.title || 'Unknown Position';
  const displayCompany = analysis.company || 'Unknown Company';
  console.log('Displaying:', { displayTitle, displayCompany });
  
  elements.jobTitle.textContent = displayTitle;
  elements.companyName.textContent = displayCompany;
  
  // Update red flags
  if (analysis.redFlags && analysis.redFlags.length > 0) {
    elements.redFlagsSection.style.display = 'block';
    elements.redFlagsList.innerHTML = analysis.redFlags
      .map(flag => `<li>${escapeHtml(flag)}</li>`)
      .join('');
  } else {
    elements.redFlagsSection.style.display = 'none';
  }
  
  // Update positive indicators (including verification)
  const positiveItems = [];
  
  // Add regular positive indicators
  if (analysis.positiveIndicators && analysis.positiveIndicators.length > 0) {
    positiveItems.push(...analysis.positiveIndicators);
  }
  
  // Add company verification as positive indicators
  if (analysis.companyVerification) {
    const v = analysis.companyVerification;
    
    if (v.jobFoundOnCareerSite) {
      positiveItems.push('✓✓✓ Job verified on company\'s official career site');
    }
    if (v.websiteAccessible && v.verifiedUrl) {
      positiveItems.push(`✓ Company website verified: ${v.verifiedUrl}`);
    }
    if (v.hasCareerPage && !v.jobFoundOnCareerSite) {
      positiveItems.push('✓ Company has active career/jobs page');
    }
    
    // Show H1B info in console for debugging
    console.log('H1B Sponsorship Data:', v.h1bSponsorship);
  }
  
  if (positiveItems.length > 0) {
    elements.positiveSection.style.display = 'block';
    elements.positiveList.innerHTML = positiveItems
      .map(indicator => `<li>${escapeHtml(indicator)}</li>`)
      .join('');
  } else {
    elements.positiveSection.style.display = 'none';
  }
  
  // Update H-1B Visa Sponsorship Section (dedicated section)
  updateH1BSection(analysis);
  
  // Update AI explanation
  elements.explanationText.textContent = analysis.explanation || 'Analysis complete.';
}

// Current company name for feedback
let currentH1BCompany = null;

// Update H-1B Visa Sponsorship display with history and feedback
function updateH1BSection(analysis) {
  const h1bSection = elements.h1bSection;
  const h1bStatus = elements.h1bStatus;
  const h1bIcon = elements.h1bIcon;
  const h1bText = elements.h1bText;
  
  if (!h1bSection || !h1bStatus || !h1bIcon || !h1bText) {
    console.log('H1B section elements not found');
    return;
  }
  
  // Check if we have H1B data
  const h1bData = analysis.companyVerification?.h1bSponsorship;
  const companyName = analysis.company || 'this company';
  
  // Store company name for feedback
  currentH1BCompany = companyName;
  
  console.log('Updating H1B section with data:', h1bData);
  
  // Always show the H1B section
  h1bSection.style.display = 'block';
  
  // Remove previous status classes
  h1bStatus.classList.remove('sponsors', 'no-records', 'checking');
  
  // Reset history section
  if (elements.h1bHistory) {
    elements.h1bHistory.style.display = 'none';
  }
  
  // Reset feedback section
  resetH1BFeedback();
  
  if (h1bData) {
    if (h1bData.sponsors) {
      // Company sponsors H-1B visas
      h1bStatus.classList.add('sponsors');
      h1bIcon.textContent = '✅';
      h1bText.innerHTML = `<strong>Verified H-1B Sponsor</strong><br>${h1bData.note || `${companyName} has sponsored H-1B visas`}`;
      
      // Show sponsorship history if available
      updateH1BHistory(h1bData);
    } else {
      // Company checked but no records found
      h1bStatus.classList.add('no-records');
      h1bIcon.textContent = '⚠️';
      h1bText.innerHTML = `<strong>No H-1B Records</strong><br>${h1bData.note || 'No H-1B sponsorship records found for this company'}`;
    }
    
    // Setup feedback buttons
    setupH1BFeedbackListeners();
  } else {
    // H1B check was not performed or failed
    h1bStatus.classList.add('checking');
    h1bIcon.textContent = '🔍';
    h1bText.innerHTML = `<strong>H-1B Status Unknown</strong><br>Could not verify H-1B sponsorship history for ${companyName}`;
    
    // Hide feedback when status is unknown
    if (elements.h1bFeedback) {
      elements.h1bFeedback.style.display = 'none';
    }
  }
}

// Update H1B history display
function updateH1BHistory(h1bData) {
  if (!elements.h1bHistory || !h1bData.history) {
    return;
  }
  
  const history = h1bData.history;
  
  // Show history section
  elements.h1bHistory.style.display = 'block';
  
  // Update total visas
  if (elements.h1bTotalVisas) {
    const total = h1bData.totalApplications || history.estimatedTotal || 0;
    elements.h1bTotalVisas.textContent = total > 0 ? total.toLocaleString() + '+' : '--';
  }
  
  // Update years
  if (elements.h1bYears) {
    elements.h1bYears.textContent = history.years || '--';
  }
  
  // Update median salary if available
  if (elements.h1bMedianSalary && elements.h1bSalaryContainer) {
    if (history.medianSalary) {
      elements.h1bMedianSalary.textContent = '$' + history.medianSalary;
      elements.h1bSalaryContainer.style.display = 'block';
    } else {
      elements.h1bSalaryContainer.style.display = 'none';
    }
  }
  
  // Update tier badge
  if (elements.h1bTier && elements.h1bTierBadge) {
    const tier = h1bData.tier || 'regular';
    if (tier === 'major') {
      elements.h1bTierBadge.textContent = '⭐ Major Sponsor';
      elements.h1bTierBadge.className = 'h1b-tier-badge major';
      elements.h1bTier.style.display = 'block';
    } else {
      elements.h1bTier.style.display = 'none';
    }
  }
}

// Reset H1B feedback UI
function resetH1BFeedback() {
  if (elements.h1bFeedback) {
    elements.h1bFeedback.style.display = 'flex';
  }
  if (elements.h1bFeedbackYes) {
    elements.h1bFeedbackYes.disabled = false;
    elements.h1bFeedbackYes.classList.remove('selected');
  }
  if (elements.h1bFeedbackNo) {
    elements.h1bFeedbackNo.disabled = false;
    elements.h1bFeedbackNo.classList.remove('selected');
  }
  if (elements.h1bFeedbackThanks) {
    elements.h1bFeedbackThanks.style.display = 'none';
  }
}

// Setup H1B feedback button listeners
function setupH1BFeedbackListeners() {
  if (elements.h1bFeedbackYes) {
    elements.h1bFeedbackYes.onclick = () => submitH1BFeedback(true);
  }
  if (elements.h1bFeedbackNo) {
    elements.h1bFeedbackNo.onclick = () => submitH1BFeedback(false);
  }
}

// Submit H1B feedback
async function submitH1BFeedback(isAccurate) {
  if (!currentH1BCompany) {
    console.log('No company name for feedback');
    return;
  }
  
  try {
    // Disable buttons
    if (elements.h1bFeedbackYes) {
      elements.h1bFeedbackYes.disabled = true;
      if (isAccurate) elements.h1bFeedbackYes.classList.add('selected');
    }
    if (elements.h1bFeedbackNo) {
      elements.h1bFeedbackNo.disabled = true;
      if (!isAccurate) elements.h1bFeedbackNo.classList.add('selected');
    }
    
    // Send feedback to background
    const response = await chrome.runtime.sendMessage({
      action: 'submitH1BFeedback',
      companyName: currentH1BCompany,
      isAccurate: isAccurate,
      comment: ''
    });
    
    if (response && response.success) {
      // Show thanks message
      if (elements.h1bFeedbackThanks) {
        elements.h1bFeedbackThanks.style.display = 'flex';
      }
      console.log('H1B feedback submitted:', response);
    } else {
      console.error('Failed to submit H1B feedback:', response?.error);
      showToast('Failed to submit feedback', 'error');
      // Re-enable buttons on error
      resetH1BFeedback();
    }
  } catch (error) {
    console.error('Error submitting H1B feedback:', error);
    showToast('Failed to submit feedback', 'error');
    resetH1BFeedback();
  }
}

// Update risk colors
function updateRiskColors(riskClass, riskScore) {
  const colors = {
    safe: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444'
  };
  
  elements.riskProgress.style.stroke = colors[riskClass];
  elements.riskCircle.classList.remove('safe', 'warning', 'danger');
  elements.riskCircle.classList.add(riskClass);
}

// Update verdict badge
function updateVerdict(riskScore, riskClass) {
  const verdicts = {
    safe: { text: 'Looks Safe', icon: '✓' },
    warning: { text: 'Review Carefully', icon: '⚠️' },
    danger: { text: 'High Risk', icon: '🚨' }
  };
  
  const verdict = verdicts[riskClass];
  
  elements.riskVerdict.innerHTML = `
    <span class="verdict-badge ${riskClass}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${riskClass === 'safe' 
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>'
          : riskClass === 'warning'
          ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
          : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
        }
      </svg>
      ${verdict.text}
    </span>
  `;
}

// Get risk class based on score
function getRiskClass(score) {
  if (score <= 30) return 'safe';
  if (score <= 60) return 'warning';
  return 'danger';
}

// Show loading state
function showLoading() {
  elements.loadingState.style.display = 'flex';
  elements.noJobState.style.display = 'none';
  elements.riskCard.style.display = 'none';
}

// Show no job state
function showNoJobState() {
  elements.loadingState.style.display = 'none';
  elements.noJobState.style.display = 'flex';
  elements.riskCard.style.display = 'none';
}

// Show error
function showError(message) {
  showToast(message, 'error');
  showNoJobState();
}

// Show success
function showSuccess(message) {
  showToast(message, 'success');
}

// Handle refresh button
async function handleRefresh() {
  elements.refreshAnalysis.classList.add('spinning');
  
  try {
    console.log('Manual refresh triggered - clearing all caches');
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Clear ALL caches first - this is important for getting fresh data
    try {
      await chrome.runtime.sendMessage({ action: 'clearCache' });
      console.log('Service worker cache cleared');
    } catch (e) {
      console.log('Could not clear service worker cache:', e);
    }
    
    // Clear popup's cached analysis
    if (currentTabUrl) {
      await clearCachedAnalysis(currentTabUrl);
    }
    if (tab.url) {
      await clearCachedAnalysis(tab.url);
    }
    
    // Clear current analysis state
    currentAnalysis = null;
    
    // Force content script to re-extract job data
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'forceAnalyze' });
      console.log('Forced re-analysis in content script');
    } catch (error) {
      console.log('Could not trigger content script re-analysis:', error);
    }
    
    // Wait for content script to process
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Re-analyze
    await analyzeCurrentPage();
    
    showToast('Analysis refreshed', 'success');
  } catch (error) {
    console.error('Refresh error:', error);
    showToast('Refresh failed', 'error');
  }
  
  setTimeout(() => {
    elements.refreshAnalysis.classList.remove('spinning');
  }, 500);
}

// Handle URL check
async function handleUrlCheck() {
  const url = elements.urlInput.value.trim();
  
  if (!url) {
    showToast('Please enter a URL', 'warning');
    return;
  }
  
  if (!isValidUrl(url)) {
    showToast('Please enter a valid URL', 'error');
    return;
  }
  
  showToast('Opening URL for analysis...', 'success');
  
  // Open URL in new tab
  chrome.tabs.create({ url, active: true });
}

// Handle report
async function handleReport() {
  if (!currentAnalysis) return;
  
  try {
    await chrome.runtime.sendMessage({
      action: 'reportScam',
      data: {
        url: currentTabUrl,
        analysis: currentAnalysis,
        timestamp: Date.now()
      }
    });
    
    showToast('Thank you for reporting!', 'success');
  } catch (error) {
    showToast('Failed to submit report', 'error');
  }
}

// Handle whitelist
async function handleWhitelist() {
  if (!currentAnalysis) return;
  
  try {
    const result = await chrome.storage.local.get(['whitelist']);
    const whitelist = result.whitelist || [];
    
    const domain = new URL(currentTabUrl).hostname;
    
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      await chrome.storage.local.set({ whitelist });
      showToast(`${domain} added to whitelist`, 'success');
    } else {
      showToast('Already in whitelist', 'warning');
    }
  } catch (error) {
    showToast('Failed to add to whitelist', 'error');
  }
}

// Open dashboard

// Open settings
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Cache management
async function getCachedAnalysis(url) {
  try {
    const result = await chrome.storage.local.get(['analysisCache']);
    const cache = result.analysisCache || {};
    const cached = cache[url];
    
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      return cached.data;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function cacheAnalysis(url, data) {
  try {
    const result = await chrome.storage.local.get(['analysisCache']);
    const cache = result.analysisCache || {};
    cache[url] = { data, timestamp: Date.now() };
    await chrome.storage.local.set({ analysisCache: cache });
  } catch (error) {
    console.error('Error caching analysis:', error);
  }
}

async function clearCachedAnalysis(url) {
  try {
    const result = await chrome.storage.local.get(['analysisCache', 'h1bCache']);
    const cache = result.analysisCache || {};
    delete cache[url];
    await chrome.storage.local.set({ analysisCache: cache });
    
    // Also clear H1B cache to get fresh data
    await chrome.storage.local.remove(['h1bCache']);
    console.log('Caches cleared for URL:', url);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

// Update stats
async function updateStats(analysis) {
  try {
    const result = await chrome.storage.local.get(['stats']);
    const stats = result.stats || { scamsBlocked: 0, jobsScanned: 0, dailyActivity: [0, 0, 0, 0, 0, 0, 0] };
    
    stats.jobsScanned++;
    if (analysis.riskScore > 60) {
      stats.scamsBlocked++;
    }
    
    // Update daily activity tracking
    if (!stats.dailyActivity) {
      stats.dailyActivity = [0, 0, 0, 0, 0, 0, 0];
    }
    
    // Get today's date and check if we need to shift the array
    const today = new Date().toDateString();
    if (!stats.lastActivityDate || stats.lastActivityDate !== today) {
      // New day - shift the array and add new day at beginning
      stats.dailyActivity.pop();  // Remove oldest day
      stats.dailyActivity.unshift(1);  // Add today's data
      stats.lastActivityDate = today;
    } else {
      // Same day - increment today's count
      stats.dailyActivity[0] = (stats.dailyActivity[0] || 0) + 1;
    }
    
    await chrome.storage.local.set({ stats });
    await loadStats();
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// Add to recent scans
async function addToRecentScans(url, jobData, analysis) {
  try {
    console.log('addToRecentScans called with:', {
      url,
      jobData: { title: jobData?.title, company: jobData?.company },
      analysis: { jobTitle: analysis?.jobTitle, company: analysis?.company, riskScore: analysis?.riskScore }
    });
    
    const result = await chrome.storage.local.get(['recentScans']);
    let recentScans = result.recentScans || [];
    
    // Create the new scan entry
    const newScan = {
      url,
      jobTitle: jobData.title || analysis.jobTitle,
      company: jobData.company || analysis.company,
      riskScore: analysis.riskScore,
      timestamp: Date.now()
    };
    
    console.log('New scan object:', newScan);
    
    // Remove any existing entries with the same URL (to avoid duplicates)
    recentScans = recentScans.filter(scan => scan.url !== url);
    
    // Also remove if same job title and company (different URL but same job)
    recentScans = recentScans.filter(scan => 
      !(scan.jobTitle === newScan.jobTitle && scan.company === newScan.company)
    );
    
    // Add new scan at the beginning
    recentScans.unshift(newScan);
    
    // Keep only last 50 scans
    if (recentScans.length > 50) {
      recentScans.pop();
    }
    
    console.log('Saving recentScans to storage:', recentScans.length, 'items');
    await chrome.storage.local.set({ recentScans });
    console.log('✅ recentScans saved successfully');
    
    await loadRecentScans();
  } catch (error) {
    console.error('Error saving recent scan:', error);
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

// Utility functions
function isJobSite(url) {
  const lowerUrl = url.toLowerCase();
  
  // LinkedIn - be specific about job pages (not profiles, feed, etc.)
  if (lowerUrl.includes('linkedin.com')) {
    // Must have /jobs/ in the URL for it to be a job page
    if (lowerUrl.includes('/jobs/view/') || lowerUrl.includes('/jobs/collections/') || 
        lowerUrl.includes('/jobs/search/')) {
      return true;
    }
    // Exclude profile pages (/in/), feed, messaging, etc.
    if (lowerUrl.includes('/in/') || lowerUrl.includes('/feed') || 
        lowerUrl.includes('/messaging') || lowerUrl.includes('/mynetwork')) {
      return false;
    }
    // Generic /jobs/ might be acceptable
    return lowerUrl.includes('/jobs/');
  }
  
  // Other job sites
  const jobSites = [
    'indeed.com',
    'glassdoor.com',
    'ziprecruiter.com',
    'monster.com',
    'simplyhired.com',
    'dice.com',
    'careerbuilder.com',
    'angel.co',
    'wellfound.com',
    'upwork.com',
    'flexjobs.com',
    'remote.co',
    'weworkremotely.com',
    'remoteok.com'
  ];
  
  return jobSites.some(site => lowerUrl.includes(site));
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}
