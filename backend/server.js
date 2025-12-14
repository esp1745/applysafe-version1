// ApplySafe Backend - Stripe Subscription Server
require('dotenv').config(); // Load .env FIRST

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Store license keys in memory (use database in production)
const licenses = new Map();

// Create Stripe Checkout Session
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { priceId, customerId } = req.body;
    
    // Generate unique session ID for tracking
    const clientReferenceId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build session config
    const sessionConfig = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId || process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `https://applysafe-version1.vercel.app/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://applysafe-version1.vercel.app/cancel`,
      client_reference_id: clientReferenceId,
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
      },
    };
    
    // Only add customer if it exists (not null/undefined/empty)
    if (customerId && customerId.trim()) {
      sessionConfig.customer = customerId;
    }
    
    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url, sessionId: session.id, clientReferenceId });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Checkout Session Details
app.get('/api/get-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ error: 'session_id required' });
    }
    
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    res.json({
      customerId: session.customer,
      subscriptionId: session.subscription,
      status: session.status,
      paymentStatus: session.payment_status
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate License Key
app.post('/api/validate-license', async (req, res) => {
  try {
    const { licenseKey } = req.body;
    
    const licenseData = licenses.get(licenseKey);
    
    if (licenseData && licenseData.status === 'active') {
      res.json({
        valid: true,
        customerId: licenseData.customerId,
        planName: 'Pro',
      });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Subscription Status
app.post('/api/subscription-status', async (req, res) => {
  try {
    const { customerId, licenseKey } = req.body;
    
    let customer = customerId;
    
    // If license key provided, get customer from license
    if (licenseKey && !customer) {
      const licenseData = licenses.get(licenseKey);
      customer = licenseData?.customerId;
    }
    
    if (!customer) {
      return res.json({ status: 'inactive' });
    }
    
    // Get subscriptions for customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer,
      status: 'all',
      limit: 1,
    });
    
    if (subscriptions.data.length === 0) {
      return res.json({ status: 'inactive' });
    }
    
    const subscription = subscriptions.data[0];
    
    res.json({
      status: subscription.status, // active, canceled, past_due, etc.
      planName: 'Pro',
      renewsAt: subscription.current_period_end * 1000,
      cancelsAt: subscription.cancel_at ? subscription.cancel_at * 1000 : null,
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel Subscription
app.post('/api/cancel-subscription', async (req, res) => {
  try {
    const { customerId } = req.body;
    
    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    
    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    
    const subscription = subscriptions.data[0];
    
    // Cancel at period end (don't cancel immediately)
    const canceled = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });
    
    res.json({
      success: true,
      cancelsAt: canceled.current_period_end * 1000,
    });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook Handler
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Checkout completed:', session.id);
      
      // Generate license key
      const licenseKey = generateLicenseKey();
      licenses.set(licenseKey, {
        customerId: session.customer,
        status: 'active',
        createdAt: Date.now(),
      });
      
      console.log('License created:', licenseKey);
      break;
      
    case 'customer.subscription.updated':
      const updatedSub = event.data.object;
      console.log('Subscription updated:', updatedSub.id, updatedSub.status);
      break;
      
    case 'customer.subscription.deleted':
      const deletedSub = event.data.object;
      console.log('Subscription deleted:', deletedSub.id);
      
      // Deactivate license
      for (const [key, data] of licenses.entries()) {
        if (data.customerId === deletedSub.customer) {
          data.status = 'inactive';
          console.log('License deactivated:', key);
        }
      }
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
  
  res.json({ received: true });
});

// Generate random license key
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 4; i++) {
    if (i > 0) key += '-';
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return key;
}

// Success redirect - shows HTML page that can be detected by extension
app.get('/success', async (req, res) => {
  const sessionId = req.query.session_id;
  
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Successful - ApplySafe</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }
          .container {
            background: white;
            padding: 60px 48px;
            border-radius: 20px;
            box-shadow: 0 25px 70px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 480px;
            width: 100%;
            animation: slideUp 0.5s ease-out;
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .checkmark {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            margin: 0 auto 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 56px;
            color: white;
            font-weight: 300;
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
            animation: checkPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.2s both;
          }
          @keyframes checkPop {
            0% { transform: scale(0); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          h1 { 
            color: #111827; 
            margin: 0 0 16px;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          p { 
            color: #6b7280; 
            margin: 0 0 32px; 
            line-height: 1.6;
            font-size: 16px;
          }
          .features {
            background: #f9fafb;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 32px;
            text-align: left;
          }
          .feature {
            display: flex;
            align-items: center;
            padding: 12px 0;
            color: #374151;
            font-size: 15px;
            line-height: 1.5;
          }
          .feature:not(:last-child) {
            border-bottom: 1px solid #e5e7eb;
          }
          .feature::before {
            content: '✓';
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            background: #10b981;
            color: white;
            border-radius: 50%;
            font-size: 14px;
            font-weight: 700;
            margin-right: 12px;
            flex-shrink: 0;
          }
          button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 14px 40px;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          }
          button:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
          }
          button:active {
            transform: translateY(0);
          }
          .note {
            margin-top: 24px;
            color: #9ca3af;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>Payment Successful!</h1>
          <p>Your ApplySafe Pro subscription is now active</p>
          <div class="features">
            <div class="feature">Unlimited job scans with AI analysis</div>
            <div class="feature">Real-time H1B visa sponsor verification</div>
            <div class="feature">Complete job history and analytics</div>
            <div class="feature">Priority support from our team</div>
          </div>
          <button onclick="closeTab()">Close This Tab</button>
          <div class="note">Press Cmd+W (Mac) or Ctrl+W (Windows) to close</div>
        </div>
        <script>
          // Try multiple methods to close the tab
          function closeTab() {
            // Method 1: window.close() - works if opened by script
            window.close();
            
            // Method 2: Show instructions if close failed
            setTimeout(() => {
              alert('Press Cmd+W (Mac) or Ctrl+W (Windows) to close this tab');
            }, 100);
          }
          
          // Store success data in localStorage for extension to read
          try {
            const successData = {
              type: 'APPLYSAFE_PAYMENT_SUCCESS',
              sessionId: '${sessionId}',
              customerId: '${session.customer}',
              timestamp: Date.now()
            };
            localStorage.setItem('applysafe_payment_success', JSON.stringify(successData));
            
            // Also try to communicate with extension if it's monitoring
            if (window.chrome && chrome.runtime) {
              chrome.runtime.sendMessage('YOUR_EXTENSION_ID', successData);
            }
          } catch (e) {
            console.log('Extension communication not available');
          }
          
          // Auto-attempt close after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Error retrieving session');
  }
});

// Cancel redirect
app.get('/cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Cancelled - ApplySafe</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: #f3f4f6;
        }
        .container {
          background: white;
          padding: 48px;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
        }
        h1 { color: #1f2937; margin: 0 0 12px; }
        p { color: #6b7280; margin: 0 0 24px; line-height: 1.6; }
        button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 32px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          font-weight: 600;
        }
        button:hover { background: #2563eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Payment Cancelled</h1>
        <p>You can return to ApplySafe and try again whenever you're ready.</p>
        <button onclick="window.close()">Close Tab</button>
      </div>
    </body>
    </html>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3000;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`ApplySafe backend running on port ${PORT}`);
    console.log(`Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
  });
}

// Export for Vercel serverless
module.exports = app;
