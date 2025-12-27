/**
 * ApplySafe Dashboard - Main JavaScript
 * Version 3.0.0
 */

// State
let applications = [];
let reminders = [];
let currentUser = null;
let settings = {
  theme: 'system',
  followUpReminders: true,
  scamAlerts: true,
  weeklySummary: false,
  cloudSync: true
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initializeDashboard();
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
  
  // Load applications
  await loadApplications();
  
  // Load reminders
  await loadReminders();
  
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
    'overview': { title: 'Overview', description: 'Track your job search progress' },
    'applications': { title: 'Applications', description: 'Manage your job applications' },
    'ai-tools': { title: 'AI Tools', description: 'Powered by advanced AI' },
    'reminders': { title: 'Reminders', description: 'Stay on top of your applications' },
    'analytics': { title: 'Analytics', description: 'Insights into your job search' },
    'settings': { title: 'Settings', description: 'Customize your experience' }
  };
  
  const info = titles[tabName] || titles['overview'];
  document.getElementById('pageTitle').textContent = info.title;
  document.getElementById('pageDescription').textContent = info.description;
}

// Modal Management
function setupModals() {
  // Add Application Modal
  const addAppModal = document.getElementById('addApplicationModal');
  const addAppBtn = document.getElementById('addApplicationBtn');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelAppBtn = document.getElementById('cancelApplication');
  
  addAppBtn?.addEventListener('click', () => openModal(addAppModal));
  closeModalBtn?.addEventListener('click', () => closeModal(addAppModal));
  cancelAppBtn?.addEventListener('click', () => closeModal(addAppModal));
  
  // Add Reminder Modal
  const addReminderModal = document.getElementById('addReminderModal');
  const addReminderBtn = document.getElementById('addReminderBtn');
  const closeReminderBtn = document.getElementById('closeReminderModal');
  const cancelReminderBtn = document.getElementById('cancelReminder');
  
  addReminderBtn?.addEventListener('click', () => openModal(addReminderModal));
  closeReminderBtn?.addEventListener('click', () => closeModal(addReminderModal));
  cancelReminderBtn?.addEventListener('click', () => closeModal(addReminderModal));
  
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
  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken', 'user', 'subscription'], (result) => {
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
      }
      resolve();
    });
  });
}

// Load Applications
async function loadApplications() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['applications'], (result) => {
      applications = result.applications || [];
      renderApplications();
      updateAppCount();
      resolve();
    });
  });
}

// Save Applications
function saveApplications() {
  chrome.storage.local.set({ applications });
  updateStats();
  updateAppCount();
}

// Render Applications
function renderApplications() {
  const grid = document.getElementById('applicationsGrid');
  const recentList = document.getElementById('recentApplications');
  
  if (applications.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>No applications yet</p>
        <span>Click "Add Application" to start tracking your job search</span>
      </div>
    `;
    
    recentList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>No applications yet</p>
        <span>Start tracking your job applications to see them here</span>
      </div>
    `;
    return;
  }
  
  // Sort by date (newest first)
  const sorted = [...applications].sort((a, b) => new Date(b.appliedDate || b.createdAt) - new Date(a.appliedDate || a.createdAt));
  
  // Render grid
  grid.innerHTML = sorted.map(app => `
    <div class="app-card" data-id="${app.id}">
      <div class="app-card-header">
        <div>
          <div class="app-card-title">${escapeHtml(app.title)}</div>
          <div class="app-card-company">${escapeHtml(app.company)}</div>
        </div>
        <span class="status-badge ${app.status}">${capitalizeFirst(app.status)}</span>
      </div>
      <div class="app-card-details">
        ${app.location ? `
          <div class="app-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            ${escapeHtml(app.location)}
          </div>
        ` : ''}
        ${app.salary ? `
          <div class="app-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            ${escapeHtml(app.salary)}
          </div>
        ` : ''}
        <div class="app-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${formatDate(app.appliedDate || app.createdAt)}
        </div>
      </div>
      <div class="app-card-actions">
        <button class="btn btn-secondary" onclick="editApplication('${app.id}')">Edit</button>
        <button class="btn btn-secondary" onclick="deleteApplication('${app.id}')">Delete</button>
      </div>
    </div>
  `).join('');
  
  // Render recent list (first 5)
  const recent = sorted.slice(0, 5);
  recentList.innerHTML = recent.map(app => `
    <div class="application-item">
      <div class="app-info">
        <span class="app-title">${escapeHtml(app.title)}</span>
        <span class="app-company">${escapeHtml(app.company)}</span>
      </div>
      <span class="status-badge ${app.status}">${capitalizeFirst(app.status)}</span>
    </div>
  `).join('');
}

