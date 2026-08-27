/**
 * ApplySafe Dashboard - Main JavaScript
 * Version 3.0.0
 */

// State
let currentUser = null;
let settings = {
  theme: 'system',
  scamAlerts: true,
  weeklySummary: false,
  cloudSync: true
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initializeDashboard();
});

// Listen for messages from popup to refresh data when new scans are added
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scanAdded' || message.action === 'statsUpdated') {
    console.log('📨 Received message:', message.action, '- Refreshing dashboard data');
    loadScanHistory();
    updateStats();
  }
});

// Initialize Dashboard
async function initializeDashboard() {
  console.log('ApplySafe Dashboard v3.0 initializing...');
  
  // Load saved theme
  loadTheme();
  
  // Setup navigation
  setupNavigation();
  
  // Setup modals
  setupModals();
  
  // Load user data
  await loadUserData();
  
  // Auto-sync from cloud if user is signed in
  if (currentUser) {
    console.log('✅ User signed in, auto-syncing from cloud...');
    try {
      const syncResult = await chrome.runtime.sendMessage({ action: 'syncFromCloud' });
      if (syncResult?.success && syncResult?.data) {
        console.log('📥 Auto-sync successful, loading cloud data');
        // Update local arrays with cloud data
        if (syncResult.data.scanHistory) scanHistory = syncResult.data.scanHistory;
      }
    } catch (e) {
      console.log('⚠️ Auto-sync failed:', e);
    }
  }
  
  // Load scan history
  await loadScanHistory();
  
  // Setup event listeners
  setupEventListeners();
  
  // Update stats
  updateStats();
  
  console.log('Dashboard initialized successfully');
}

// Theme Management
function loadTheme() {
  chrome.storage.local.get(['theme'], (result) => {
    const theme = result.theme || 'system';
    settings.theme = theme;
    applyTheme(theme);
    
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = theme;
  });
}

function applyTheme(theme) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// Navigation
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewAllLinks = document.querySelectorAll('.view-all');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      switchTab(tab);
    });
  });
  
  viewAllLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tabName) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });
  
  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `${tabName}-tab`);
  });
  
  // Update header
  const titles = {
    'overview': { title: 'Overview', description: 'Review risky listings and trusted employers' },
    'ai-tools': { title: 'Career Tools', description: 'Draft faster and prepare with better context' },
    'analytics': { title: 'Analytics', description: 'Insights into your job search' },
    'settings': { title: 'Settings', description: 'Customize your experience' },
    'scan-history': { title: 'Scan History', description: 'Every listing your extension has reviewed' },
    'whitelist': { title: 'Trusted Companies', description: 'Employers you trust and want to skip' }
  };
  
  const info = titles[tabName] || titles['overview'];
  document.getElementById('pageTitle').textContent = info.title;
  document.getElementById('pageDescription').textContent = info.description;
  
  // Load scan history when switching to that tab
  if (tabName === 'scan-history') {
    loadScanHistory();
  }
  
  // Load whitelist when switching to that tab
  if (tabName === 'whitelist') {
    loadWhitelist();
  }
}

// Modal Management
function setupModals() {
  // Cover Letter Modal
  const coverLetterModal = document.getElementById('coverLetterModal');
  const generateCLBtn = document.getElementById('generateCoverLetter');
  const closeCLBtn = document.getElementById('closeCoverLetterModal');
  
  generateCLBtn?.addEventListener('click', () => openModal(coverLetterModal));
  closeCLBtn?.addEventListener('click', () => closeModal(coverLetterModal));
  
  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });
}

