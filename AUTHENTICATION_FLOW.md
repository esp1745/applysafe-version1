# ApplySafe Authentication Flow Documentation

## Overview

ApplySafe now supports 3 user types with different authentication and usage limits:

1. **Anonymous Users** - Local trial, no sign-in required
2. **Google Users** - Server-synced trial, cross-device usage tracking  
3. **Pro Users** - Unlimited access via Stripe subscription

## Authentication Flow Diagram

```
┌─────────────────┐
│  User Opens     │
│  Extension      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Check Local Storage                │
│  - authToken?                       │
│  - user?                            │
└────────┬────────────────────────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
  YES         NO
    │          │
    │    ┌─────┴────────┐
    │    │ Anonymous    │
    │    │ User Mode    │
    │    │ - Local trial│
    │    │ - 10/day     │
    │    └──────────────┘
    │
    ▼
┌─────────────────┐      ┌──────────────────┐
│ Verify Token    │─────▶│  Token Valid?    │
│ with Backend    │      └────────┬─────────┘
└─────────────────┘               │
                             ┌────┴─────┐
                             │          │
                             ▼          ▼
                            YES         NO
                             │          │
                             │    ┌─────┴─────────┐
                             │    │ Sign Out      │
                             │    │ User          │
                             │    └───────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Signed-In Mode   │
                    │ - Server tracking│
                    │ - Synced trial   │
                    │ - Upgrade option │
                    └──────────────────┘
```

## User Journey

### 1. Anonymous User (No Sign-In)

```javascript
// User opens extension for first time
// Local storage is empty

// Extension behavior:
- Shows "Sign in with Google" prompt
- Stores trial start date locally
- Tracks scans in chrome.storage.local
- Daily limit: 10 scans
- Trial period: 7 days

// Limits checked locally:
const trial = auth.getLocalTrialInfo();
if (trial.isExpired) {
  // Show expired message
} else if (trial.scansToday >= 10) {
  // Show daily limit message
}
```

### 2. User Clicks "Sign in with Google"

```javascript
// popup.js
async function handleGoogleSignIn() {
  // 1. User clicks button
  elements.googleSignInBtn.disabled = true;
  
  // 2. Send message to service worker
  const response = await chrome.runtime.sendMessage({ 
    action: 'signInWithGoogle' 
  });
  
  // 3. Service worker calls auth.signInWithGoogle()
}

// auth.js
async function signInWithGoogle() {
  // 1. Request Google OAuth token from Chrome
  const token = await chrome.identity.getAuthToken({
    interactive: true
  });
  
  // 2. Get user info from Google
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const userInfo = await response.json();
  
  // 3. Send to backend for verification
  const authResponse = await fetch(
    `${API_ENDPOINT}/auth/google`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleToken: token,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      })
    }
  );
  
  // 4. Receive JWT token from backend
  const data = await authResponse.json();
  
  // 5. Store JWT and user info locally
  await chrome.storage.local.set({
    authToken: data.token,
    user: {
      id: data.userId,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    }
  });
  
  return { success: true };
}
```

### 3. Backend Processes Authentication

```javascript
// server.js
app.post('/api/auth/google', async (req, res) => {
  const { googleToken, email, name, picture } = req.body;
  
  // 1. Verify Google token
  const ticket = await googleClient.verifyIdToken({
    idToken: googleToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  const googleId = payload['sub'];
  
  // 2. Find or create user
  let user = users.find(u => u.googleId === googleId);
  
  if (!user) {
    // New user - create account
    user = {
      id: generateUserId(),
      googleId,
      email,
      name,
      picture,
      createdAt: Date.now(),
      subscriptionStatus: 'free',
      trialStartDate: Date.now()
    };
    users.set(user.id, user);
    
    // Initialize usage tracking
    userUsage.set(user.id, {
      dailyScans: 0,
      lastScanDate: new Date().toDateString(),
      totalScans: 0
    });
  }
  
  // 3. Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  
  // 4. Return token and user info
  res.json({
    success: true,
    userId: user.id,
    token,
    subscriptionStatus: user.subscriptionStatus,
    trialInfo: getUserTrialInfo(user)
  });
});
```

