/**
 * ApplySafe - Options Page Script
 * Dashboard functionality and settings management
 */

// DOM Elements
const elements = {
  // Navigation
  navItems: document.querySelectorAll('.nav-item'),
  sections: document.querySelectorAll('.section'),
  
  // Dashboard Stats
  totalScans: document.getElementById('totalScans'),
  scamsCaught: document.getElementById('scamsCaught'),
  reportsCount: document.getElementById('reportsCount'),
  safetyRate: document.getElementById('safetyRate'),
  
  // Risk Distribution
  safeCount: document.getElementById('safeCount'),
  cautionCount: document.getElementById('cautionCount'),
  dangerCount: document.getElementById('dangerCount'),
  safeBar: document.getElementById('safeBar'),
  cautionBar: document.getElementById('cautionBar'),
  dangerBar: document.getElementById('dangerBar'),
  
  // Lists
  recentActivity: document.getElementById('recentActivity'),
  historyList: document.getElementById('historyList'),
  reportsList: document.getElementById('reportsList'),
  whitelistList: document.getElementById('whitelistList'),
  
  // History Controls
  historySearch: document.getElementById('historySearch'),
  historyFilter: document.getElementById('historyFilter'),
  clearHistory: document.getElementById('clearHistory'),
  
  // Whitelist
  whitelistInput: document.getElementById('whitelistInput'),
  addWhitelist: document.getElementById('addWhitelist'),
  
  // Settings
  apiKey: document.getElementById('apiKey'),
  toggleApiKey: document.getElementById('toggleApiKey'),
  saveApiKey: document.getElementById('saveApiKey'),
  autoAnalyze: document.getElementById('autoAnalyze'),
  showBadges: document.getElementById('showBadges'),
  notifyHighRisk: document.getElementById('notifyHighRisk'),
  exportData: document.getElementById('exportData'),
  clearAllData: document.getElementById('clearAllData'),
  
  // Toast & Modal
  toast: document.getElementById('toast'),
  confirmModal: document.getElementById('confirmModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  modalCancel: document.getElementById('modalCancel'),
  modalConfirm: document.getElementById('modalConfirm')
};

// State
let allScans = [];
let confirmCallback = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllData();
  setupEventListeners();
  handleHashNavigation();
});

// Setup event listeners
function setupEventListeners() {
  // Navigation
  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      navigateToSection(section);
    });
  });
  
  // Also handle links with data-section
  document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToSection(link.dataset.section);
    });
  });
  
  // History controls
  elements.historySearch.addEventListener('input', filterHistory);
  elements.historyFilter.addEventListener('change', filterHistory);
  elements.clearHistory.addEventListener('click', () => {
    showConfirmModal(
      'Clear History',
      'Are you sure you want to clear all scan history? This cannot be undone.',
      clearAllHistory
    );
  });
  
  // Whitelist
  elements.addWhitelist.addEventListener('click', addToWhitelist);
  elements.whitelistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addToWhitelist();
  });
  
  // Settings
  elements.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
  elements.saveApiKey.addEventListener('click', saveApiKey);
  elements.autoAnalyze.addEventListener('change', saveSettings);
  elements.showBadges.addEventListener('change', saveSettings);
  elements.notifyHighRisk.addEventListener('change', saveSettings);
  elements.exportData.addEventListener('click', exportAllData);
  elements.clearAllData.addEventListener('click', () => {
    showConfirmModal(
      'Clear All Data',
      'This will permanently delete all your scan history, reports, whitelist, and settings. Are you sure?',
      clearAllData
    );
  });
  
  // Modal
  elements.modalCancel.addEventListener('click', hideConfirmModal);
  elements.modalConfirm.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    hideConfirmModal();
  });
  
  // Hash change
  window.addEventListener('hashchange', handleHashNavigation);
}

// Navigation
function navigateToSection(sectionId) {
  // Update nav items
  elements.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });
  
  // Update sections
  elements.sections.forEach(section => {
    section.classList.toggle('active', section.id === sectionId);
  });
  
  // Update hash
  window.location.hash = sectionId;
}

function handleHashNavigation() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  navigateToSection(hash);
}

