/**
 * ApplySafe - Popup Script
 * Handles all popup UI interactions and communication with background service
 */

// DOM Elements
const elements = {
  // Stats
  scamsBlocked: document.getElementById('scamsBlocked'),
  jobsScanned: document.getElementById('jobsScanned'),
  safetyScore: document.getElementById('safetyScore'),
  
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
  explanationText: document.getElementById('explanationText'),
  
  // Buttons
  refreshAnalysis: document.getElementById('refreshAnalysis'),
  reportBtn: document.getElementById('reportBtn'),
  whitelistBtn: document.getElementById('whitelistBtn'),
  checkUrlBtn: document.getElementById('checkUrlBtn'),
  urlInput: document.getElementById('urlInput'),
  viewAllBtn: document.getElementById('viewAllBtn'),
  openSettings: document.getElementById('openSettings'),
  
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
  console.log('ApplySafe popup loading...');
  try {
    await loadStats();
    await loadRecentScans();
    setupEventListeners();
    await analyzeCurrentPage();
    console.log('ApplySafe popup loaded successfully');
  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to initialize extension');
  }
});

// Setup event listeners
function setupEventListeners() {
  elements.refreshAnalysis.addEventListener('click', handleRefresh);
  elements.checkUrlBtn.addEventListener('click', handleUrlCheck);
  elements.urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUrlCheck();
  });
  elements.reportBtn.addEventListener('click', handleReport);
  elements.whitelistBtn.addEventListener('click', handleWhitelist);
  elements.viewAllBtn.addEventListener('click', openDashboard);
  elements.openSettings.addEventListener('click', openSettings);
}

// Load statistics from storage (now using database)
async function loadStats() {
  try {
    // Get real-time stats from database
    const response = await chrome.runtime.sendMessage({ action: 'getStats' });
    
    if (response && response.stats) {
      const stats = response.stats;
      elements.scamsBlocked.textContent = stats.scamsCaught;
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
  showLoading();
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabUrl = tab.url;
    
    console.log('Analyzing tab:', tab.url);
    
    // Check if it's a job posting site
    if (!isJobSite(tab.url)) {
      console.log('Not a job site');
      showNoJobState();
      return;
    }
    
    // Request analysis from content script with retry first
    let retries = 3;
    let response = null;
    
    while (retries > 0 && !response?.jobData) {
      try {
        console.log(`Attempting to get job data (${4 - retries}/3)...`);
        response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobData' });
        
        if (response?.jobData) {
          console.log('Job data received from content script:', {
            title: response.jobData.title,
            company: response.jobData.company,
            url: response.jobData.url
          });
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
    const cached = await getCachedAnalysis(cacheUrl);
    if (cached) {
      console.log('Using cached analysis:', {
        company: cached.company,
        title: cached.jobTitle
      });
      displayAnalysis(cached);
      return;
    }
    
    if (response && response.jobData) {
      console.log('Sending job data for analysis...');
      
      // Use the job's URL from the job data (more accurate than tab.url)
      const jobUrl = response.jobData.url || tab.url;
      
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
      } else {
        console.error('Analysis failed:', analysis);
        showError(analysis?.error || 'Analysis failed');
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
  elements.jobTitle.textContent = analysis.jobTitle || 'Unknown Position';
  elements.companyName.textContent = analysis.company || 'Unknown Company';
  
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
    
    // H1B Sponsorship Display
    if (v.h1bSponsorship && v.h1bSponsorship.sponsors) {
      positiveItems.push(`✓ H1B Visa Sponsor: ${v.h1bSponsorship.note}`);
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
  
  // Update AI explanation
  elements.explanationText.textContent = analysis.explanation || 'Analysis complete.';
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
    warning: { text: 'Use Caution', icon: '⚠️' },
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

// Handle refresh button
async function handleRefresh() {
  elements.refreshAnalysis.classList.add('spinning');
  
  try {
    console.log('Manual refresh triggered');
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Force content script to re-extract job data
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'forceAnalyze' });
      console.log('Forced re-analysis in content script');
    } catch (error) {
      console.log('Could not trigger content script re-analysis:', error);
    }
    
    // Clear cache for current URL
    if (currentTabUrl) {
      await clearCachedAnalysis(currentTabUrl);
    }
    
    // Wait a moment for content script to process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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

// Open dashboard/options
function openDashboard() {
  chrome.runtime.openOptionsPage();
}

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
    const result = await chrome.storage.local.get(['analysisCache']);
    const cache = result.analysisCache || {};
    delete cache[url];
    await chrome.storage.local.set({ analysisCache: cache });
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

// Update stats
async function updateStats(analysis) {
  try {
    const result = await chrome.storage.local.get(['stats']);
    const stats = result.stats || { scamsBlocked: 0, jobsScanned: 0 };
    
    stats.jobsScanned++;
    if (analysis.riskScore > 60) {
      stats.scamsBlocked++;
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
    const result = await chrome.storage.local.get(['recentScans']);
    const recentScans = result.recentScans || [];
    
    // Add new scan at the beginning
    recentScans.unshift({
      url,
      jobTitle: jobData.title || analysis.jobTitle,
      company: jobData.company || analysis.company,
      riskScore: analysis.riskScore,
      timestamp: Date.now()
    });
    
    // Keep only last 50 scans
    if (recentScans.length > 50) {
      recentScans.pop();
    }
    
    await chrome.storage.local.set({ recentScans });
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
  const jobSites = [
    'linkedin.com/jobs',
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
  
  return jobSites.some(site => url.includes(site));
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
