// Subscription Management for ApplySafe
// Handles license validation, free trial, and Stripe integration

const SUBSCRIPTION_CONFIG = {
  // TEST MODE - Get your keys from https://dashboard.stripe.com/test/apikeys
  STRIPE_PUBLISHABLE_KEY: 'pk_test_YOUR_PUBLISHABLE_KEY', // Replace with your test publishable key
  TRIAL_DAYS: 7,
  DAILY_SCAN_LIMIT_FREE: 5, // Free trial: 5 scans per day
  API_ENDPOINT: 'http://localhost:3000/api', // Local testing backend
  PRICE_ID: 'price_YOUR_PRICE_ID' // Replace with your test price ID
  
  // To get test credentials:
  // 1. Sign up at https://dashboard.stripe.com
  // 2. Go to Developers > API keys
  // 3. Toggle "Test mode" ON
  // 4. Copy "Publishable key" and paste above
  // 5. Create test product/price and copy Price ID
};

// Check subscription status
async function getSubscriptionStatus() {
  try {
    const stored = await chrome.storage.local.get(['subscription']);
    const subscription = stored.subscription || {
      status: 'trial',
      trialStarted: Date.now(),
      trialEnds: Date.now() + (SUBSCRIPTION_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000),
      scansToday: 0,
      lastScanReset: Date.now(),
      licenseKey: null,
      stripeCustomerId: null
    };
    
    // Reset daily scan count if it's a new day
    const now = Date.now();
    const lastReset = new Date(subscription.lastScanReset).setHours(0, 0, 0, 0);
    const today = new Date(now).setHours(0, 0, 0, 0);
    
    if (today > lastReset) {
      subscription.scansToday = 0;
      subscription.lastScanReset = now;
      await chrome.storage.local.set({ subscription });
    }
    
    // Check if trial expired
    if (subscription.status === 'trial' && now > subscription.trialEnds) {
      subscription.status = 'expired';
      await chrome.storage.local.set({ subscription });
    }
    
    return subscription;
  } catch (error) {
    console.error('Error getting subscription:', error);
    return null;
  }
}

// Check if user can perform an action
async function canUseFeature(featureName = 'scan') {
  const subscription = await getSubscriptionStatus();
  
  if (!subscription) return false;
  
  // Active paid subscription - unlimited access
  if (subscription.status === 'active') {
    return true;
  }
  
  // Free trial - check limits
  if (subscription.status === 'trial') {
    const daysLeft = Math.ceil((subscription.trialEnds - Date.now()) / (24 * 60 * 60 * 1000));
    
    if (daysLeft <= 0) {
      subscription.status = 'expired';
      await chrome.storage.local.set({ subscription });
      return false;
    }
    
    // Check daily scan limit during trial
    if (featureName === 'scan') {
      if (subscription.scansToday >= SUBSCRIPTION_CONFIG.DAILY_SCAN_LIMIT_FREE) {
        return false;
      }
      
      // Increment scan count
      subscription.scansToday++;
      await chrome.storage.local.set({ subscription });
      return true;
    }
    
    return true;
  }
  
  // Expired or no subscription
  return false;
}

// Get remaining trial info
async function getTrialInfo() {
  const subscription = await getSubscriptionStatus();
  
  if (!subscription) {
    return {
      isTrialActive: false,
      daysLeft: 0,
      scansLeft: 0
    };
  }
  
  const daysLeft = Math.ceil((subscription.trialEnds - Date.now()) / (24 * 60 * 60 * 1000));
  const scansLeft = Math.max(0, SUBSCRIPTION_CONFIG.DAILY_SCAN_LIMIT_FREE - subscription.scansToday);
  
  return {
    isTrialActive: subscription.status === 'trial',
    daysLeft: Math.max(0, daysLeft),
    scansLeft: scansLeft,
    isPaid: subscription.status === 'active',
    isExpired: subscription.status === 'expired',
    totalScansToday: subscription.scansToday
  };
}