function openModal(modal) {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Load User Data
async function loadUserData() {
  // First, sync subscription status from backend
  try {
    await chrome.runtime.sendMessage({ action: 'syncSubscription' });
    console.log('Subscription synced on dashboard load');
  } catch (e) {
    console.log('Could not sync subscription:', e);
  }
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken', 'user', 'subscription'], (result) => {
      const signInRow = document.getElementById('signInRow');
      const logoutBtn = document.getElementById('logoutBtn');
      const fixAuthBtn = document.getElementById('fixAuthBtn');
      
      // Get parent setting-rows for logout and fix auth
      const logoutRow = logoutBtn?.closest('.setting-row');
      const fixAuthRow = fixAuthBtn?.closest('.setting-row');
      
      if (result.user) {
        currentUser = result.user;
        
        // Update UI
        document.getElementById('userName').textContent = result.user.name || 'User';
        document.getElementById('userAvatar').src = result.user.picture || '';
        document.getElementById('settingsEmail').textContent = result.user.email || 'Not signed in';
        
        // Update subscription status
        const subscription = result.subscription || {};
        const plan = subscription.status === 'active' || subscription.status === 'pro' ? 'Pro Plan' : 'Free Plan';
        document.getElementById('userPlan').textContent = plan;
        document.getElementById('settingsSubscription').textContent = plan;
        
        if (plan === 'Pro Plan') {
          document.getElementById('upgradePlan').textContent = 'Manage Plan';
        }
        
        // User is signed in - hide sign-in row, show logout
        if (signInRow) signInRow.style.display = 'none';
        if (logoutRow) logoutRow.style.display = 'flex';
        if (fixAuthRow) fixAuthRow.style.display = 'flex';
      } else {
        // No user signed in - show sign-in row, hide logout
        document.getElementById('userName').textContent = 'Guest';
        document.getElementById('settingsEmail').textContent = 'Not signed in';
        document.getElementById('userPlan').textContent = 'Sign in for more';
        
        if (signInRow) signInRow.style.display = 'flex';
        if (logoutRow) logoutRow.style.display = 'none';
        if (fixAuthRow) fixAuthRow.style.display = 'none';
      }
      resolve();
    });
  });
}


// Update Stats
function updateStats() {
  // Load scam stats from background service worker (same source as popup)
  chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
    if (!response || !response.stats) {
      console.warn('Could not get stats from service worker');
      return;
    }
    
    const stats = response.stats;
    const jobsScanned = stats.totalJobs || 0;
    const scamsBlocked = stats.scamsCaught || 0;
    const safeJobs = stats.safeJobs || (jobsScanned - scamsBlocked);
    
    console.log('📊 updateStats called with:', { jobsScanned, scamsBlocked, safeJobs });
    
    // Analytics metrics - update only elements that exist
    const totalJobsEl = document.getElementById('totalJobsScanned');
    if (totalJobsEl) totalJobsEl.textContent = jobsScanned;
    
    const scamsBlockedEl = document.getElementById('scamsBlocked');
    if (scamsBlockedEl) scamsBlockedEl.textContent = scamsBlocked;
    
    const safeJobsEl = document.getElementById('safeJobsCount');
    if (safeJobsEl) safeJobsEl.textContent = safeJobs;
    
    // Calculate and display scam detection rate
    const detectionRate = jobsScanned > 0 ? Math.round((scamsBlocked / jobsScanned) * 100) : 0;
    const detectionRateEl = document.getElementById('scamDetectionRate');
    if (detectionRateEl) detectionRateEl.textContent = detectionRate + '%';
    
    console.log('✅ Stats updated:', { 
      jobsScanned, 
      scamsBlocked, 
      safeJobs, 
      detectionRate: detectionRate + '%'
    });
    
    // Update activity chart
    updateActivityChart(stats);
  });
}

// Update weekly activity chart
function updateActivityChart(stats) {
  const activityData = stats.dailyActivity || [0, 0, 0, 0, 0, 0, 0];
  const maxValue = Math.max(...activityData, 1);
  const barHeight = 80;
  const barWidth = 30;
  const spacing = 10;
  
  const barsGroup = document.getElementById('bars');
  const labelsGroup = document.getElementById('labels');
  
  if (!barsGroup || !labelsGroup) return;
  
  barsGroup.innerHTML = '';
  labelsGroup.innerHTML = '';
  
  // Generate day labels with actual dates (7 days back)
  const dayLabels = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dayLabels.unshift(`${month}/${day}`);
  }
  
  activityData.forEach((value, index) => {
    const x = index * (barWidth + spacing) + 15;
    const height = maxValue > 0 ? (value / maxValue) * barHeight : 0;
    const y = 100 - height;
    
    // Create bar
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', height);
    rect.setAttribute('fill', 'var(--color-primary)');
    rect.setAttribute('rx', '3');
    barsGroup.appendChild(rect);
    
    // Create label with date
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x + barWidth / 2);
    text.setAttribute('y', 115);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '10');
    text.setAttribute('fill', 'var(--text-secondary)');
    text.textContent = dayLabels[index];
    labelsGroup.appendChild(text);
  });
}

