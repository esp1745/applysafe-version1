// Backend User Authentication Endpoints
// Add these to your server.js file

const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// JWT secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// In-memory user database (replace with real database in production)
const users = new Map();
const userUsage = new Map();

// Verify Google token and create/login user
app.post('/api/auth/google', async (req, res) => {
  try {
    const { googleToken, email, name, picture } = req.body;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const googleId = payload['sub'];

    // Find or create user
    let user = Array.from(users.values()).find(u => u.googleId === googleId);
    
    if (!user) {
      // Create new user
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      user = {
        id: userId,
        googleId,
        email,
        name,
        picture,
        createdAt: Date.now(),
        subscriptionStatus: 'free',
        trialStartDate: Date.now()
      };
      users.set(userId, user);
      
      // Initialize usage tracking
      userUsage.set(userId, {
        dailyScans: 0,
        lastScanDate: new Date().toDateString(),
        totalScans: 0
      });
      
      console.log('New user created:', email);
    } else {
      console.log('User logged in:', email);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      userId: user.id,
      token,
      subscriptionStatus: user.subscriptionStatus,
      trialInfo: getTrialInfo(user)
    });

  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  });
}

// Check if user can use a feature
app.post('/api/usage/check', authenticateToken, async (req, res) => {
  try {
    const { feature } = req.body;
    const userId = req.userId;

    const user = users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Pro users have unlimited access
    if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'pro') {
      await incrementUsage(userId);
      return res.json({
        allowed: true,
        reason: 'pro_subscription',
        scansLeft: -1, // unlimited
        isPro: true
      });
    }

    // Check trial status
    const trialInfo = getTrialInfo(user);
    if (!trialInfo.isTrialActive) {
      return res.json({
        allowed: false,
        reason: 'trial_expired',
        message: 'Your 7-day trial has expired. Upgrade to Pro for unlimited scans.',
        daysLeft: 0,
        scansLeft: 0
      });
    }

    // Check daily limit
    const usage = userUsage.get(userId);
    const today = new Date().toDateString();
    
    if (usage.lastScanDate !== today) {
      // Reset daily count
      usage.dailyScans = 0;
      usage.lastScanDate = today;
    }

    if (usage.dailyScans >= 10) {
      return res.json({
        allowed: false,
        reason: 'daily_limit_reached',
        message: 'Daily limit of 10 scans reached. Upgrade to Pro or try again tomorrow.',
        scansLeft: 0,
        daysLeft: trialInfo.daysLeft
      });
    }

    // Allow usage and increment count
    usage.dailyScans++;
    usage.totalScans++;

    res.json({
      allowed: true,
      reason: 'free_trial',
      scansLeft: 10 - usage.dailyScans,
      daysLeft: trialInfo.daysLeft,
      isPro: false
    });

  } catch (error) {
    console.error('Usage check error:', error);
    res.status(500).json({ error: 'Failed to check usage' });
  }
});

// Get user profile and usage stats
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = users.get(userId);
    const usage = userUsage.get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const trialInfo = getTrialInfo(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      subscription: {
        status: user.subscriptionStatus,
        customerId: user.customerId
      },
      trial: trialInfo,
      usage: {
        today: usage.dailyScans,
        total: usage.totalScans
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Upgrade user to Pro (connects with Stripe)
app.post('/api/user/upgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = users.get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      success_url: `https://applysafe-version1.vercel.app/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://applysafe-version1.vercel.app/cancel`,
      client_reference_id: userId,
      customer_email: user.email,
      metadata: {
        userId: userId
      }
    });

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook - activate subscription after payment
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout completion
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id || session.metadata?.userId;

    if (userId) {
      const user = users.get(userId);
      if (user) {
        user.subscriptionStatus = 'active';
        user.customerId = session.customer;
        user.subscriptionId = session.subscription;
        console.log('User upgraded to Pro:', user.email);
      }
    }
  }

  // Handle subscription updates
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    // Update user subscription status
    for (const [userId, user] of users.entries()) {
      if (user.customerId === subscription.customer) {
        user.subscriptionStatus = subscription.status;
        console.log('Subscription updated:', user.email, subscription.status);
      }
    }
  }

  // Handle subscription cancellation
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    for (const [userId, user] of users.entries()) {
      if (user.customerId === subscription.customer) {
        user.subscriptionStatus = 'cancelled';
        console.log('Subscription cancelled:', user.email);
      }
    }
  }

  res.json({ received: true });
});

// Helper functions
function getTrialInfo(user) {
  const trialStartDate = user.trialStartDate || user.createdAt;
  const daysElapsed = Math.floor((Date.now() - trialStartDate) / (1000 * 60 * 60 * 24));
  const isTrialActive = daysElapsed < 7;

  return {
    isTrialActive,
    daysLeft: Math.max(0, 7 - daysElapsed),
    trialStartDate
  };
}

async function incrementUsage(userId) {
  const usage = userUsage.get(userId);
  if (usage) {
    usage.totalScans++;
  }
}

// Export for testing
module.exports = {
  authenticateToken,
  getTrialInfo
};