// Update App Count Badge
function updateAppCount() {
  document.getElementById('appCount').textContent = applications.length;
}

// Load Reminders
async function loadReminders() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['reminders'], (result) => {
      reminders = result.reminders || [];
      renderReminders();
      updateReminderCount();
      resolve();
    });
  });
}

// Save Reminders
function saveReminders() {
  chrome.storage.local.set({ reminders });
  updateReminderCount();
}

// Render Reminders
function renderReminders() {
  const grid = document.getElementById('remindersGrid');
  const upcomingList = document.getElementById('upcomingReminders');
  
  if (reminders.length === 0) {
    const emptyHtml = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <p>No reminders yet</p>
        <span>Add follow-up reminders to stay on top of your applications</span>
      </div>
    `;
    grid.innerHTML = emptyHtml;
    upcomingList.innerHTML = emptyHtml;
    return;
  }
  
  // Sort by date
  const sorted = [...reminders].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Filter upcoming (not past)
  const upcoming = sorted.filter(r => new Date(r.date) >= new Date());
  
  grid.innerHTML = sorted.map(reminder => `
    <div class="reminder-item">
      <div class="app-info">
        <span class="app-title">${escapeHtml(reminder.title)}</span>
        <span class="app-company">${formatDate(reminder.date)} ${reminder.time || ''}</span>
      </div>
      <button class="btn btn-secondary" onclick="deleteReminder('${reminder.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `).join('');
  
  upcomingList.innerHTML = upcoming.slice(0, 5).map(reminder => `
    <div class="reminder-item">
      <div class="app-info">
        <span class="app-title">${escapeHtml(reminder.title)}</span>
        <span class="app-company">${formatDate(reminder.date)}</span>
      </div>
      <span class="status-badge ${reminder.type}">${capitalizeFirst(reminder.type)}</span>
    </div>
  `).join('') || `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <p>No upcoming reminders</p>
      <span>Add follow-up reminders to stay on top of your applications</span>
    </div>
  `;
}

// Update Reminder Count
function updateReminderCount() {
  const upcoming = reminders.filter(r => new Date(r.date) >= new Date());
  document.getElementById('reminderCount').textContent = upcoming.length;
}

// Update Stats
function updateStats() {
  const total = applications.length;
  const pending = applications.filter(a => a.status === 'applied').length;
  const interviewing = applications.filter(a => a.status === 'interviewing').length;
  
  document.getElementById('totalApplications').textContent = total;
  document.getElementById('pendingApps').textContent = pending;
  document.getElementById('interviewCount').textContent = interviewing;
  document.getElementById('chartTotal').textContent = total;
  
  // Load scam stats
  chrome.storage.local.get(['stats'], (result) => {
    const stats = result.stats || {};
    document.getElementById('scamsDetected').textContent = stats.scamsBlocked || 0;
    document.getElementById('jobsAnalyzed').textContent = stats.jobsScanned || 0;
    document.getElementById('scamsFound').textContent = stats.scamsBlocked || 0;
    document.getElementById('safeJobs').textContent = (stats.jobsScanned || 0) - (stats.scamsBlocked || 0);
  });
  
  // Calculate response rate
  const withResponse = applications.filter(a => a.status !== 'applied' && a.status !== 'saved').length;
  const responseRate = total > 0 ? Math.round((withResponse / total) * 100) : 0;
  document.getElementById('responseRate').textContent = responseRate + '%';
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
  
  // Application form
  document.getElementById('applicationForm').addEventListener('submit', handleApplicationSubmit);
  
  // Reminder form
  document.getElementById('reminderForm').addEventListener('submit', handleReminderSubmit);
  
  // Search & Filters
  document.getElementById('searchApps')?.addEventListener('input', filterApplications);
  document.getElementById('statusFilter')?.addEventListener('change', filterApplications);
  document.getElementById('sortFilter')?.addEventListener('change', filterApplications);
  
  // Sync button
  document.getElementById('syncBtn')?.addEventListener('click', syncData);
  
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
  document.getElementById('followUpReminders')?.addEventListener('change', (e) => {
    settings.followUpReminders = e.target.checked;
    chrome.storage.local.set({ settings });
  });
  
  document.getElementById('scamAlerts')?.addEventListener('change', (e) => {
    settings.scamAlerts = e.target.checked;
    chrome.storage.local.set({ settings });
  });
  
  document.getElementById('cloudSync')?.addEventListener('change', (e) => {
    settings.cloudSync = e.target.checked;
    chrome.storage.local.set({ settings });
    if (e.target.checked) syncData();
  });
}

// Handle Application Submit
function handleApplicationSubmit(e) {
  e.preventDefault();
  
  const app = {
    id: Date.now().toString(),
    title: document.getElementById('jobTitle').value,
    company: document.getElementById('company').value,
    location: document.getElementById('location').value,
    salary: document.getElementById('salary').value,
    status: document.getElementById('status').value,
    appliedDate: document.getElementById('appliedDate').value || new Date().toISOString().split('T')[0],
    url: document.getElementById('jobUrl').value,
    notes: document.getElementById('notes').value,
    createdAt: new Date().toISOString()
  };
  
  applications.push(app);
  saveApplications();
  renderApplications();
  
  // Close modal and reset form
  closeModal(document.getElementById('addApplicationModal'));
  e.target.reset();
  
  showToast('Application added successfully!', 'success');
}

// Handle Reminder Submit
function handleReminderSubmit(e) {
  e.preventDefault();
  
  const reminder = {
    id: Date.now().toString(),
    title: document.getElementById('reminderTitle').value,
    applicationId: document.getElementById('reminderApp').value,
    date: document.getElementById('reminderDate').value,
    time: document.getElementById('reminderTime').value,
    type: document.getElementById('reminderType').value,
    notes: document.getElementById('reminderNotes').value,
    createdAt: new Date().toISOString()
  };
  
  reminders.push(reminder);
  saveReminders();
  renderReminders();
  
  // Schedule notification
  scheduleReminder(reminder);
  
  // Close modal and reset form
  closeModal(document.getElementById('addReminderModal'));
  e.target.reset();
  
  showToast('Reminder added successfully!', 'success');
}

// Schedule Reminder
function scheduleReminder(reminder) {
  const reminderDate = new Date(`${reminder.date}T${reminder.time || '09:00'}`);
  const now = new Date();
  
  if (reminderDate > now) {
    const delay = reminderDate.getTime() - now.getTime();
    
    // Use Chrome alarms API
    chrome.runtime.sendMessage({
      action: 'scheduleReminder',
      reminder: {
        ...reminder,
        scheduledFor: reminderDate.getTime()
      }
    });
  }
}

// Delete Application
window.deleteApplication = function(id) {
  if (confirm('Are you sure you want to delete this application?')) {
    applications = applications.filter(a => a.id !== id);
    saveApplications();
    renderApplications();
    showToast('Application deleted', 'success');
  }
};

// Edit Application
window.editApplication = function(id) {
  const app = applications.find(a => a.id === id);
  if (!app) return;
  
  // Populate form
  document.getElementById('jobTitle').value = app.title;
  document.getElementById('company').value = app.company;
  document.getElementById('location').value = app.location || '';
  document.getElementById('salary').value = app.salary || '';
  document.getElementById('status').value = app.status;
  document.getElementById('appliedDate').value = app.appliedDate || '';
  document.getElementById('jobUrl').value = app.url || '';
  document.getElementById('notes').value = app.notes || '';
  
  // Update form handler for edit
  const form = document.getElementById('applicationForm');
  form.onsubmit = (e) => {
    e.preventDefault();
    
    const index = applications.findIndex(a => a.id === id);
    applications[index] = {
      ...applications[index],
      title: document.getElementById('jobTitle').value,
      company: document.getElementById('company').value,
      location: document.getElementById('location').value,
      salary: document.getElementById('salary').value,
      status: document.getElementById('status').value,
      appliedDate: document.getElementById('appliedDate').value,
      url: document.getElementById('jobUrl').value,
      notes: document.getElementById('notes').value,
      updatedAt: new Date().toISOString()
    };
    
    saveApplications();
    renderApplications();
    closeModal(document.getElementById('addApplicationModal'));
    form.reset();
    form.onsubmit = handleApplicationSubmit;
    showToast('Application updated!', 'success');
  };
  
  openModal(document.getElementById('addApplicationModal'));
};

// Delete Reminder
window.deleteReminder = function(id) {
  reminders = reminders.filter(r => r.id !== id);
  saveReminders();
  renderReminders();
  showToast('Reminder deleted', 'success');
};

// Filter Applications
function filterApplications() {
  const search = document.getElementById('searchApps').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const sort = document.getElementById('sortFilter').value;
  
  let filtered = [...applications];
  
  // Search filter
  if (search) {
    filtered = filtered.filter(a => 
      a.title.toLowerCase().includes(search) ||
      a.company.toLowerCase().includes(search)
    );
  }
  
  // Status filter
  if (status !== 'all') {
    filtered = filtered.filter(a => a.status === status);
  }
  
  // Sort
  switch (sort) {
    case 'oldest':
      filtered.sort((a, b) => new Date(a.appliedDate || a.createdAt) - new Date(b.appliedDate || b.createdAt));
      break;
    case 'company':
      filtered.sort((a, b) => a.company.localeCompare(b.company));
      break;
    case 'status':
      filtered.sort((a, b) => a.status.localeCompare(b.status));
      break;
    default: // newest
      filtered.sort((a, b) => new Date(b.appliedDate || b.createdAt) - new Date(a.appliedDate || a.createdAt));
  }
  
  // Render filtered
  const grid = document.getElementById('applicationsGrid');
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <p>No applications match your filters</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filtered.map(app => `
    <div class="app-card" data-id="${app.id}">
      <div class="app-card-header">
        <div>
          <div class="app-card-title">${escapeHtml(app.title)}</div>
          <div class="app-card-company">${escapeHtml(app.company)}</div>
        </div>
        <span class="status-badge ${app.status}">${capitalizeFirst(app.status)}</span>
      </div>
      <div class="app-card-details">
        ${app.location ? `<div class="app-detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHtml(app.location)}</div>` : ''}
        <div class="app-detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${formatDate(app.appliedDate || app.createdAt)}</div>
      </div>
      <div class="app-card-actions">
        <button class="btn btn-secondary" onclick="editApplication('${app.id}')">Edit</button>
        <button class="btn btn-secondary" onclick="deleteApplication('${app.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// Sync Data
async function syncData() {
  showToast('Syncing data...', 'info');
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'syncToCloud', 
      applications, 
      reminders 
    });
    if (response?.success) {
      showToast('Data synced successfully!', 'success');
    } else if (response?.error === 'not_authenticated') {
      showToast('Please sign in to sync data', 'error');
    } else {
      showToast('Sync failed. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Sync error:', error);
    showToast('Sync failed. Please try again.', 'error');
  }
}

// Export Data
function exportData() {
  const data = {
    applications,
    reminders,
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
    applications = [];
    reminders = [];
    chrome.storage.local.remove(['applications', 'reminders', 'stats']);
    renderApplications();
    renderReminders();
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
      context: { applications: applications.length, reminders: reminders.length }
    });
    
    // Remove typing indicator
    const typingIndicator = messagesContainer.querySelector('.typing');
    if (typingIndicator) typingIndicator.remove();
    
    if (response?.success && response?.reply) {
      messagesContainer.innerHTML += `<div class="message assistant"><p>${escapeHtml(response.reply)}</p></div>`;
    } else if (response?.error === 'not_authenticated') {
      messagesContainer.innerHTML += `<div class="message assistant"><p>Please sign in to chat with AI assistant.</p></div>`;
    } else {
      messagesContainer.innerHTML += `<div class="message assistant"><p>I'm sorry, I couldn't process that. Please try again.</p></div>`;
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