// Event Listeners
function setupEventListeners() {
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
    document.getElementById('themeSelect').value = newTheme;
  });
  
  // Theme select
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    const theme = e.target.value;
    applyTheme(theme);
    chrome.storage.local.set({ theme });
  });
  
  // Sync button
  const syncBtn = document.getElementById('syncBtn');
  console.log('🔍 Sync button found:', syncBtn);
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      console.log('🔘 Sync button clicked!');
      syncData();
    });
  } else {
    console.error('❌ Sync button not found in DOM');
  }
  
  // Refresh data button
  document.getElementById('refreshDataBtn')?.addEventListener('click', () => {
    console.log('🔄 Refresh button clicked');
    loadScanHistory();
    updateStats();
    showToast('Data refreshed', 'success');
  });
  
  // Export data
  document.getElementById('exportData')?.addEventListener('click', exportData);
  
  // Clear data
  document.getElementById('clearData')?.addEventListener('click', clearAllData);
  
  // AI Tools
  document.getElementById('generateCL')?.addEventListener('click', generateCoverLetter);
  document.getElementById('copyCL')?.addEventListener('click', copyCoverLetter);
  document.getElementById('analyzeResume')?.addEventListener('click', analyzeResume);
  document.getElementById('interviewPrep')?.addEventListener('click', prepareInterview);
  document.getElementById('salaryInsights')?.addEventListener('click', showSalaryInsights);
  
  // Chat
  document.getElementById('sendChat')?.addEventListener('click', sendChatMessage);
  document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  
  // Settings toggles
  document.getElementById('scamAlerts')?.addEventListener('change', (e) => {
    settings.scamAlerts = e.target.checked;
    chrome.storage.local.set({ settings });
  });
  
  document.getElementById('cloudSync')?.addEventListener('change', (e) => {
    settings.cloudSync = e.target.checked;
    chrome.storage.local.set({ settings });
    if (e.target.checked) syncData();
  });
  
  // Logout button
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  
  // Sign In button
  document.getElementById('signInBtn')?.addEventListener('click', handleSignIn);
  
  // Fix Auth button
  document.getElementById('fixAuthBtn')?.addEventListener('click', fixAuthentication);
  
  // Upgrade to Pro button
  document.getElementById('upgradePlan')?.addEventListener('click', startCheckout);
  
  // Scan History filters and search
  document.getElementById('searchScans')?.addEventListener('input', (e) => {
    const filter = document.getElementById('riskFilter')?.value || 'all';
    renderScanHistory(filter, e.target.value);
  });
  
  document.getElementById('riskFilter')?.addEventListener('change', (e) => {
    const search = document.getElementById('searchScans')?.value || '';
    renderScanHistory(e.target.value, search);
  });

  document.getElementById('scanHistoryList')?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('[data-action="delete-scan"]');
    if (!deleteBtn) return;

    const scanId = decodeURIComponent(deleteBtn.dataset.scanId || '');
    deleteScan(scanId);
  });

  document.getElementById('whitelistGrid')?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-action="remove-whitelist"]');
    if (!removeBtn) return;

    const domain = decodeURIComponent(removeBtn.dataset.domain || '');
    removeFromWhitelist(domain);
  });
}