// Create Stripe checkout session
async function createCheckoutSession() {
  try {
    const subscription = await getSubscriptionStatus();
    
    const response = await fetch(`${SUBSCRIPTION_CONFIG.API_ENDPOINT}/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: SUBSCRIPTION_CONFIG.PRICE_ID,
        customerId: subscription.stripeCustomerId,
        successUrl: chrome.runtime.getURL('popup/success.html'),
        cancelUrl: chrome.runtime.getURL('popup/popup.html')
      })
    });
    
    const data = await response.json();
    
    if (data.url) {
      // Open Stripe checkout in new tab
      chrome.tabs.create({ url: data.url });
      return { success: true };
    } else {
      throw new Error('Failed to create checkout session');
    }
  } catch (error) {
    console.error('Checkout error:', error);
    return { success: false, error: error.message };
  }
}

// Validate license key (for manual activation)
async function validateLicenseKey(licenseKey) {
  try {
    const response = await fetch(`${SUBSCRIPTION_CONFIG.API_ENDPOINT}/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey })
    });
    
    const data = await response.json();
    
    if (data.valid) {
      // Activate subscription
      const subscription = await getSubscriptionStatus();
      subscription.status = 'active';
      subscription.licenseKey = licenseKey;
      subscription.stripeCustomerId = data.customerId;
      subscription.activatedAt = Date.now();
      
      await chrome.storage.local.set({ subscription });
      
      return { success: true, message: 'License activated successfully!' };
    } else {
      return { success: false, error: 'Invalid license key' };
    }
  } catch (error) {
    console.error('License validation error:', error);
    return { success: false, error: error.message };
  }
}

// Sync subscription status from backend
async function syncSubscriptionStatus() {
  try {
    const subscription = await getSubscriptionStatus();
    
    if (!subscription.licenseKey && !subscription.stripeCustomerId) {
      return; // No subscription to sync
    }
    
    const response = await fetch(`${SUBSCRIPTION_CONFIG.API_ENDPOINT}/subscription-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: subscription.licenseKey,
        customerId: subscription.stripeCustomerId
      })
    });
    
    const data = await response.json();
    
    if (data.status) {
      subscription.status = data.status; // 'active', 'canceled', 'expired'
      subscription.planName = data.planName;
      subscription.renewsAt = data.renewsAt;
      
      await chrome.storage.local.set({ subscription });
      console.log('Subscription synced:', data.status);
    }
  } catch (error) {
    console.error('Sync error:', error);
    // Continue with cached status on error
  }
}

// Show upgrade prompt
function showUpgradePrompt(reason = 'limit_reached') {
  const messages = {
    limit_reached: 'Daily scan limit reached! Upgrade to Pro for unlimited scans.',
    trial_expired: 'Your 7-day trial has ended. Upgrade to continue using ApplySafe.',
    premium_feature: 'This is a Pro feature. Upgrade to unlock unlimited access.'
  };
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'ApplySafe Pro',
    message: messages[reason] || messages.limit_reached,
    buttons: [{ title: 'Upgrade Now' }],
    requireInteraction: true
  });
}

// Handle notification clicks
chrome.notifications.onButtonClicked.addListener((notificationId) => {
  createCheckoutSession();
  chrome.notifications.clear(notificationId);
});

// Initialize subscription (start trial for new users)
async function initializeSubscription() {
  const stored = await chrome.storage.local.get(['subscription']);
  
  if (!stored.subscription) {
    const newSubscription = {
      status: 'trial',
      trialStarted: Date.now(),
      trialEnds: Date.now() + (SUBSCRIPTION_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000),
      scansToday: 0,
      lastScanReset: Date.now(),
      licenseKey: null,
      stripeCustomerId: null
    };
    
    await chrome.storage.local.set({ subscription: newSubscription });
    console.log('ApplySafe: Free trial started - 7 days');
    
    // Show welcome notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Welcome to ApplySafe! 🎉',
      message: 'Your 7-day free trial has started. Enjoy unlimited protection!',
      priority: 2
    });
  }
}

// Cancel subscription (mark as canceled, but honor until period end)
async function cancelSubscription() {
  try {
    const subscription = await getSubscriptionStatus();
    
    if (!subscription.stripeCustomerId) {
      return { success: false, error: 'No active subscription' };
    }
    
    const response = await fetch(`${SUBSCRIPTION_CONFIG.API_ENDPOINT}/cancel-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: subscription.stripeCustomerId
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      subscription.status = 'canceled';
      subscription.cancelsAt = data.cancelsAt;
      await chrome.storage.local.set({ subscription });
      
      return { success: true, message: 'Subscription canceled. Access until ' + new Date(data.cancelsAt).toLocaleDateString() };
    } else {
      throw new Error(data.error || 'Failed to cancel');
    }
  } catch (error) {
    console.error('Cancel error:', error);
    return { success: false, error: error.message };
  }
}

// Sync subscription status every hour
setInterval(() => {
  syncSubscriptionStatus();
}, 60 * 60 * 1000); // Every hour

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSubscriptionStatus,
    canUseFeature,
    getTrialInfo,
    createCheckoutSession,
    validateLicenseKey,
    syncSubscriptionStatus,
    initializeSubscription,
    cancelSubscription,
    showUpgradePrompt
  };
}