### 4. User Analyzes Job Posting

```javascript
// service-worker.js
async function analyzeJob(jobData, url, autoAnalysis) {
  // 1. Check authentication
  const authStatus = await auth.getAuthStatus();
  
  // 2. Check if user can use feature
  const canAnalyze = await auth.canUseFeature('scan', url);
  
  if (!canAnalyze.allowed) {
    if (authStatus.isAuthenticated) {
      // Signed-in user hit limit
      return {
        success: false,
        error: 'limit_reached',
        message: `Daily scan limit reached (${canAnalyze.usage.scansToday}/10)`
      };
    } else {
      // Anonymous user - check local trial
      const localTrial = auth.getLocalTrialInfo();
      if (localTrial.isExpired) {
        return {
          success: false,
          error: 'trial_expired',
          message: 'Sign in with Google or upgrade to Pro!'
        };
      }
    }
  }
  
  // 3. Proceed with analysis
  // ... AI analysis code ...
}
```

### 5. Backend Validates Usage

```javascript
// auth.js
async function canUseFeature(feature, url) {
  // 1. Get auth status
  const authStatus = await getAuthStatus();
  
  if (!authStatus.isAuthenticated) {
    // Anonymous user - use local trial
    return canUseFeatureLocal(feature);
  }
  
  // 2. Check with backend
  try {
    const response = await fetch(
      `${API_ENDPOINT}/usage/check`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStatus.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ feature, url })
      }
    );
    
    const data = await response.json();
    return data;
    
  } catch (error) {
    // Fallback to local check if backend fails
    return canUseFeatureLocal(feature);
  }
}

// server.js
app.post('/api/usage/check', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const user = users.get(userId);
  
  // Pro users - unlimited
  if (user.subscriptionStatus === 'active') {
    return res.json({
      allowed: true,
      reason: 'pro_subscription',
      scansLeft: -1,
      isPro: true
    });
  }
  
  // Free users - check trial and limits
  const trialInfo = getUserTrialInfo(user);
  const usage = userUsage.get(userId);
  const today = new Date().toDateString();
  
  // Reset daily count at midnight
  if (usage.lastScanDate !== today) {
    usage.dailyScans = 0;
    usage.lastScanDate = today;
  }
  
  // Check daily limit
  if (usage.dailyScans >= 10) {
    return res.json({
      allowed: false,
      reason: 'daily_limit_reached',
      scansLeft: 0
    });
  }
  
  // Allow and increment
  usage.dailyScans++;
  usage.totalScans++;
  
  res.json({
    allowed: true,
    scansLeft: 10 - usage.dailyScans,
    scansToday: usage.dailyScans
  });
});
```

### 6. User Upgrades to Pro

```javascript
// popup.js
async function handleUpgrade() {
  // 1. Get auth status
  const authStatus = await chrome.runtime.sendMessage({ 
    action: 'getAuthStatus' 
  });
  
  if (!authStatus.isAuthenticated) {
    // User not signed in - prompt to sign in first
    alert('Please sign in with Google first');
    return;
  }
  
  // 2. Request upgrade
  // This will contact backend to create Stripe checkout
  const response = await fetch(
    `${API_ENDPOINT}/user/upgrade`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStatus.token}`
      }
    }
  );
  
  const data = await response.json();
  
  // 3. Open Stripe checkout
  chrome.tabs.create({ url: data.checkoutUrl });
}