// Handle Sign In
async function handleSignIn() {
  showToast('Opening Google Sign In...', 'info');
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'signInWithGoogle' });
    
    if (response?.success) {
      showToast('Signed in successfully!', 'success');
      // Reload the page to fully refresh state and display user info
      setTimeout(() => window.location.reload(), 800);
    } else {
      showToast('Sign in failed: ' + (response?.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Sign in error:', error);
    showToast('Sign in failed. Please try again.', 'error');
  }
}

// Handle Logout
async function handleLogout() {
  if (!confirm('Are you sure you want to sign out?')) return;
  
  showToast('Signing out...', 'info');
  try {
    const response = await chrome.runtime.sendMessage({ action: 'logout' });
    if (response?.success) {
      showToast('Signed out successfully', 'success');
      // Clear all user data from storage
      await chrome.storage.local.remove(['userData', 'authToken', 'subscriptionData']);
      // Reload the page to reset state and clear all UI
      setTimeout(() => window.location.reload(), 800);
    } else {
      showToast('Logout failed: ' + (response?.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Logout error:', error);
    showToast('Logout failed', 'error');
  }
}

// Fix Authentication - Clear bad tokens and re-authenticate
async function fixAuthentication() {
  showToast('Fixing authentication...', 'info');
  
  try {
    // First, clear any invalid tokens
    await chrome.storage.local.remove(['authToken']);
    console.log('Cleared stored auth token');
    
    // Try to refresh the token
    const refreshResult = await chrome.runtime.sendMessage({ action: 'refreshToken' });
    
    if (refreshResult?.success) {
      showToast('Authentication fixed! AI features should work now.', 'success');
      // Reload user data
      await loadUserData();
    } else {
      // If refresh failed, prompt user to sign in again
      showToast('Please sign out and sign back in to fix authentication.', 'warning');
      
      // Offer to logout
      if (confirm('Would you like to sign out now? You can sign back in after.')) {
        await handleLogout();
      }
    }
  } catch (error) {
    console.error('Fix auth error:', error);
    showToast('Failed to fix authentication. Please try signing out and back in.', 'error');
  }
}

// Start Stripe Checkout
async function startCheckout() {
  showToast('Starting checkout...', 'info');
  
  try {
    // Get auth token (optional for basic checkout)
    const result = await chrome.storage.local.get(['authToken']);
    const token = result.authToken;
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Call backend to create checkout session
    const response = await fetch('http://localhost:3000/api/create-checkout', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        priceId: process.env.STRIPE_PRICE_ID || 'price_1SeNEXRvKQf7z4L6T9GroSYi'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Checkout error:', errorData);
      showToast('Failed to start checkout: ' + (errorData.error || 'Unknown error'), 'error');
      return;
    }
    
    const data = await response.json();
    
    if (data.url) {
      // Open Stripe checkout in new tab
      chrome.tabs.create({ url: data.url });
      showToast('Opening Stripe checkout...', 'success');
    } else {
      showToast('Checkout URL not returned from server', 'error');
      console.error('No checkout URL in response:', data);
    }
  } catch (error) {
    console.error('Checkout error:', error);
    showToast('Failed to start checkout. Make sure backend is running on localhost:3000', 'error');
  }
}

// Sync Data
async function syncData() {
  console.log('====== SYNC DATA CALLED ======');
  
  // First, check auth status
  try {
    const authCheck = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });
    console.log('🔐 Auth Status:', JSON.stringify(authCheck, null, 2));
    
    if (!authCheck.authStatus?.isAuthenticated) {
      console.error('❌ User not authenticated:', JSON.stringify(authCheck, null, 2));
      showToast('Please sign in to sync data', 'error');
      return;
    }
  } catch (e) {
    console.error('❌ Failed to check auth:', e);
    showToast('Authentication check failed', 'error');
    return;
  }
  
  showToast('Syncing data...', 'info');
  
  try {
    console.log('🔄 Starting sync with data:', { 
      scanHistory: scanHistory.length
    });
    
    const response = await chrome.runtime.sendMessage({ 
      action: 'syncToCloud', 
      scanHistory  // Include scan history in sync
    });
    
    console.log('📥 Sync response:', JSON.stringify(response, null, 2));
    
    if (response?.success) {
      // Save synced data from cloud to local storage
      if (response.data) {
        console.log('💾 Saving cloud data to local storage:', {
          scanHistory: response.data.scanHistory?.length || 0
        });
        
        // Update local data with cloud data
        if (response.data.scanHistory) {
          scanHistory = response.data.scanHistory;
          await chrome.storage.local.set({ recentScans: response.data.scanHistory });
        }
        
        // Reload UI with cloud data
        await loadScanHistory();
        updateStats();
      }
      
      showToast('Data synced successfully!', 'success');
    } else if (response?.error === 'not_authenticated') {
      console.error('❌ Not authenticated:', JSON.stringify(response, null, 2));
      showToast('Please sign in to sync data', 'error');
    } else if (response?.error === 'session_expired') {
      console.warn('⚠️ Session expired:', JSON.stringify(response, null, 2));
      showToast('Session expired. Attempting to refresh...', 'warning');
      // Try to re-authenticate silently
      const refreshResult = await chrome.runtime.sendMessage({ action: 'refreshToken' });
      if (refreshResult?.success) {
        showToast('Session refreshed! Please try syncing again.', 'success');
      } else {
        showToast('Please sign out and sign back in to continue.', 'error');
      }
    } else {
      console.error('❌ Sync failed:', JSON.stringify(response, null, 2));
      showToast(`Sync failed: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('💥 Sync error:', error);
    showToast('Sync failed. Please try again.', 'error');
  }
}

// Export Data
function exportData() {
  const data = {
    exportDate: new Date().toISOString(),
    version: '3.0.0'
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `applysafe-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast('Data exported successfully!', 'success');
}

// Clear All Data
function clearAllData() {
  if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
    chrome.storage.local.remove(['stats']);
    updateStats();
    showToast('All data cleared', 'success');
  }
}

// AI Features
async function generateCoverLetter() {
  const jobDescription = document.getElementById('clJobDescription').value;
  const skills = document.getElementById('clSkills').value;
  const tone = document.getElementById('clTone').value;
  
  if (!jobDescription) {
    showToast('Please enter a job description', 'error');
    return;
  }
  
  const output = document.getElementById('clOutput');
  output.innerHTML = '<p class="placeholder-text">Generating cover letter...</p>';
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateCoverLetter',
      jobTitle: 'Position', // Extract from job description or let AI figure it out
      company: 'Company',
      jobDescription,
      userSkills: skills
    });
    
    if (response?.success && response?.coverLetter) {
      output.innerHTML = `<p>${response.coverLetter.replace(/\n/g, '</p><p>')}</p>`;
      document.getElementById('copyCL').disabled = false;
      document.getElementById('regenerateCL').disabled = false;
    } else if (response?.error === 'not_authenticated') {
      output.innerHTML = '<p class="placeholder-text">Please sign in to use AI features</p>';
      showToast('Please sign in to use AI features', 'error');
    } else {
      output.innerHTML = '<p class="placeholder-text">Failed to generate. Please try again.</p>';
    }
  } catch (error) {
    console.error('Cover letter error:', error);
    output.innerHTML = '<p class="placeholder-text">Error generating cover letter. Please try again.</p>';
  }
}

function copyCoverLetter() {
  const output = document.getElementById('clOutput');
  const text = output.innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Cover letter copied to clipboard!', 'success');
  });
}

