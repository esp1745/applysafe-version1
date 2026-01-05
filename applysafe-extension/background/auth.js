// Google OAuth Authentication for ApplySafe
// Handles user sign-in with Google account

const AUTH_CONFIG = {
  CLIENT_ID: '683690946308-jfqmi19s9pgtk5fcaq8l3cpfg39o3cih.apps.googleusercontent.com',
  REDIRECT_URI: 'https://' + chrome.runtime.id + '.chromiumapp.org/',
  SCOPES: 'profile email',
  API_ENDPOINT: 'http://localhost:3000/api'  // Use localhost for testing
};

// Helper to check if a token looks like a JWT (has 3 parts separated by dots)
function isValidJWTFormat(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3;
}

// Get current user authentication status
async function getAuthStatus() {
  try {
    const result = await chrome.storage.local.get(['user', 'authToken', 'googleAccessToken']);
    if (result.user && result.authToken) {
      // Check if the token looks like a JWT
      if (!isValidJWTFormat(result.authToken)) {
        console.warn('⚠️ AUTH: Stored token is not a valid JWT format, attempting refresh...');
        // Token is not a JWT - likely a Google access token stored by mistake
        // Try to get a proper JWT from the backend
        const refreshResult = await refreshToken();
        if (refreshResult.success) {
          return {
            isAuthenticated: true,
            user: result.user,
            token: refreshResult.token
          };
        }
        // If refresh failed, return not authenticated
        console.warn('⚠️ AUTH: Could not get valid JWT, user needs to sign in again');
        return { isAuthenticated: false, needsReauth: true };
      }
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

// Refresh JWT token by re-authenticating with backend
// This is used when the current token is invalid/expired
async function refreshToken() {
  console.log('🔄 AUTH: Attempting to refresh token...');
  
  try {
    // Get stored user info
    const result = await chrome.storage.local.get(['user']);
    if (!result.user || !result.user.email) {
      console.log('❌ AUTH: No user info stored, cannot refresh');
      return { success: false, error: 'No user info' };
    }
    
    // Try to get a fresh Google token
    let googleToken;
    
    // First, try to get token non-interactively
    try {
      googleToken = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(token);
          }
        });
      });
    } catch (e) {
      console.log('⚠️ AUTH: Non-interactive auth failed:', e.message);
      
      // Try to clear the cached token and get a new one
      try {
        // Remove any cached token first
        await new Promise((resolve) => {
          chrome.identity.clearAllCachedAuthTokens(() => {
            console.log('🧹 AUTH: Cleared cached auth tokens');
            resolve();
          });
        });
        
        // Now try again with interactive mode (will show Google popup if needed)
        googleToken = await new Promise((resolve, reject) => {
          chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(token);
            }
          });
        });
        console.log('✅ AUTH: Got token with interactive mode');
      } catch (e2) {
        console.log('❌ AUTH: Interactive auth also failed:', e2.message);
        return { success: false, error: 'Need to sign in again' };
      }
    }
    
    if (!googleToken) {
      return { success: false, error: 'No Google token available' };
    }
    
    console.log('✅ AUTH: Got Google token, calling backend...');
    
    // Call backend to get fresh JWT
    const response = await fetch(AUTH_CONFIG.API_ENDPOINT + '/auth/google', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        googleToken: googleToken,
        email: result.user.email,
        name: result.user.name,
        picture: result.user.picture || ''
      })
    });
    
    if (!response.ok) {
      console.log('❌ AUTH: Backend returned error:', response.status);
      const errorText = await response.text();
      console.log('❌ AUTH: Backend error details:', errorText);
      return { success: false, error: 'Backend auth failed' };
    }
    
    const data = await response.json();
    
    if (data.success && data.token) {
      // Store the new JWT token
      await chrome.storage.local.set({ authToken: data.token });
      console.log('✅ AUTH: Token refreshed successfully!');
      return { success: true, token: data.token };
    }
    
    return { success: false, error: data.error || 'No token in response' };
  } catch (error) {
    console.error('❌ AUTH: Token refresh error:', error);
    return { success: false, error: error.message };
  }
}