// server.js
app.post('/api/user/upgrade', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const user = users.get(userId);
  
  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: process.env.STRIPE_PRICE_ID,
      quantity: 1,
    }],
    success_url: 'https://applysafe-version1.vercel.app/success',
    cancel_url: 'https://applysafe-version1.vercel.app/cancel',
    client_reference_id: userId,
    customer_email: user.email,
    metadata: { userId }
  });
  
  res.json({
    success: true,
    checkoutUrl: session.url
  });
});
```

### 7. Stripe Webhook Activates Pro

```javascript
// server.js
app.post('/api/webhook/stripe', async (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    process.env.STRIPE_WEBHOOK_SECRET
  );
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    
    // Activate Pro subscription
    const user = users.get(userId);
    if (user) {
      user.subscriptionStatus = 'active';
      user.customerId = session.customer;
      user.subscriptionId = session.subscription;
      
      console.log('User upgraded to Pro:', user.email);
    }
  }
  
  res.json({ received: true });
});
```

## Data Storage

### Client Side (chrome.storage.local)

```javascript
{
  // Authentication
  authToken: 'eyJhbGciOiJIUzI1NiIs...',  // JWT token (30-day expiry)
  user: {
    id: 'user_1234567890_abc123',
    email: 'user@example.com',
    name: 'John Doe',
    picture: 'https://...'
  },
  
  // Local trial (anonymous users)
  trialStartDate: 1702665600000,  // Timestamp
  scansToday: 5,                  // Daily scan count
  lastScanDate: '2024-12-15',     // Reset at midnight
  
  // Settings
  settings: {
    autoAnalyze: true,
    showBadges: true,
    notifyHighRisk: true,
    apiKey: 'sk-ant-...'
  }
}
```

### Server Side (In-Memory - Needs Database)

```javascript
// Users Map
users.set('user_1234567890_abc123', {
  id: 'user_1234567890_abc123',
  googleId: '108301776745236498547',
  email: 'user@example.com',
  name: 'John Doe',
  picture: 'https://...',
  createdAt: 1702665600000,
  subscriptionStatus: 'free',  // 'free', 'active', 'cancelled'
  customerId: 'cus_...',        // Stripe customer ID
  subscriptionId: 'sub_...',    // Stripe subscription ID
  trialStartDate: 1702665600000
});

// User Usage Map
userUsage.set('user_1234567890_abc123', {
  dailyScans: 5,
  lastScanDate: '2024-12-15',
  totalScans: 47
});
```

## API Endpoints

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/auth/google` | POST | Google OAuth login |

### Protected Endpoints (Require JWT)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/usage/check` | POST | JWT | Check feature access |
| `/api/user/profile` | GET | JWT | Get user profile |
| `/api/user/upgrade` | POST | JWT | Create Stripe checkout |

### Webhook Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhook/stripe` | POST | Handle Stripe events |

## Security Considerations

1. **JWT Tokens**: 30-day expiration, stored in chrome.storage.local
2. **Google Tokens**: Verified server-side before creating users
3. **CORS**: Enabled for extension origin only
4. **Rate Limiting**: 10 scans per day for free users
5. **Token Storage**: Never expose JWT_SECRET to client
6. **Password-less**: OAuth only, no password storage

## Testing Checklist

- [ ] Anonymous user can use extension (local trial)
- [ ] Sign in with Google works
- [ ] User info displayed correctly in popup
- [ ] Daily scan limit enforced (10/day)
- [ ] Trial expiration works (7 days)
- [ ] Sign out clears tokens
- [ ] Upgrade to Pro flow completes
- [ ] Pro users have unlimited scans
- [ ] Usage syncs across devices (signed-in users)
- [ ] Backend handles token expiration
- [ ] Fallback to local trial on backend failure

## Monitoring & Metrics

Track these metrics for production:

1. **User Acquisition**
   - Anonymous installs
   - Sign-in conversion rate
   - Pro upgrade rate

2. **Usage**
   - Daily active users
   - Average scans per user
   - Trial drop-off points

3. **Revenue**
   - Monthly recurring revenue
   - Churn rate
   - Customer lifetime value

4. **Technical**
   - API response times
   - Error rates
   - Token verification failures

---

**Documentation Last Updated**: December 15, 2024
**Version**: 1.0 (OAuth Integration)