async function analyzeResume() {
  // TODO: Add resume input modal
  const resumeText = prompt('Paste your resume text:');
  const jobDescription = prompt('Paste the job description:');
  
  if (!resumeText || !jobDescription) {
    showToast('Please provide both resume and job description', 'error');
    return;
  }
  
  showToast('Analyzing resume...', 'info');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeResume',
      resumeText,
      jobDescription
    });
    
    if (response?.success) {
      alert(`Resume Match Score: ${response.analysis.score}%\n\nMatching Skills: ${response.analysis.matchingSkills?.join(', ')}\n\nMissing Skills: ${response.analysis.missingSkills?.join(', ')}\n\nRecommendations: ${response.analysis.recommendations}`);
    } else if (response?.error === 'not_authenticated') {
      showToast('Please sign in to use AI features', 'error');
    } else {
      showToast('Failed to analyze resume', 'error');
    }
  } catch (error) {
    console.error('Resume analysis error:', error);
    showToast('Error analyzing resume', 'error');
  }
}

async function prepareInterview() {
  const jobTitle = prompt('Enter job title:');
  const company = prompt('Enter company name:');
  
  if (!jobTitle) {
    showToast('Please enter a job title', 'error');
    return;
  }
  
  showToast('Preparing interview tips...', 'info');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getInterviewPrep',
      jobTitle,
      company: company || 'a company',
      industry: 'tech'
    });
    
    if (response?.success) {
      const prep = response.prep;
      alert(`Interview Prep for ${jobTitle} at ${company || 'company'}\n\nCommon Questions:\n${prep.questions?.join('\n- ')}\n\nTips:\n${prep.tips?.join('\n- ')}\n\nResearch Points:\n${prep.research?.join('\n- ')}`);
    } else if (response?.error === 'not_authenticated') {
      showToast('Please sign in to use AI features', 'error');
    } else {
      showToast('Failed to get interview prep', 'error');
    }
  } catch (error) {
    console.error('Interview prep error:', error);
    showToast('Error getting interview prep', 'error');
  }
}

async function showSalaryInsights() {
  const jobTitle = prompt('Enter job title for salary insights:');
  const location = prompt('Enter location (e.g., San Francisco, CA):');
  
  if (!jobTitle) {
    showToast('Please enter a job title', 'error');
    return;
  }
  
  showToast('Fetching salary insights...', 'info');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'chatWithAI',
      message: `What is the typical salary range for a ${jobTitle} position${location ? ' in ' + location : ''}? Include base salary, bonus, and equity if applicable. Format: provide low, median, and high ranges.`,
      context: { type: 'salary_insights' }
    });
    
    if (response?.success) {
      alert(`Salary Insights for ${jobTitle}${location ? ' in ' + location : ''}\n\n${response.reply}`);
    } else if (response?.error === 'not_authenticated') {
      showToast('Please sign in to use AI features', 'error');
    } else {
      showToast('Failed to get salary insights', 'error');
    }
  } catch (error) {
    console.error('Salary insights error:', error);
    showToast('Error getting salary insights', 'error');
  }
}