// Sign in with Google
async function signInWithGoogle() {
  console.log('🚀 AUTH: signInWithGoogle() starting...');
  
  try {
    // Build OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    authUrl.searchParams.set('client_id', AUTH_CONFIG.CLIENT_ID);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('redirect_uri', AUTH_CONFIG.REDIRECT_URI);
    authUrl.searchParams.set('scope', AUTH_CONFIG.SCOPES);

    console.log('🔐 AUTH: Launching OAuth flow with redirect:', AUTH_CONFIG.REDIRECT_URI);
    
    // Launch OAuth flow
    let redirectUrl;
    try {
      redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl.href,
        interactive: true
      });
      console.log('✅ AUTH: OAuth flow returned URL');
    } catch (oauthError) {
      console.error('❌ AUTH: OAuth flow failed:', oauthError);
      return { success: false, error: 'OAuth flow failed: ' + oauthError.message };
    }

    // Extract access token from redirect URL
    const params = new URLSearchParams(redirectUrl.split('#')[1]);
    const token = params.get('access_token');
    
    if (!token) {
      console.error('❌ AUTH: No access token in redirect URL');
      return { success: false, error: 'Failed to get auth token' };
    }
    console.log('✅ AUTH: Got access token, length:', token.length);

    // Get user info from Google
    let userInfo;
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      userInfo = await userInfoRes.json();
      console.log('✅ AUTH: Got user info:', userInfo.email, userInfo.name);
    } catch (userInfoError) {
      console.error('❌ AUTH: Failed to get user info:', userInfoError);
      return { success: false, error: 'Failed to get user info' };
    }

    // Try to save user to backend database
    let backendToken = null;
    console.log('🔄 AUTH: About to call backend...');
    
    try {
      const backendUrl = AUTH_CONFIG.API_ENDPOINT + '/auth/google';
      const requestBody = {
        googleToken: token,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture || ''
      };
      
      console.log('🔄 AUTH: Calling backend at', backendUrl);
      console.log('🔄 AUTH: Request body:', JSON.stringify({ email: requestBody.email, name: requestBody.name }));
      console.log('🔄 AUTH: Starting fetch NOW...');
      
      let response;
      try {
        response = await fetch(backendUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        console.log('✅ AUTH: Fetch completed! Status:', response.status);
      } catch (fetchError) {
        console.error('❌ AUTH: Fetch threw error:', fetchError);
        console.error('❌ AUTH: Error details:', fetchError.message, fetchError.stack);
        throw new Error('Network request failed: ' + fetchError.message);
      }
      
      console.log('🔄 AUTH: Checking response status...');
      console.log('📡 AUTH: Backend responded with status:', response.status);
      
      let responseData;
      const responseText = await response.text();
      console.log('📡 AUTH: Raw response:', responseText.substring(0, 500));
      
      try {
        responseData = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('❌ AUTH: Failed to parse response as JSON');
        responseData = { error: 'Invalid JSON response' };
      }
      
      console.log('📡 AUTH: Backend response parsed:', JSON.stringify(responseData));
      
      if (response.ok && responseData.success) {
        backendToken = responseData.token;
        console.log('✅ AUTH: User saved to database!');
      } else {
        console.warn('⚠️ AUTH: Backend returned error:', responseData.error);
      }
    } catch (backendError) {
      console.warn('⚠️ AUTH: Backend call failed:', backendError.message);
    }

    // Store user info locally
    await chrome.storage.local.set({
      user: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      },
      // IMPORTANT: Only store JWT token from backend, NOT the Google access token
      // Google access tokens won't work for authenticated API calls
      authToken: backendToken || null,
      googleAccessToken: token, // Store Google token separately for refresh purposes
      trialStartDate: Date.now(),
      // Initialize subscription as trial for new users
      subscription: {
        status: 'trial',
        trialStarted: Date.now(),
        trialEnds: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        scansToday: 0,
        lastScanReset: Date.now()
      }
    });

    // If we didn't get a backend token, authentication is incomplete
    if (!backendToken) {
      console.warn('⚠️ AUTH: No JWT token received from backend - AI features may not work');
    }

    console.log('✅ AUTH: User stored locally:', userInfo.email, 'Has JWT:', !!backendToken);
    
    // Sync subscription status from backend (in case user already has a subscription)
    try {
      if (typeof syncSubscriptionStatus === 'function') {
        await syncSubscriptionStatus();
        console.log('✅ AUTH: Subscription synced from backend');
      }
    } catch (syncErr) {
      console.log('Subscription sync after login:', syncErr.message);
    }
    
    return {
      success: true,
      user: userInfo
    };

  } catch (error) {
    console.error('❌ AUTH: Sign in error:', error);
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
    // Clear local storage including subscription
    await chrome.storage.local.remove(['user', 'authToken', 'subscriptionStatus', 'subscription']);
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
    const authStatus = await getAuthStatus();
    const trialInfo = await getLocalTrialInfo();

    // Always allow if user has scans left locally
    if (trialInfo.scansLeft > 0) {
      await incrementLocalScanCount();
      return { 
        allowed: true, 
        reason: authStatus.isAuthenticated ? 'authenticated' : 'free_trial', 
        scansLeft: trialInfo.scansLeft - 1,
        usage: { scansToday: trialInfo.totalScansToday + 1 }
      };
    }

    // If authenticated, try backend but don't block on failure
    if (authStatus.isAuthenticated) {
      try {
        const response = await fetch(`${AUTH_CONFIG.API_ENDPOINT}/usage/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authStatus.token}`
          },
          body: JSON.stringify({ feature: featureName })
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.usage) data.usage = { scansToday: trialInfo.totalScansToday };
          return data;
        }
      } catch (backendError) {
        console.warn('Backend usage check failed:', backendError.message);
      }
      
      // For authenticated users, be generous - allow if backend fails
      // Reset daily scans for authenticated users
      await chrome.storage.local.set({ dailyScans: 0 });
      return { 
        allowed: true, 
        reason: 'authenticated_fallback',
        scansLeft: 10,
        usage: { scansToday: 0 }
      };
    }

    // No scans left and not authenticated
    return { 
      allowed: false, 
      reason: trialInfo.isTrialActive ? 'limit_reached' : 'trial_expired', 
      message: trialInfo.isTrialActive ? 'Daily limit reached' : 'Sign in to continue using ApplySafe',
      usage: { scansToday: trialInfo.totalScansToday }
    };

  } catch (error) {
    console.error('Feature check error:', error);
    // On any error, allow the scan (be user-friendly)
    return { allowed: true, reason: 'error_fallback', scansLeft: 10, usage: { scansToday: 0 } };
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
    return { 
      allowed: true, 
      reason: 'free_trial', 
      scansLeft: trialInfo.scansLeft - 1,
      usage: { scansToday: trialInfo.totalScansToday + 1 }
    };
  }
  return { 
    allowed: false, 
    reason: 'limit_reached', 
    message: 'Daily limit reached',
    usage: { scansToday: trialInfo.totalScansToday }
  };
}

