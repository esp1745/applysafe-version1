/**
 * ApplySafe - Minimal Popup Script
 */

// DOM Elements
const elements = {
  // User
  signedInUser: document.getElementById('signedInUser'),
  anonymousUser: document.getElementById('anonymousUser'),
  googleSignInBtn: document.getElementById('googleSignInBtn'),
  signOutBtn: document.getElementById('signOutBtn'),
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  
  // States
  loadingState: document.getElementById('loadingState'),
  noJobState: document.getElementById('noJobState'),
  riskCard: document.getElementById('riskCard'),
  
  // Risk Display
  riskCircle: document.getElementById('riskCircle'),
  riskScore: document.getElementById('riskScore'),
  riskLabel: document.getElementById('riskLabel'),
  jobTitle: document.getElementById('jobTitle'),
  companyName: document.getElementById('companyName'),
  h1bBadge: document.getElementById('h1bBadge'),
  h1bText: document.getElementById('h1bText'),
  
  // Buttons
  refreshBtn: document.getElementById('refreshBtn'),
  dashboardBtn: document.getElementById('dashboardBtn'),
  toggleTheme: document.getElementById('toggleTheme'),
  openDashboard: document.getElementById('openDashboard'),
  
  // Toast
  toast: document.getElementById('toast')
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ApplySafe Minimal Popup loading...');
  await loadTheme();
  await loadAuthStatus();
  await analyzeCurrentPage();
  setupEventListeners();
});

// Theme
async function loadTheme() {
  const { theme } = await chrome.storage.local.get(['theme']);
  if (theme === 'dark') {
    document.body.classList.add('dark');
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
}

// Auth
async function loadAuthStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });
    if (response?.authStatus?.isAuthenticated && response.authStatus.user) {
      const { user } = response.authStatus;
      elements.anonymousUser.style.display = 'none';
      elements.signedInUser.style.display = 'block';
      elements.userName.textContent = user.name;
      elements.userEmail.textContent = user.email;
      elements.userAvatar.src = user.picture || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236b7280"><circle cx="12" cy="8" r="4"/><path d="M12 14c-6 0-9 3-9 6v2h18v-2c0-3-3-6-9-6z"/></svg>';
    } else {
      elements.anonymousUser.style.display = 'block';
      elements.signedInUser.style.display = 'none';
    }
  } catch (error) {
    console.error('Auth error:', error);
    elements.anonymousUser.style.display = 'block';
    elements.signedInUser.style.display = 'none';
  }
}

async function handleSignIn() {
  try {
    elements.googleSignInBtn.disabled = true;
    elements.googleSignInBtn.textContent = 'Signing in...';
    
    const response = await chrome.runtime.sendMessage({ action: 'signInWithGoogle' });
    
    if (response?.success) {
      await loadAuthStatus();
      showToast('Signed in successfully!', 'success');
    } else {
      showToast(response?.error || 'Sign in failed', 'error');
    }
  } catch (error) {
    showToast('Sign in failed', 'error');
  } finally {
    elements.googleSignInBtn.disabled = false;
    elements.googleSignInBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Sign in with Google
    `;
  }
}

async function handleSignOut() {
  try {
    await chrome.runtime.sendMessage({ action: 'signOut' });
    await loadAuthStatus();
    showToast('Signed out', 'success');
  } catch (error) {
    showToast('Sign out failed', 'error');
  }
}

// Analysis
async function analyzeCurrentPage() {
  showLoading();
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      showNoJob();
      return;
    }

    // Check if it's a job site
    const jobSites = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com', 'monster.com', 'greenhouse.io', 'lever.co', 'workday.com', 'jobs', 'careers', 'apply'];
    const isJobSite = jobSites.some(site => tab.url.toLowerCase().includes(site));
    
    if (!isJobSite) {
      showNoJob();
      return;
    }

    // Get cached analysis or request new one
    const { analysisCache } = await chrome.storage.local.get(['analysisCache']);
    const cached = analysisCache?.[tab.url];
    
    if (cached && Date.now() - cached.timestamp < 3600000) {
      displayAnalysis(cached);
      return;
    }

    // Request analysis from content script
    try {
      const jobData = await chrome.tabs.sendMessage(tab.id, { action: 'getJobData' });
      if (jobData) {
        const response = await chrome.runtime.sendMessage({ 
          action: 'analyzeJob', 
          jobData, 
          url: tab.url 
        });
        
        if (response?.analysis) {
          displayAnalysis(response.analysis);
        } else {
          showNoJob();
        }
      } else {
        showNoJob();
      }
    } catch {
      showNoJob();
    }
  } catch (error) {
    console.error('Analysis error:', error);
    showNoJob();
  }
}

function displayAnalysis(analysis) {
  hideAllStates();
  elements.riskCard.style.display = 'block';
  
  const score = analysis.riskScore || 0;
  elements.riskScore.textContent = score;
  elements.riskCircle.style.setProperty('--score', score);
  
  // Update risk class
  elements.riskCircle.classList.remove('risk-safe', 'risk-medium', 'risk-high');
  if (score <= 30) {
    elements.riskCircle.classList.add('risk-safe');
    elements.riskLabel.textContent = 'Looks Safe ✓';
  } else if (score <= 60) {
    elements.riskCircle.classList.add('risk-medium');
    elements.riskLabel.textContent = 'Use Caution ⚠️';
  } else {
    elements.riskCircle.classList.add('risk-high');
    elements.riskLabel.textContent = 'High Risk ⚠️';
  }
  
  elements.jobTitle.textContent = analysis.jobTitle || 'Unknown Position';
  elements.companyName.textContent = analysis.company || 'Unknown Company';
  
  // H1B Badge
  if (analysis.h1bData?.sponsored) {
    elements.h1bBadge.classList.remove('not-found');
    elements.h1bText.textContent = 'Verified H-1B Sponsor';
  } else {
    elements.h1bBadge.classList.add('not-found');
    elements.h1bText.textContent = 'H-1B Status Unknown';
  }
}

function showLoading() {
  hideAllStates();
  elements.loadingState.style.display = 'block';
}

function showNoJob() {
  hideAllStates();
  elements.noJobState.style.display = 'block';
}

function hideAllStates() {
  elements.loadingState.style.display = 'none';
  elements.noJobState.style.display = 'none';
  elements.riskCard.style.display = 'none';
}

// Event Listeners
function setupEventListeners() {
  elements.googleSignInBtn.addEventListener('click', handleSignIn);
  elements.signOutBtn.addEventListener('click', handleSignOut);
  elements.toggleTheme.addEventListener('click', toggleTheme);
  elements.refreshBtn.addEventListener('click', analyzeCurrentPage);
  
  elements.openDashboard.addEventListener('click', openDashboard);
  elements.dashboardBtn.addEventListener('click', openDashboard);
}

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
}

// Toast
function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.className = `toast show ${type}`;
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}