// Chat
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  const messagesContainer = document.getElementById('chatMessages');
  
  // Add user message
  messagesContainer.innerHTML += `<div class="message user"><p>${escapeHtml(message)}</p></div>`;
  input.value = '';
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Add typing indicator
  messagesContainer.innerHTML += `<div class="message assistant typing"><p>Thinking...</p></div>`;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'chatWithAI',
      message,
      context: {}
    });
    
    // Remove typing indicator
    const typingIndicator = messagesContainer.querySelector('.typing');
    if (typingIndicator) typingIndicator.remove();
    
    if (response?.success && response?.reply) {
      messagesContainer.innerHTML += `<div class="message assistant"><p>${escapeHtml(response.reply)}</p></div>`;
    } else if (response?.error === 'not_authenticated') {
      messagesContainer.innerHTML += `<div class="message assistant"><p>Please sign in to chat with AI assistant.</p></div>`;
    } else if (response?.error === 'session_expired') {
      // Try to refresh the token automatically
      messagesContainer.innerHTML += `<div class="message assistant"><p>Session expired. Attempting to refresh your session...</p></div>`;
      
      try {
        const refreshResult = await chrome.runtime.sendMessage({ action: 'refreshToken' });
        if (refreshResult?.success) {
          messagesContainer.innerHTML += `<div class="message assistant"><p>Session refreshed! Please send your message again.</p></div>`;
        } else {
          messagesContainer.innerHTML += `<div class="message assistant"><p>Could not refresh session. Please click "Logout" in the sidebar and sign in again.</p></div>`;
        }
      } catch (e) {
        messagesContainer.innerHTML += `<div class="message assistant"><p>Please sign out and sign back in to continue using AI features.</p></div>`;
      }
    } else {
      console.error('AI Chat error:', response);
      messagesContainer.innerHTML += `<div class="message assistant"><p>I'm sorry, I couldn't process that. Error: ${response?.error || 'Unknown error'}. Please try signing out and back in.</p></div>`;
    }
  } catch (error) {
    // Remove typing indicator
    const typingIndicator = messagesContainer.querySelector('.typing');
    if (typingIndicator) typingIndicator.remove();
    
    messagesContainer.innerHTML += `<div class="message assistant"><p>Something went wrong. Please try again later.</p></div>`;
  }
  
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Utility Functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function capitalizeFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.querySelector('.toast-message').textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
// ============================================
// SCAN HISTORY FUNCTIONS
// ============================================

let scanHistory = [];

async function loadScanHistory() {
  return new Promise((resolve) => {
    // Read from recentScans (where popup.js saves scans)
    chrome.storage.local.get(['recentScans'], (result) => {
      scanHistory = result.recentScans || [];
      console.log('� loadScanHistory completed:', {
        count: scanHistory.length,
        items: scanHistory.slice(0, 3),  // Show first 3 items
        storageKey: 'recentScans'
      });
      renderScanHistory();
      resolve();
    });
  });
}