// Simple Email Authentication
async function signInWithEmail(email, name) {
  console.log('📧 AUTH: Signing in with email:', email);
  
  try {
    // Call backend email auth endpoint
    const response = await fetch(`${AUTH_CONFIG.API_ENDPOINT}/auth/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: name || email.split('@')[0] })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ AUTH: Email auth failed:', error);
      return { success: false, error: error.message || 'Email authentication failed' };
    }

    const data = await response.json();
    
    if (!data.success || !data.token) {
      console.error('❌ AUTH: Invalid response:', data);
      return { success: false, error: 'Invalid response from server' };
    }

    // Save user and token to storage
    await chrome.storage.local.set({
      authToken: data.token,
      user: {
        email: data.user.email,
        name: data.user.name,
        picture: data.user.picture || ''
      },
      subscription: {
        status: data.subscriptionStatus || 'free'
      }
    });

    console.log('✅ AUTH: Email sign-in successful!');
    return { success: true, user: data.user, token: data.token };

  } catch (error) {
    console.error('❌ AUTH: Email sign-in error:', error);
    return { success: false, error: error.message };
  }
}

// Export functions as global auth object for use in service worker
if (typeof self !== 'undefined') {
  self.auth = {
    getAuthStatus,
    signInWithGoogle,
    signInWithEmail,
    signOut,
    canUseFeature,
    getLocalTrialInfo,
    refreshToken
  };
}