// Load all data
async function loadAllData() {
  try {
    const result = await chrome.storage.local.get([
      'stats',
      'recentScans',
      'reports',
      'whitelist',
      'settings'
    ]);
    
    // Load stats
    const stats = result.stats || { scamsBlocked: 0, jobsScanned: 0, reportsSubmitted: 0 };
    elements.totalScans.textContent = stats.jobsScanned || 0;
    elements.scamsCaught.textContent = stats.scamsBlocked || 0;
    elements.reportsCount.textContent = stats.reportsSubmitted || 0;
    
    if (stats.jobsScanned > 0) {
      const safetyRate = Math.round(((stats.jobsScanned - stats.scamsBlocked) / stats.jobsScanned) * 100);
      elements.safetyRate.textContent = `${safetyRate}%`;
    }
    
    // Load scans
    allScans = result.recentScans || [];
    updateRiskDistribution();
    renderRecentActivity();
    renderHistoryList();
    
    // Load reports
    renderReportsList(result.reports || []);
    
    // Load whitelist
    renderWhitelistList(result.whitelist || []);
    
    // Load settings
    const settings = result.settings || {};
    elements.apiKey.value = settings.apiKey || '';
    elements.autoAnalyze.checked = settings.autoAnalyze !== false;
    elements.showBadges.checked = settings.showBadges !== false;
    elements.notifyHighRisk.checked = settings.notifyHighRisk !== false;
    
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('Failed to load data', 'error');
  }
}

// Risk distribution
function updateRiskDistribution() {
  const safe = allScans.filter(s => s.riskScore <= 30).length;
  const caution = allScans.filter(s => s.riskScore > 30 && s.riskScore <= 60).length;
  const danger = allScans.filter(s => s.riskScore > 60).length;
  const total = allScans.length || 1;
  
  elements.safeCount.textContent = safe;
  elements.cautionCount.textContent = caution;
  elements.dangerCount.textContent = danger;
  
  elements.safeBar.style.width = `${(safe / total) * 100}%`;
  elements.cautionBar.style.width = `${(caution / total) * 100}%`;
  elements.dangerBar.style.width = `${(danger / total) * 100}%`;
}

// Recent activity
function renderRecentActivity() {
  if (allScans.length === 0) {
    elements.recentActivity.innerHTML = '<div class="empty-state"><p>No recent activity</p></div>';
    return;
  }
  
  const recent = allScans.slice(0, 5);
  elements.recentActivity.innerHTML = recent.map(scan => {
    const riskClass = getRiskClass(scan.riskScore);
    return `
      <div class="activity-item">
        <div class="activity-badge ${riskClass}">${scan.riskScore}</div>
        <div class="activity-info">
          <div class="activity-title">${escapeHtml(scan.jobTitle || 'Unknown Job')}</div>
          <div class="activity-company">${escapeHtml(scan.company || 'Unknown Company')}</div>
        </div>
        <div class="activity-time">${getTimeAgo(scan.timestamp)}</div>
      </div>
    `;
  }).join('');
}