function renderScanHistory(filter = 'all', search = '') {
  const list = document.getElementById('scanHistoryList');
  if (!list) {
    console.error('❌ scanHistoryList element not found');
    return;
  }
  
  console.log('📋 renderScanHistory: filter="%s", search="%s", scanHistory.length=%d', filter, search, scanHistory.length);
  
  let filtered = [...scanHistory];
  
  // Apply filter
  if (filter !== 'all') {
    filtered = filtered.filter(scan => {
      const score = scan.riskScore || 0;
      if (filter === 'safe') return score <= 30;
      if (filter === 'caution') return score > 30 && score <= 60;  // Match HTML value
      if (filter === 'danger') return score > 60;
      return true;
    });
  }
  
  // Apply search
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(scan => 
      (scan.jobTitle || scan.title || '').toLowerCase().includes(searchLower) ||
      (scan.company || '').toLowerCase().includes(searchLower) ||
      (scan.url || '').toLowerCase().includes(searchLower)
    );
  }
  
  // Sort by date (newest first)
  filtered.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <p>${search || filter !== 'all' ? 'No matching scans found' : 'No scan history yet'}</p>
        <span>Analyzed job postings will appear here</span>
      </div>
    `;
    return;
  }
  
  list.innerHTML = filtered.map((scan, index) => {
    const score = scan.riskScore || 0;
    let riskClass = 'safe';
    let riskLabel = 'Safe';
    if (score > 60) {
      riskClass = 'danger';
      riskLabel = 'High Risk';
    } else if (score > 30) {
      riskClass = 'warning';
      riskLabel = 'Caution';
    }
    
    // Use jobTitle (from popup.js) or title as fallback
    const title = scan.jobTitle || scan.title || 'Unknown Job';
    const scanId = scan.id || scan.url || index;
    const encodedScanId = encodeURIComponent(String(scanId));
    
    return `
      <div class="scan-item" data-id="${scanId}">
        <div class="scan-info">
          <div class="scan-title">${escapeHtml(title)}</div>
          <div class="scan-company">${escapeHtml(scan.company || 'Unknown Company')}</div>
          <div class="scan-date">${formatDate(scan.timestamp)}</div>
        </div>
        <div class="scan-risk ${riskClass}">
          <span class="risk-score">${score}</span>
          <span class="risk-label">${riskLabel}</span>
        </div>
        <div class="scan-actions">
          ${scan.url ? `<a href="${escapeHtml(scan.url)}" target="_blank" class="btn btn-secondary btn-sm">View</a>` : ''}
          <button class="btn btn-secondary btn-sm" data-action="delete-scan" data-scan-id="${encodedScanId}">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function deleteScan(scanId) {
  if (!scanId) return;
  
  // Filter by id or url (since we use url as fallback id)
  scanHistory = scanHistory.filter(scan => {
    const id = scan.id || scan.url;
    return id !== scanId;
  });
  // Save to recentScans (where popup.js reads from)
  chrome.storage.local.set({ recentScans: scanHistory }, () => {
    renderScanHistory();
    showToast('Scan deleted', 'success');
  });
}

function clearScanHistory() {
  if (confirm('Are you sure you want to clear all scan history? This cannot be undone.')) {
    scanHistory = [];
    // Save to recentScans (where popup.js reads from)
    chrome.storage.local.set({ recentScans: scanHistory }, () => {
      renderScanHistory();
      showToast('Scan history cleared', 'success');
    });
  }
}

// Setup scan history event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Search
  const searchInput = document.getElementById('scanHistorySearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const filter = document.getElementById('scanHistoryFilter')?.value || 'all';
      renderScanHistory(filter, e.target.value);
    });
  }
  
  // Filter
  const filterSelect = document.getElementById('scanHistoryFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      const search = document.getElementById('scanHistorySearch')?.value || '';
      renderScanHistory(e.target.value, search);
    });
  }
  
  // Clear history button
  const clearBtn = document.getElementById('clearScanHistory');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearScanHistory);
  }
});

// ============================================
// WHITELIST FUNCTIONS
// ============================================

let whitelist = [];

async function loadWhitelist() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['whitelist'], (result) => {
      whitelist = result.whitelist || [];
      renderWhitelist();
      resolve();
    });
  });
}

