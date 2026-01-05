// Test Sync Script
const output = document.getElementById('output');

async function checkAuth() {
  output.textContent = 'Checking auth...';
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });
    output.textContent = 'Auth Status:\n' + JSON.stringify(response, null, 2);
  } catch (error) {
    output.textContent = 'Error: ' + error.message;
  }
}

async function testSync() {
  output.textContent = 'Testing sync...';
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'syncToCloud',
      applications: [],
      reminders: [],
      scanHistory: []
    });
    output.textContent = 'Sync Result:\n' + JSON.stringify(response, null, 2);
  } catch (error) {
    output.textContent = 'Error: ' + error.message;
  }
}

async function checkStorage() {
  output.textContent = 'Checking storage...';
  const result = await chrome.storage.local.get(['authToken', 'user', 'subscription']);
  output.textContent = 'Storage:\n' + JSON.stringify({
    hasAuthToken: !!result.authToken,
    tokenPreview: result.authToken ? result.authToken.substring(0, 30) + '...' : null,
    user: result.user,
    subscription: result.subscription
  }, null, 2);
}

// Setup event listeners
document.getElementById('checkAuthBtn').addEventListener('click', checkAuth);
document.getElementById('testSyncBtn').addEventListener('click', testSync);
document.getElementById('checkStorageBtn').addEventListener('click', checkStorage);