// History list
function renderHistoryList(scans = null) {
  const filteredScans = scans || filterScans();
  
  if (filteredScans.length === 0) {
    elements.historyList.innerHTML = '<div class="empty-state"><p>No scan history found</p></div>';
    return;
  }
  
  elements.historyList.innerHTML = filteredScans.map(scan => {
    const riskClass = getRiskClass(scan.riskScore);
    return `
      <div class="history-item" data-url="${escapeHtml(scan.url || '')}">
        <div class="activity-badge ${riskClass}">${scan.riskScore}</div>
        <div class="activity-info" style="flex: 1; min-width: 0;">
          <div class="activity-title">${escapeHtml(scan.jobTitle || 'Unknown Job')}</div>
          <div class="activity-company">${escapeHtml(scan.company || 'Unknown Company')}</div>
        </div>
        <div style="text-align: right;">
          <div class="activity-time">${getTimeAgo(scan.timestamp)}</div>
          ${scan.url ? `<a href="${escapeHtml(scan.url)}" target="_blank" class="link" style="font-size: 0.75rem;">View</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterHistory() {
  const searchTerm = elements.historySearch.value.toLowerCase();
  const filterValue = elements.historyFilter.value;
  
  const filtered = filterScans(searchTerm, filterValue);
  renderHistoryList(filtered);
}

function filterScans(searchTerm = '', filterValue = 'all') {
  return allScans.filter(scan => {
    // Search filter
    if (searchTerm) {
      const matchesSearch = 
        (scan.jobTitle || '').toLowerCase().includes(searchTerm) ||
        (scan.company || '').toLowerCase().includes(searchTerm);
      if (!matchesSearch) return false;
    }
    
    // Risk filter
    if (filterValue !== 'all') {
      const riskClass = getRiskClass(scan.riskScore);
      if (riskClass !== filterValue) return false;
    }
    
    return true;
  });
}

async function clearAllHistory() {
  try {
    await chrome.storage.local.set({
      recentScans: [],
      stats: { scamsBlocked: 0, jobsScanned: 0, reportsSubmitted: 0 }
    });
    allScans = [];
    await loadAllData();
    showToast('History cleared', 'success');
  } catch (error) {
    showToast('Failed to clear history', 'error');
  }
}

// Reports
function renderReportsList(reports) {
  if (reports.length === 0) {
    elements.reportsList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
        <p>No reports submitted yet</p>
        <span>When you report a suspicious job, it helps protect other job seekers</span>
      </div>
    `;
    return;
  }
  
  elements.reportsList.innerHTML = reports.map(report => `
    <div class="history-item">
      <div class="activity-badge danger">!</div>
      <div class="activity-info" style="flex: 1;">
        <div class="activity-title">${escapeHtml(report.analysis?.jobTitle || 'Reported Scam')}</div>
        <div class="activity-company">${escapeHtml(report.analysis?.company || 'Unknown')}</div>
      </div>
      <div class="activity-time">${getTimeAgo(report.timestamp)}</div>
    </div>
  `).join('');
}

// Whitelist
function renderWhitelistList(whitelist) {
  if (whitelist.length === 0) {
    elements.whitelistList.innerHTML = '<div class="empty-state"><p>No whitelisted companies yet</p></div>';
    return;
  }
  
  elements.whitelistList.innerHTML = whitelist.map(domain => `
    <div class="whitelist-item" data-domain="${escapeHtml(domain)}">
      <span>${escapeHtml(domain)}</span>
      <button onclick="removeFromWhitelist('${escapeHtml(domain)}')" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `).join('');
}

async function addToWhitelist() {
  const domain = elements.whitelistInput.value.trim().toLowerCase();
  
  if (!domain) {
    showToast('Please enter a domain', 'error');
    return;
  }
  
  // Validate domain format
  if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(domain)) {
    showToast('Please enter a valid domain', 'error');
    return;
  }
  
  try {
    const result = await chrome.storage.local.get(['whitelist']);
    const whitelist = result.whitelist || [];
    
    if (whitelist.includes(domain)) {
      showToast('Domain already in whitelist', 'error');
      return;
    }
    
    whitelist.push(domain);
    await chrome.storage.local.set({ whitelist });
    
    elements.whitelistInput.value = '';
    renderWhitelistList(whitelist);
    showToast('Added to whitelist', 'success');
  } catch (error) {
    showToast('Failed to add to whitelist', 'error');
  }
}

// Global function for whitelist removal
window.removeFromWhitelist = async function(domain) {
  try {
    const result = await chrome.storage.local.get(['whitelist']);
    const whitelist = (result.whitelist || []).filter(d => d !== domain);
    await chrome.storage.local.set({ whitelist });
    renderWhitelistList(whitelist);
    showToast('Removed from whitelist', 'success');
  } catch (error) {
    showToast('Failed to remove from whitelist', 'error');
  }
};

// Settings
function toggleApiKeyVisibility() {
  const input = elements.apiKey;
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function saveApiKey() {
  try {
    const apiKey = elements.apiKey.value.trim();
    
    await chrome.runtime.sendMessage({
      action: 'setApiKey',
      apiKey: apiKey
    });
    
    showToast('API key saved', 'success');
  } catch (error) {
    showToast('Failed to save API key', 'error');
  }
}

async function saveSettings() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || {};
    
    settings.autoAnalyze = elements.autoAnalyze.checked;
    settings.showBadges = elements.showBadges.checked;
    settings.notifyHighRisk = elements.notifyHighRisk.checked;
    
    await chrome.storage.local.set({ settings });
    showToast('Settings saved', 'success');
  } catch (error) {
    showToast('Failed to save settings', 'error');
  }
}

async function exportAllData() {
  try {
    const data = await chrome.storage.local.get(null);
    
    // Remove API key for security
    if (data.settings) {
      data.settings = { ...data.settings, apiKey: '[REDACTED]' };
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `applysafe-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Data exported', 'success');
  } catch (error) {
    showToast('Failed to export data', 'error');
  }
}

async function clearAllData() {
  try {
    await chrome.storage.local.clear();
    
    // Reset to defaults
    await chrome.storage.local.set({
      settings: {
        autoAnalyze: true,
        showBadges: true,
        notifyHighRisk: true,
        apiKey: ''
      },
      stats: { scamsBlocked: 0, jobsScanned: 0, reportsSubmitted: 0 },
      whitelist: [],
      recentScans: [],
      reports: []
    });
    
    await loadAllData();
    showToast('All data cleared', 'success');
  } catch (error) {
    showToast('Failed to clear data', 'error');
  }
}

// Modal
function showConfirmModal(title, message, callback) {
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  confirmCallback = callback;
  elements.confirmModal.classList.add('show');
}

function hideConfirmModal() {
  elements.confirmModal.classList.remove('show');
  confirmCallback = null;
}

// Toast
function showToast(message, type = 'info') {
  elements.toast.querySelector('.toast-message').textContent = message;
  elements.toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

// Utility functions
function getRiskClass(score) {
  if (score <= 30) return 'safe';
  if (score <= 60) return 'warning';
  return 'danger';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTimeAgo(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}