function renderWhitelist() {
  const list = document.getElementById('whitelistGrid');
  if (!list) return;
  
  if (whitelist.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p>No whitelisted companies yet</p>
        <span>Add trusted companies to skip safety warnings</span>
      </div>
    `;
    return;
  }
  
  list.innerHTML = whitelist.map(item => `
    <div class="whitelist-item" data-domain="${escapeHtml(item.domain || item)}">
      <div class="whitelist-info">
        <div class="whitelist-domain">${escapeHtml(item.domain || item)}</div>
        ${item.addedAt ? `<div class="whitelist-date">Added ${formatDate(item.addedAt)}</div>` : ''}
      </div>
      <button class="btn btn-secondary btn-sm" data-action="remove-whitelist" data-domain="${encodeURIComponent(String(item.domain || item))}">Remove</button>
    </div>
  `).join('');
}

function addToWhitelist() {
  const input = document.getElementById('whitelistInput');
  if (!input) return;
  
  const domain = input.value.trim().toLowerCase();
  if (!domain) {
    showToast('Please enter a domain', 'error');
    return;
  }
  
  // Validate domain format
  if (!domain.includes('.') || domain.includes(' ')) {
    showToast('Please enter a valid domain (e.g., google.com)', 'error');
    return;
  }
  
  // Check if already exists
  const exists = whitelist.some(item => (item.domain || item) === domain);
  if (exists) {
    showToast('This domain is already whitelisted', 'error');
    return;
  }
  
  whitelist.push({
    domain: domain,
    addedAt: new Date().toISOString()
  });
  
  chrome.storage.local.set({ whitelist }, () => {
    renderWhitelist();
    input.value = '';
    showToast('Company added to whitelist', 'success');
  });
}

function removeFromWhitelist(domain) {
  whitelist = whitelist.filter(item => (item.domain || item) !== domain);
  chrome.storage.local.set({ whitelist }, () => {
    renderWhitelist();
    showToast('Removed from whitelist', 'success');
  });
}

// Setup whitelist event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Add button
  const addBtn = document.getElementById('addWhitelistBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addToWhitelist);
  }
  
  // Enter key to add
  const input = document.getElementById('whitelistInput');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addToWhitelist();
      }
    });
  }
});

// ============ DEBUG UTILITIES ============
// Define debug functions on window object for debug console
window.debugLog = function(msg) {
  try {
    const output = document.getElementById('debugOutput');
    if (!output) return;
    const line = document.createElement('div');
    line.style.color = '#0f0';
    line.style.marginBottom = '2px';
    line.style.wordBreak = 'break-word';
    line.style.whiteSpace = 'pre-wrap';
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
    console.log('[DEBUG]', msg);
  } catch(e) {
    console.error('debugLog error:', e);
  }
};

window.debugCheckStorage = async function() {
  window.debugLog('Checking chrome.storage.local...');
  try {
    const data = await chrome.storage.local.get(['recentScans', 'stats']);
    const scans = data.recentScans || [];
    const stats = data.stats || {};
    window.debugLog(`✓ Storage accessible`);
    window.debugLog(`Scans found: ${scans.length}`);
    window.debugLog(`Jobs scanned stat: ${stats.jobsScanned || 0}`);
    if (scans.length > 0) {
      scans.slice(0, 3).forEach((s, i) => {
        window.debugLog(`  [${i}] ${s.jobTitle} at ${s.company || 'unknown'}`);
      });
    } else {
      window.debugLog('WARNING: recentScans is EMPTY!');
    }
  } catch(e) {
    window.debugLog(`ERROR: ${e.message}`);
  }
};

window.debugCreateTestScan = async function() {
  window.debugLog('Creating test scan...');
  try {
    const data = await chrome.storage.local.get(['recentScans']);
    let scans = data.recentScans || [];
    scans.unshift({
      jobTitle: 'TEST SCAN - QA Engineer',
      company: 'AppleSafe Test Corp',
      riskScore: 15,
      timestamp: Date.now(),
      url: 'https://test-applysafe.example.com'
    });
    await chrome.storage.local.set({ recentScans: scans });
    window.debugLog(`✓ Test scan created!`);
    window.debugLog(`Total scans in storage: ${scans.length}`);
    window.debugLog('Check dashboard to see if it appears in recent scans');
  } catch(e) {
    window.debugLog(`ERROR: ${e.message}`);
  }
};

window.debugClearOutput = function() {
  const output = document.getElementById('debugOutput');
  if (output) output.innerHTML = '';
};

// Set up debug console event listeners
function setupDebugListeners() {
  const toggle = document.getElementById('debugToggle');
  const console_el = document.getElementById('debugConsole');
  const checkBtn = document.getElementById('checkStorageBtn');
  const testBtn = document.getElementById('testScanBtn');
  const clearBtn = document.getElementById('clearDebugBtn');

  if (!toggle) {
    console.error('debugToggle button not found');
    return;
  }

  toggle.addEventListener('click', () => {
    if (console_el.style.display === 'none') {
      console_el.style.display = 'block';
      window.debugLog('Debug console opened');
    } else {
      console_el.style.display = 'none';
    }
  });

  if (checkBtn) checkBtn.addEventListener('click', window.debugCheckStorage);
  if (testBtn) testBtn.addEventListener('click', window.debugCreateTestScan);
  if (clearBtn) clearBtn.addEventListener('click', window.debugClearOutput);
}

// Initialize debug listeners when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupDebugListeners);
} else {
  setupDebugListeners();
}
