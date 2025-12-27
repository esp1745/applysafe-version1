// Google OAuth Authentication for ApplySafe
// Handles user sign-in with Google account

const AUTH_CONFIG = {
  CLIENT_ID: '683690946308-jfqmi19s9pgtk5fcaq8l3cpfg39o3cih.apps.googleusercontent.com',
  REDIRECT_URI: 'https://' + chrome.runtime.id + '.chromiumapp.org/',
  SCOPES: 'profile email',
  API_ENDPOINT: 'https://applysafe-version1.vercel.app/api'
};

// Get current user authentication status
async function getAuthStatus() {
  try {
    const result = await chrome.storage.local.get(['user', 'authToken']);
    if (result.user && result.authToken) {
      return {
        isAuthenticated: true,
        user: result.user,
        token: result.authToken
      };
    }
    return { isAuthenticated: false };
  } catch (error) {
    console.error('Get auth status error:', error);
    return { isAuthenticated: false };
  }
}

// Sign in with Google
async function signInWithGoogle() {
  console.log('🚀 signInWithGoogle() called');
  try {
    // Build OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    authUrl.searchParams.set('client_id', AUTH_CONFIG.CLIENT_ID);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('redirect_uri', AUTH_CONFIG.REDIRECT_URI);
    authUrl.searchParams.set('scope', AUTH_CONFIG.SCOPES);

    console.log('🔐 Launching OAuth flow...');
    
    // Launch OAuth flow
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.href,
      interactive: true
    });

    console.log('✅ OAuth flow completed');

    // Extract access token from redirect URL
    const params = new URLSearchParams(redirectUrl.split('#')[1]);
    const token = params.get('access_token');
    
    if (!token) {
      throw new Error('Failed to get auth token');
    }

    // Get user info from Google
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());

    console.log('✅ Google user info retrieved:', userInfo.email);

    // Try to register/login user with backend (optional - continue even if it fails)
    let backendData = null;
    try {
      console.log('🔄 Calling backend auth API...');
      const response = await fetch(`${AUTH_CONFIG.API_ENDPOINT}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleToken: token,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture
        })
      });

      console.log('📡 Backend response status:', response.status);
      
      if (response.ok) {
        backendData = await response.json();
        console.log('✅ Backend authentication successful');
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Backend authentication failed:', response.status, errorText);
      }
    } catch (backendError) {
      console.warn('⚠️ Backend unavailable, continuing with local auth:', backendError.message);
    }


    // Store user info (with or without backend data)
    const userId = backendData?.userId || `local_${Date.now()}`;
    await chrome.storage.local.set({
      user: {
        id: userId,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      },
      authToken: backendData?.token || token,
      trialStartDate: Date.now()
    });

    // Force subscription sync after login
    try {
      await chrome.runtime.sendMessage({ action: 'syncSubscription' });
      console.log('✅ Subscription status synced after login');
    } catch (e) {
      console.warn('⚠️ Failed to sync subscription after login:', e.message);
    }

    console.log('✅ User signed in successfully:', userInfo.email);
    return {
      success: true,
      user: userInfo,
      subscriptionStatus: backendData?.subscriptionStatus || 'free'
    };

  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: error.message };
  }
}

// Sign out
async function signOut() {
  // Always clear local storage, even if token removal fails
  try {
    // Try to remove Google token, but ignore errors
    try {
      const token = await chrome.identity.getAuthToken({ interactive: false });
      if (token) {
        await chrome.identity.removeCachedAuthToken({ token });
      }
    } catch (tokenError) {
      console.warn('Token removal failed or not needed:', tokenError.message);
    }
    // Clear local storage
    await chrome.storage.local.remove(['user', 'authToken', 'subscriptionStatus']);
    console.log('User signed out (local storage cleared)');
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
}

// Check if user can use a feature (with server-side verification)
async function canUseFeature(featureName = 'scan') {
  try {
    const auth = await getAuthStatus();

    // Allow anonymous users to use free trial
    if (!auth.isAuthenticated) {
      // Use local trial limits for anonymous users
      const trialInfo = await getLocalTrialInfo();
      if (trialInfo.isTrialActive && trialInfo.scansLeft > 0) {
        await incrementLocalScanCount();
        return { allowed: true, reason: 'free_trial', scansLeft: trialInfo.scansLeft - 1 };
      }
      return { allowed: false, reason: 'trial_expired', message: 'Sign in to continue using ApplySafe' };
    }

    // For authenticated users, check with backend
    const response = await fetch(`${AUTH_CONFIG.API_ENDPOINT}/usage/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
      body: JSON.stringify({ feature: featureName })
    });

    if (!response.ok) {
      throw new Error('Failed to check feature access');
    }

    const data = await response.json();
    return data; // { allowed: true/false, reason: string, scansLeft: number }

  } catch (error) {
    console.error('Feature check error:', error);
    // Fallback to local check
    return canUseFeatureLocal(featureName);
  }
}

// Local trial info for anonymous users
async function getLocalTrialInfo() {
  const data = await chrome.storage.local.get(['trialStartDate', 'dailyScans', 'lastScanDate']);
  
  const trialStartDate = data.trialStartDate || Date.now();
  const daysElapsed = Math.floor((Date.now() - trialStartDate) / (1000 * 60 * 60 * 24));
  const isTrialActive = daysElapsed < 7;

  // Reset daily count if new day
  const today = new Date().toDateString();
  const lastScanDate = data.lastScanDate || '';
  let dailyScans = data.dailyScans || 0;

  if (lastScanDate !== today) {
    dailyScans = 0;
    await chrome.storage.local.set({ dailyScans: 0, lastScanDate: today });
  }

  return {
    isTrialActive,
    daysLeft: Math.max(0, 7 - daysElapsed),
    scansLeft: Math.max(0, 10 - dailyScans),
    totalScansToday: dailyScans
  };
}

async function incrementLocalScanCount() {
  const data = await chrome.storage.local.get(['dailyScans']);
  const dailyScans = (data.dailyScans || 0) + 1;
  await chrome.storage.local.set({ dailyScans });
}

// Fallback local feature check
async function canUseFeatureLocal(featureName) {
  const trialInfo = await getLocalTrialInfo();
  if (trialInfo.scansLeft > 0) {
    await incrementLocalScanCount();
    return { allowed: true, reason: 'free_trial', scansLeft: trialInfo.scansLeft - 1 };
  }
  return { allowed: false, reason: 'limit_reached', message: 'Daily limit reached' };
}

// Export functions as global auth object for use in service worker
if (typeof self !== 'undefined') {
  self.auth = {
    getAuthStatus,
    signInWithGoogle,
    signOut,
    canUseFeature,
    getLocalTrialInfo
  };
}
